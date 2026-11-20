import { z } from 'zod';

// Verificación de calidad de las 4 fotos de un escaneo. Todo son funciones puras
// sobre muestras de luminancia: el navegador evalúa cada foto al sacarla y la API
// revalida las que recibe.

export type NivelCalidad = 'OK' | 'ADVERTENCIA' | 'RECHAZO';
export type CriterioId = 'RESOLUCION' | 'NITIDEZ' | 'EXPOSICION' | 'BRILLOS' | 'ANGULO';
export type VistaEscaneo = 'front' | 'left' | 'back' | 'right';

// Orden fijo de las vistas; los ángulos se miden desde el punto de partida.
export const VISTAS: readonly VistaEscaneo[] = ['front', 'left', 'back', 'right'];
export const ANGULO_VISTA: Record<VistaEscaneo, number> = {
  front: 0,
  left: 90,
  back: 180,
  right: 270,
};
export const CRITERIOS_FOTO: readonly CriterioId[] = [
  'RESOLUCION',
  'NITIDEZ',
  'EXPOSICION',
  'BRILLOS',
  'ANGULO',
];

export interface MuestraCuadro {
  ancho: number;
  alto: number;
  luminancia: Uint8Array;
}
export interface UmbralesCalidad {
  ladoMenorMinPx: number;
  nitidezMin: number;
  luminanciaMin: number;
  luminanciaMax: number;
  recortadosAdvertenciaPct: number;
  recortadosRechazoPct: number;
  brillosAdvertenciaPct: number;
  toleranciaAnguloGrados: number;
}

export const UMBRALES_POR_DEFECTO: UmbralesCalidad = {
  ladoMenorMinPx: 480, // el piso absoluto es 256, el mínimo de Tripo
  nitidezMin: 100,
  luminanciaMin: 40,
  luminanciaMax: 220,
  recortadosAdvertenciaPct: 0.1,
  recortadosRechazoPct: 0.3,
  brillosAdvertenciaPct: 0.15,
  toleranciaAnguloGrados: 10,
};

export interface ResultadoCriterio {
  criterio: CriterioId;
  nivel: NivelCalidad;
  valor: number;
  mensaje: string | null;
}
export interface FotoEvaluable {
  vista: VistaEscaneo;
  anguloGrados: number;
  ancho: number;
  alto: number;
  muestra: MuestraCuadro;
}
export interface FotoInforme {
  vista: VistaEscaneo;
  anguloGrados: number;
  ancho: number;
  alto: number;
  criterios: ResultadoCriterio[];
}
export interface InformeCalidad {
  version: 2;
  nivelGlobal: NivelCalidad;
  fotos: FotoInforme[];
}

// --- Funciones de imagen ---

export function aLuminancia(rgba: Uint8ClampedArray, ancho: number, alto: number): MuestraCuadro {
  const luminancia = new Uint8Array(ancho * alto);
  for (let i = 0; i < luminancia.length; i++) {
    const o = i * 4;
    luminancia[i] = Math.round(
      0.299 * (rgba[o] ?? 0) + 0.587 * (rgba[o + 1] ?? 0) + 0.114 * (rgba[o + 2] ?? 0),
    );
  }
  return { ancho, alto, luminancia };
}

export function varianzaLaplaciano(c: MuestraCuadro): number {
  const { ancho, alto, luminancia: l } = c;
  if (ancho < 3 || alto < 3) return 0;
  let suma = 0;
  let sumaCuad = 0;
  let n = 0;
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const i = y * ancho + x;
      const r =
        (l[i - ancho] ?? 0) +
        (l[i + ancho] ?? 0) +
        (l[i - 1] ?? 0) +
        (l[i + 1] ?? 0) -
        4 * (l[i] ?? 0);
      suma += r;
      sumaCuad += r * r;
      n++;
    }
  }
  const media = suma / n;
  return sumaCuad / n - media * media;
}

export function exposicion(c: MuestraCuadro): {
  media: number;
  quemadosPct: number;
  negrosPct: number;
} {
  const total = c.luminancia.length;
  if (total === 0) return { media: 0, quemadosPct: 0, negrosPct: 0 };
  let suma = 0;
  let quemados = 0;
  let negros = 0;
  for (let i = 0; i < total; i++) {
    const v = c.luminancia[i] ?? 0;
    suma += v;
    if (v >= 250) quemados++;
    else if (v <= 5) negros++;
  }
  return { media: suma / total, quemadosPct: quemados / total, negrosPct: negros / total };
}

export function brillosCentrales(c: MuestraCuadro): number {
  const x0 = Math.ceil(c.ancho / 4);
  const x1 = Math.ceil((3 * c.ancho) / 4);
  const y0 = Math.ceil(c.alto / 4);
  const y1 = Math.ceil((3 * c.alto) / 4);
  let total = 0;
  let brillantes = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      total++;
      if ((c.luminancia[y * c.ancho + x] ?? 0) >= 240) brillantes++;
    }
  }
  return total === 0 ? 0 : brillantes / total;
}

// --- Criterios ---

const resultado = (
  criterio: CriterioId,
  nivel: NivelCalidad,
  valor: number,
  mensaje: string,
): ResultadoCriterio => ({ criterio, nivel, valor, mensaje: nivel === 'OK' ? null : mensaje });

// Distancia circular entre dos ángulos, en [0, 180].
export function distanciaAngular(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function evaluarFoto(foto: FotoEvaluable, u: UmbralesCalidad): FotoInforme {
  const { muestra } = foto;

  // Lado menor: una foto vertical vale igual que una apaisada.
  const ladoMenor = Math.min(foto.ancho, foto.alto);
  const resolucion = resultado(
    'RESOLUCION',
    ladoMenor < u.ladoMenorMinPx ? 'RECHAZO' : 'OK',
    ladoMenor,
    'La foto tiene poca resolución: probá con otro celular',
  );

  const nitidez = varianzaLaplaciano(muestra);
  const nitidezRes = resultado(
    'NITIDEZ',
    nitidez < u.nitidezMin ? 'RECHAZO' : 'OK',
    nitidez,
    'La foto salió movida: sostené el celular quieto al sacarla',
  );

  const e = exposicion(muestra);
  const recortados = e.quemadosPct + e.negrosPct;
  let nivelExp: NivelCalidad = 'OK';
  if (
    e.media < u.luminanciaMin ||
    e.media > u.luminanciaMax ||
    recortados > u.recortadosRechazoPct
  ) {
    nivelExp = 'RECHAZO';
  } else if (recortados > u.recortadosAdvertenciaPct) {
    nivelExp = 'ADVERTENCIA';
  }
  const pocaLuz = e.negrosPct > e.quemadosPct || e.media < u.luminanciaMin;
  const exposicionRes = resultado(
    'EXPOSICION',
    nivelExp,
    e.media,
    pocaLuz
      ? 'Hay poca luz: sacá la foto con luz pareja, sin flash'
      : 'Hay demasiada luz: evitá el sol o el flash directo',
  );

  const brillos = brillosCentrales(muestra);
  const brillosRes = resultado(
    'BRILLOS',
    brillos > u.brillosAdvertenciaPct ? 'ADVERTENCIA' : 'OK',
    brillos,
    'Hay muchos reflejos: evitá la luz directa sobre el plato',
  );

  const desvio = distanciaAngular(foto.anguloGrados, ANGULO_VISTA[foto.vista]);
  const anguloRes = resultado(
    'ANGULO',
    desvio > u.toleranciaAnguloGrados ? 'RECHAZO' : 'OK',
    desvio,
    'La foto no salió desde el lugar indicado: repetí el escaneo',
  );

  return {
    vista: foto.vista,
    anguloGrados: foto.anguloGrados,
    ancho: foto.ancho,
    alto: foto.alto,
    criterios: [resolucion, nitidezRes, exposicionRes, brillosRes, anguloRes],
  };
}

const ORDEN_NIVEL: Record<NivelCalidad, number> = { OK: 0, ADVERTENCIA: 1, RECHAZO: 2 };

export function evaluarCalidad(fotos: FotoEvaluable[], u: UmbralesCalidad): InformeCalidad {
  const informes = fotos.map((f) => evaluarFoto(f, u));
  const vistas = new Set(fotos.map((f) => f.vista));
  // Faltan vistas o hay alguna repetida: no alcanza para armar el modelo.
  const incompleto = fotos.length !== VISTAS.length || vistas.size !== VISTAS.length;
  let nivelGlobal = informes
    .flatMap((i) => i.criterios)
    .reduce<NivelCalidad>(
      (peor, c) => (ORDEN_NIVEL[c.nivel] > ORDEN_NIVEL[peor] ? c.nivel : peor),
      'OK',
    );
  if (incompleto) nivelGlobal = 'RECHAZO';
  return { version: 2, nivelGlobal, fotos: informes };
}

const nivelCalidadSchema = z.enum(['OK', 'ADVERTENCIA', 'RECHAZO']);

export const informeCalidadSchema: z.ZodType<InformeCalidad> = z.object({
  version: z.literal(2),
  nivelGlobal: nivelCalidadSchema,
  fotos: z.array(
    z.object({
      vista: z.enum(['front', 'left', 'back', 'right']),
      anguloGrados: z.number(),
      ancho: z.number(),
      alto: z.number(),
      criterios: z.array(
        z.object({
          criterio: z.enum(['RESOLUCION', 'NITIDEZ', 'EXPOSICION', 'BRILLOS', 'ANGULO']),
          nivel: nivelCalidadSchema,
          valor: z.number(),
          mensaje: z.string().nullable(),
        }),
      ),
    }),
  ),
});

// --- Escala del modelo ---

export function escalaPorDiametro(
  diametroCm: number,
  anchoM: number,
  profundidadM: number,
): number {
  return diametroCm / 100 / Math.max(anchoM, profundidadM);
}
