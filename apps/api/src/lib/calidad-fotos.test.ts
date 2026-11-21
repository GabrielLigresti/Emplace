import {
  CRITERIOS_FOTO,
  UMBRALES_POR_DEFECTO as U,
  VISTAS,
  aLuminancia,
  brillosCentrales,
  escalaPorDiametro,
  evaluarCalidad,
  evaluarFoto,
  exposicion,
  informeCalidadSchema,
  varianzaLaplaciano,
  type FotoEvaluable,
  type MuestraCuadro,
  type VistaEscaneo,
} from '@pgim/shared';

const N = 64;

function uniforme(valor: number): MuestraCuadro {
  return { ancho: N, alto: N, luminancia: new Uint8Array(N * N).fill(valor) };
}

function tablero(): MuestraCuadro {
  const luminancia = new Uint8Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) luminancia[y * N + x] = (x + y) % 2 === 0 ? 100 : 160;
  return { ancho: N, alto: N, luminancia };
}

function centroBlanco(): MuestraCuadro {
  const c = tablero();
  for (let y = N / 4; y < (3 * N) / 4; y++)
    for (let x = N / 4; x < (3 * N) / 4; x++) c.luminancia[y * N + x] = 255;
  return c;
}

const ANGULOS: Record<VistaEscaneo, number> = { front: 0, left: 90, back: 180, right: 270 };

function foto(vista: VistaEscaneo, extra: Partial<FotoEvaluable> = {}): FotoEvaluable {
  return {
    vista,
    anguloGrados: ANGULOS[vista],
    ancho: 640,
    alto: 480,
    muestra: tablero(),
    ...extra,
  };
}

const cuatroSanas = () => VISTAS.map((v) => foto(v));

const nivelDe = (f: ReturnType<typeof evaluarFoto>, id: string) =>
  f.criterios.find((c) => c.criterio === id)!;

describe('funciones de imagen', () => {
  it('tablero nítido supera nitidezMin y uno uniforme no', () => {
    expect(varianzaLaplaciano(tablero())).toBeGreaterThan(U.nitidezMin);
    expect(varianzaLaplaciano(uniforme(128))).toBeLessThan(U.nitidezMin);
  });

  it('exposicion de una imagen blanca da quemadosPct 1', () => {
    expect(exposicion(uniforme(255)).quemadosPct).toBe(1);
    expect(exposicion(uniforme(0)).negrosPct).toBe(1);
  });

  it('brillosCentrales mira solo el centro', () => {
    expect(brillosCentrales(centroBlanco())).toBeGreaterThan(0.9);
  });

  it('aLuminancia de rojo puro da 76', () => {
    const m = aLuminancia(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1);
    expect(m.luminancia[0]).toBe(76);
  });
});

describe('evaluarFoto', () => {
  it('da RECHAZO de RESOLUCION con 640x400', () => {
    const r = evaluarFoto(foto('front', { ancho: 640, alto: 400 }), U);
    expect(nivelDe(r, 'RESOLUCION').nivel).toBe('RECHAZO');
    expect(nivelDe(r, 'RESOLUCION').mensaje).not.toBeNull();
  });

  it('da OK con una foto nítida de 640x480 a 92° como left', () => {
    const r = evaluarFoto(foto('left', { anguloGrados: 92 }), U);
    expect(r.criterios.map((c) => c.criterio)).toEqual([...CRITERIOS_FOTO]);
    expect(r.criterios.every((c) => c.nivel === 'OK')).toBe(true);
    expect(r.ancho).toBe(640);
    expect(r.anguloGrados).toBe(92);
  });

  it('RECHAZO de NITIDEZ con una foto uniforme', () => {
    expect(
      nivelDe(evaluarFoto(foto('front', { muestra: uniforme(128) }), U), 'NITIDEZ').nivel,
    ).toBe('RECHAZO');
  });

  it('EXPOSICION: RECHAZO por oscura y por quemada', () => {
    expect(
      nivelDe(evaluarFoto(foto('front', { muestra: uniforme(10) }), U), 'EXPOSICION').nivel,
    ).toBe('RECHAZO');
    expect(
      nivelDe(evaluarFoto(foto('front', { muestra: uniforme(250) }), U), 'EXPOSICION').nivel,
    ).toBe('RECHAZO');
  });

  it('EXPOSICION: ADVERTENCIA con 20% de quemados', () => {
    const m = tablero();
    for (let i = 0; i < Math.floor(N * N * 0.2); i++) m.luminancia[i] = 255;
    expect(nivelDe(evaluarFoto(foto('front', { muestra: m }), U), 'EXPOSICION').nivel).toBe(
      'ADVERTENCIA',
    );
  });

  it('BRILLOS: ADVERTENCIA y nunca RECHAZO', () => {
    const r = evaluarFoto(foto('front', { muestra: centroBlanco() }), U);
    expect(nivelDe(r, 'BRILLOS').nivel).toBe('ADVERTENCIA');
  });

  it("ANGULO rechaza 'back' a 160°, y acepta 'front' a 355°", () => {
    expect(nivelDe(evaluarFoto(foto('back', { anguloGrados: 160 }), U), 'ANGULO').nivel).toBe(
      'RECHAZO',
    );
    expect(nivelDe(evaluarFoto(foto('front', { anguloGrados: 355 }), U), 'ANGULO').nivel).toBe(
      'OK',
    );
  });
});

describe('evaluarCalidad', () => {
  it('con las 4 vistas sanas es OK', () => {
    const i = evaluarCalidad(cuatroSanas(), U);
    expect(i.version).toBe(2);
    expect(i.nivelGlobal).toBe('OK');
    expect(i.fotos).toHaveLength(4);
  });

  it('con 3 vistas es RECHAZO global', () => {
    expect(evaluarCalidad(cuatroSanas().slice(0, 3), U).nivelGlobal).toBe('RECHAZO');
  });

  it('con front repetido es RECHAZO', () => {
    const fotos = [foto('front'), foto('front'), foto('back'), foto('right')];
    expect(evaluarCalidad(fotos, U).nivelGlobal).toBe('RECHAZO');
  });

  it('un RECHAZO en una foto da RECHAZO global, y una ADVERTENCIA da ADVERTENCIA', () => {
    const malas = cuatroSanas();
    malas[1] = foto('left', { muestra: uniforme(128) });
    expect(evaluarCalidad(malas, U).nivelGlobal).toBe('RECHAZO');
    const brillosas = cuatroSanas();
    brillosas[2] = foto('back', { muestra: centroBlanco() });
    expect(evaluarCalidad(brillosas, U).nivelGlobal).toBe('ADVERTENCIA');
  });
});

describe('informeCalidadSchema', () => {
  it('acepta un informe de evaluarCalidad y rechaza version 1', () => {
    const informe = evaluarCalidad(cuatroSanas(), U);
    expect(informeCalidadSchema.safeParse(informe).success).toBe(true);
    expect(informeCalidadSchema.safeParse({ ...informe, version: 1 }).success).toBe(false);
    expect(informeCalidadSchema.safeParse({ ...informe, nivelGlobal: 'MAL' }).success).toBe(false);
  });
});

describe('escala por diámetro', () => {
  it('escalaPorDiametro(26, 0.13, 0.1) es 2', () => {
    expect(escalaPorDiametro(26, 0.13, 0.1)).toBeCloseTo(2, 10);
  });
});
