import {
  CRITERIOS_FOTO,
  LIMITE_MODELO_MB,
  UMBRALES_POR_DEFECTO,
  VISTAS,
  type EstadoEscaneo,
  type InformeCalidad,
  type NivelCalidad,
  type Plato,
  type VistaEscaneo,
} from '@pgim/shared';
import type { Proveedor3D } from '../../escaneo/proveedor-3d';
import { ProveedorSimulado } from '../../escaneo/proveedor-simulado';
import type { RegistroProveedores } from '../../escaneo/registro';
import * as archivosModelo from '../../lib/archivos-modelo';
import { AppError } from '../../lib/errors';
import type { EscaneoRepository, FilaEscaneo } from '../../repositories/escaneo.repository';
import { jpegFalso } from '../../test/jpeg-falso';
import { createEscaneoService } from './escaneo.service';

const R = 'restaurante';
const AHORA = new Date('2026-11-05T12:00:00Z');
const ANGULOS: Record<VistaEscaneo, number> = { front: 0, left: 90, back: 180, right: 270 };

// Las 4 vistas con los 5 criterios en OK, salvo los que se pisen en `niveles` (por vista).
const informe = (
  niveles: Partial<
    Record<VistaEscaneo, Partial<Record<(typeof CRITERIOS_FOTO)[number], NivelCalidad>>>
  > = {},
  parcial: Partial<InformeCalidad> = {},
): InformeCalidad => ({
  version: 2,
  nivelGlobal: 'OK',
  fotos: VISTAS.map((vista) => ({
    vista,
    anguloGrados: ANGULOS[vista],
    ancho: 1280,
    alto: 960,
    criterios: CRITERIOS_FOTO.map((criterio) => ({
      criterio,
      nivel: niveles[vista]?.[criterio] ?? 'OK',
      valor: 1,
      mensaje: null,
    })),
  })),
  ...parcial,
});

const fotos = (ancho = 1280, alto = 960) => {
  const f = jpegFalso(ancho, alto);
  return { front: f, left: f, back: f, right: f };
};

function fila(parcial: Partial<FilaEscaneo> = {}): FilaEscaneo {
  return {
    id: 'e1',
    restauranteId: R,
    itemMenuId: 'bife',
    empleadoId: 'emp',
    estado: 'EN_REVISION',
    proveedor: 'simulado',
    tareaProveedorId: 't',
    rutaFotos: null,
    urlModelo: '/api/uploads/modelos/nuevo.glb',
    urlModeloIos: null,
    calidad: informe(),
    error: null,
    creadoEn: AHORA,
    actualizadoEn: AHORA,
    ...parcial,
  };
}

const PLATO = { diametroCm: 26 } as Plato;

function montar(opciones: { repo?: Partial<EscaneoRepository>; plato?: Plato | null } = {}) {
  const repo = {
    crear: jest.fn().mockImplementation(async (d) => fila({ ...d, estado: 'PENDIENTE' })),
    ultimoDelPlato: jest.fn().mockResolvedValue(null),
    buscar: jest.fn().mockResolvedValue(fila()),
    enCurso: jest.fn(),
    cambiarEstado: jest.fn().mockResolvedValue(true),
    publicar: jest.fn().mockResolvedValue({ anterior: null }),
    ...opciones.repo,
  } as jest.Mocked<EscaneoRepository>;
  const deps = {
    menu: {
      buscarPlato: jest
        .fn()
        .mockResolvedValue(opciones.plato === undefined ? PLATO : opciones.plato),
    },
    fotos: {
      guardarFotos: jest.fn().mockResolvedValue('/uploads/escaneos/abc'),
      leerFotos: jest.fn(),
      borrarFotos: jest.fn().mockResolvedValue(undefined),
    },
    modelos: {
      validarGlb: jest.fn(),
      validarUsdz: jest.fn(),
      guardarModelo: jest.fn(),
      borrarModelo: jest.fn().mockResolvedValue(undefined),
    },
    proveedores: {
      activo: () => ({ nombre: 'simulado', requisitos: () => UMBRALES_POR_DEFECTO }),
      buscar: jest.fn(),
    } as unknown as RegistroProveedores,
    ahora: () => AHORA,
    timeoutMin: 30,
  };
  return { repo, deps, service: createEscaneoService(repo, deps as never) };
}

async function falla(promesa: Promise<unknown>, status: number, mensaje: string) {
  const error = await promesa.catch((e) => e);
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ status, message: mensaje });
}

describe('crear', () => {
  it('guarda las fotos y crea el escaneo PENDIENTE con el proveedor activo', async () => {
    const { service, repo, deps } = montar();
    const escaneo = await service.crear(R, 'bife', 'emp', fotos(), informe());
    expect(deps.fotos.guardarFotos).toHaveBeenCalledWith(
      expect.objectContaining({ front: expect.any(Buffer), right: expect.any(Buffer) }),
    );
    expect(repo.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        restauranteId: R,
        itemMenuId: 'bife',
        empleadoId: 'emp',
        proveedor: 'simulado',
        rutaFotos: '/uploads/escaneos/abc',
      }),
    );
    expect(escaneo).toMatchObject({
      platoId: 'bife',
      estado: 'PENDIENTE',
      creadoEn: AHORA.toISOString(),
    });
  });

  it('404 si el plato no es del restaurante', async () => {
    const { service, deps } = montar({ plato: null });
    await falla(service.crear(R, 'x', 'emp', fotos(), informe()), 404, 'El plato no existe');
    expect(deps.fotos.guardarFotos).not.toHaveBeenCalled();
  });

  it('422 si el plato no tiene diámetro (Foco 2), sin guardar ni crear nada', async () => {
    const { service, repo, deps } = montar({ plato: { diametroCm: null } as Plato });
    await falla(
      service.crear(R, 'bife', 'emp', fotos(), informe()),
      422,
      'Cargá el diámetro del plato para escanearlo',
    );
    expect(deps.fotos.guardarFotos).not.toHaveBeenCalled();
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('422 si al informe le falta la vista back', async () => {
    const { service, repo } = montar();
    const sinBack = informe();
    sinBack.fotos = sinBack.fotos.filter((f) => f.vista !== 'back');
    await falla(
      service.crear(R, 'bife', 'emp', fotos(), sinBack),
      422,
      'El informe de calidad está incompleto',
    );
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('422 si el informe repite una vista en lugar de traer las 4', async () => {
    const { service } = montar();
    const repetida = informe();
    repetida.fotos = [
      repetida.fotos[0]!,
      repetida.fotos[0]!,
      repetida.fotos[2]!,
      repetida.fotos[3]!,
    ];
    await falla(
      service.crear(R, 'bife', 'emp', fotos(), repetida),
      422,
      'El informe de calidad está incompleto',
    );
  });

  it('422 si a una foto le falta un criterio', async () => {
    const { service } = montar();
    const incompleto = informe();
    incompleto.fotos[1]!.criterios = incompleto.fotos[1]!.criterios.slice(1);
    await falla(
      service.crear(R, 'bife', 'emp', fotos(), incompleto),
      422,
      'El informe de calidad está incompleto',
    );
  });

  it('422 si el informe ya trae RECHAZO', async () => {
    const { service } = montar();
    await falla(
      service.crear(R, 'bife', 'emp', fotos(), informe({}, { nivelGlobal: 'RECHAZO' })),
      422,
      'Las fotos no pasaron la revisión de calidad',
    );
  });

  it('422 si un criterio de una foto trae RECHAZO aunque el nivel global diga OK', async () => {
    const { service, repo } = montar();
    await falla(
      service.crear(R, 'bife', 'emp', fotos(), informe({ left: { NITIDEZ: 'RECHAZO' } })),
      422,
      'Las fotos no pasaron la revisión de calidad',
    );
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('crea el escaneo si el informe trae una ADVERTENCIA (Enviar igual)', async () => {
    const { service, repo } = montar();
    await service.crear(
      R,
      'bife',
      'emp',
      fotos(),
      informe({ front: { BRILLOS: 'ADVERTENCIA' } }, { nivelGlobal: 'ADVERTENCIA' }),
    );
    expect(repo.crear).toHaveBeenCalled();
  });

  it('422 si una foto no es un JPEG', async () => {
    const { service, deps } = montar();
    const f = { ...fotos(), back: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]) };
    await falla(
      service.crear(R, 'bife', 'emp', f, informe()),
      422,
      'Las fotos tienen que ser JPEG',
    );
    expect(deps.fotos.guardarFotos).not.toHaveBeenCalled();
  });

  it('422 si el lado menor de una foto está por debajo del mínimo del proveedor', async () => {
    const { service, deps } = montar();
    const chica = { ...fotos(), right: jpegFalso(400, 300) };
    const i = informe();
    i.fotos.find((f) => f.vista === 'right')!.ancho = 400;
    i.fotos.find((f) => f.vista === 'right')!.alto = 300;
    await falla(
      service.crear(R, 'bife', 'emp', chica, i),
      422,
      'El informe de calidad no corresponde a estas fotos',
    );
    expect(deps.fotos.guardarFotos).not.toHaveBeenCalled();
  });

  it.each([
    ['el ancho', 1290, 960],
    ['el alto', 1280, 950],
  ])('422 si difiere %s del informe', async (_caso, ancho, alto) => {
    const { service, deps } = montar();
    await falla(
      service.crear(R, 'bife', 'emp', fotos(ancho, alto), informe()),
      422,
      'El informe de calidad no corresponde a estas fotos',
    );
    expect(deps.fotos.guardarFotos).not.toHaveBeenCalled();
  });

  it('tolera hasta 2 px de diferencia', async () => {
    const { service } = montar();
    await expect(
      service.crear(R, 'bife', 'emp', fotos(1282, 958), informe()),
    ).resolves.toBeDefined();
  });

  it('409 si el plato ya tiene un escaneo activo', async () => {
    for (const estado of ['PENDIENTE', 'PROCESANDO', 'EN_REVISION'] as EstadoEscaneo[]) {
      const { service, deps } = montar({
        repo: { ultimoDelPlato: jest.fn().mockResolvedValue(fila({ estado })) },
      });
      await falla(
        service.crear(R, 'bife', 'emp', fotos(), informe()),
        409,
        'Este plato ya tiene un escaneo en curso',
      );
      expect(deps.fotos.guardarFotos).not.toHaveBeenCalled();
    }
  });

  it('409 y borra las fotos si el índice único rechaza el alta (P2002)', async () => {
    const { service, deps } = montar({
      repo: { crear: jest.fn().mockRejectedValue({ code: 'P2002' }) },
    });
    await falla(
      service.crear(R, 'bife', 'emp', fotos(), informe()),
      409,
      'Este plato ya tiene un escaneo en curso',
    );
    expect(deps.fotos.borrarFotos).toHaveBeenCalledWith('/uploads/escaneos/abc');
  });

  it('borra las fotos y propaga cualquier otro error del repositorio', async () => {
    const { service, deps } = montar({
      repo: { crear: jest.fn().mockRejectedValue(new Error('caída')) },
    });
    await expect(service.crear(R, 'bife', 'emp', fotos(), informe())).rejects.toThrow('caída');
    expect(deps.fotos.borrarFotos).toHaveBeenCalledWith('/uploads/escaneos/abc');
  });

  it.each(['FALLIDO', 'DESCARTADO', 'PUBLICADO'] as EstadoEscaneo[])(
    'permite reescanear si el último está %s',
    async (estado) => {
      const { service } = montar({
        repo: { ultimoDelPlato: jest.fn().mockResolvedValue(fila({ estado })) },
      });
      await expect(service.crear(R, 'bife', 'emp', fotos(), informe())).resolves.toMatchObject({
        estado: 'PENDIENTE',
      });
    },
  );
});

describe('ultimo y requisitos', () => {
  it('ultimo devuelve null o el escaneo armado', async () => {
    const { service, repo } = montar();
    expect(await service.ultimo(R, 'bife')).toBeNull();
    repo.ultimoDelPlato.mockResolvedValue(fila());
    expect(await service.ultimo(R, 'bife')).toMatchObject({ id: 'e1', platoId: 'bife' });
  });

  it('requisitos son los del proveedor activo', () => {
    expect(montar().service.requisitos()).toEqual(UMBRALES_POR_DEFECTO);
  });
});

describe('publicar', () => {
  const datos = { escalaReal: 1, porcionGramos: 300 };
  const anterior = {
    urlModelo: '/api/uploads/modelos/viejo.glb',
    urlModeloIos: '/api/uploads/modelos/viejo.usdz',
    escalaReal: 1,
    porcionGramos: 200,
  };

  it('borra el .glb y el .usdz anteriores después de publicar', async () => {
    const { service, repo, deps } = montar({
      repo: { publicar: jest.fn().mockResolvedValue({ anterior }) },
    });
    repo.buscar.mockResolvedValueOnce(fila()).mockResolvedValueOnce(fila({ estado: 'PUBLICADO' }));
    const escaneo = await service.publicar(R, 'e1', datos);
    expect(escaneo.estado).toBe('PUBLICADO');
    expect(deps.modelos.borrarModelo).toHaveBeenCalledWith(anterior.urlModelo);
    expect(deps.modelos.borrarModelo).toHaveBeenCalledWith(anterior.urlModeloIos);
  });

  it('un escaneo sin .usdz deja urlModeloIos null: el repositorio recibe el escaneo tal cual y se borra el .usdz viejo', async () => {
    const { service, repo, deps } = montar({
      repo: { publicar: jest.fn().mockResolvedValue({ anterior }) },
    });
    await service.publicar(R, 'e1', datos);
    expect(repo.publicar).toHaveBeenCalledWith(R, 'e1', datos);
    expect(deps.modelos.borrarModelo).toHaveBeenCalledWith(anterior.urlModeloIos);
  });

  it('sin modelo anterior no borra nada', async () => {
    const { service, deps } = montar();
    await service.publicar(R, 'e1', datos);
    expect(deps.modelos.borrarModelo).not.toHaveBeenCalled();
  });

  it('no borra nada si el repositorio falla', async () => {
    const { service, deps } = montar({
      repo: { publicar: jest.fn().mockRejectedValue(new Error('caída')) },
    });
    await expect(service.publicar(R, 'e1', datos)).rejects.toThrow('caída');
    expect(deps.modelos.borrarModelo).not.toHaveBeenCalled();
  });

  it('si borrar un archivo falla, publica igual y sigue con el otro', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { service, deps } = montar({
      repo: { publicar: jest.fn().mockResolvedValue({ anterior }) },
    });
    deps.modelos.borrarModelo.mockRejectedValueOnce(new Error('disco'));
    await expect(service.publicar(R, 'e1', datos)).resolves.toBeDefined();
    expect(deps.modelos.borrarModelo).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('409 si la transacción dice que ya no estaba en revisión', async () => {
    const { service, deps } = montar({ repo: { publicar: jest.fn().mockResolvedValue(null) } });
    await falla(service.publicar(R, 'e1', datos), 409, 'El escaneo ya está publicado o descartado');
    expect(deps.modelos.borrarModelo).not.toHaveBeenCalled();
  });

  it('409 si está PROCESANDO, sin tocar el repositorio', async () => {
    const { service, repo } = montar({
      repo: { buscar: jest.fn().mockResolvedValue(fila({ estado: 'PROCESANDO' })) },
    });
    await expect(service.publicar(R, 'e1', datos)).rejects.toMatchObject({ status: 409 });
    expect(repo.publicar).not.toHaveBeenCalled();
  });

  it('404 si el escaneo no existe', async () => {
    const { service } = montar({ repo: { buscar: jest.fn().mockResolvedValue(null) } });
    await falla(service.publicar(R, 'e1', datos), 404, 'El escaneo no existe');
  });
});

describe('descartar', () => {
  it('pasa a DESCARTADO y borra el borrador', async () => {
    const fPrev = fila({ urlModeloIos: '/api/uploads/modelos/nuevo.usdz' });
    const { service, repo, deps } = montar();
    repo.buscar
      .mockResolvedValueOnce(fPrev)
      .mockResolvedValueOnce({ ...fPrev, estado: 'DESCARTADO' });
    const escaneo = await service.descartar(R, 'e1');
    expect(repo.cambiarEstado).toHaveBeenCalledWith(R, 'e1', 'EN_REVISION', {
      estado: 'DESCARTADO',
    });
    expect(escaneo.estado).toBe('DESCARTADO');
    expect(deps.modelos.borrarModelo).toHaveBeenCalledWith(fPrev.urlModelo);
    expect(deps.modelos.borrarModelo).toHaveBeenCalledWith(fPrev.urlModeloIos);
  });

  it('409 si cambió de estado en el medio y no borra nada', async () => {
    const { service, deps } = montar({
      repo: { cambiarEstado: jest.fn().mockResolvedValue(false) },
    });
    await falla(service.descartar(R, 'e1'), 409, 'El escaneo ya está publicado o descartado');
    expect(deps.modelos.borrarModelo).not.toHaveBeenCalled();
  });

  it('409 si está PROCESANDO', async () => {
    const { service, repo } = montar({
      repo: { buscar: jest.fn().mockResolvedValue(fila({ estado: 'PROCESANDO' })) },
    });
    await expect(service.descartar(R, 'e1')).rejects.toMatchObject({ status: 409 });
    expect(repo.cambiarEstado).not.toHaveBeenCalled();
  });
});

describe('procesarEnCurso', () => {
  const GLB = Buffer.from('glb');
  const USDZ = Buffer.from('usdz');
  const MINUTO = 60_000;

  function proveedorFalso(parcial: Partial<Proveedor3D> = {}) {
    return {
      nombre: 'simulado',
      requisitos: () => UMBRALES_POR_DEFECTO,
      iniciar: jest.fn().mockResolvedValue('tarea-1'),
      consultar: jest.fn().mockResolvedValue({ estado: 'EN_PROCESO' }),
      ...parcial,
    } as jest.Mocked<Proveedor3D>;
  }

  function armar(filas: FilaEscaneo[], proveedor = proveedorFalso(), ahora = AHORA) {
    const m = montar({ repo: { enCurso: jest.fn().mockResolvedValue(filas) } });
    m.deps.proveedores.buscar = jest.fn().mockReturnValue(proveedor);
    m.deps.ahora = () => ahora;
    m.deps.fotos.leerFotos.mockResolvedValue(fotos());
    return { ...m, proveedor, service: createEscaneoService(m.repo, m.deps as never) };
  }

  const pendiente = (p: Partial<FilaEscaneo> = {}) =>
    fila({
      estado: 'PENDIENTE',
      tareaProveedorId: null,
      rutaFotos: '/uploads/escaneos/abc',
      urlModelo: null,
      ...p,
    });
  const procesando = (p: Partial<FilaEscaneo> = {}) =>
    pendiente({ estado: 'PROCESANDO', tareaProveedorId: 'tarea-1', ...p });

  let error: jest.SpyInstance;
  beforeEach(() => {
    error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => error.mockRestore());

  it('PENDIENTE: envía las fotos y pasa a PROCESANDO con el id de tarea', async () => {
    const { service, repo, proveedor, deps } = armar([pendiente()]);
    await service.procesarEnCurso();
    expect(deps.fotos.leerFotos).toHaveBeenCalledWith('/uploads/escaneos/abc');
    expect(proveedor.iniciar).toHaveBeenCalledWith(
      expect.objectContaining({ front: expect.any(Buffer), left: expect.any(Buffer) }),
    );
    expect(repo.cambiarEstado).toHaveBeenCalledWith(R, 'e1', 'PENDIENTE', {
      estado: 'PROCESANDO',
      tareaProveedorId: 'tarea-1',
    });
    expect(deps.fotos.borrarFotos).not.toHaveBeenCalled();
  });

  it('PENDIENTE: si iniciar lanza, pasa a FALLIDO y borra las fotos', async () => {
    const proveedor = proveedorFalso({ iniciar: jest.fn().mockRejectedValue(new Error('red')) });
    const { service, repo, deps } = armar([pendiente()], proveedor);
    await service.procesarEnCurso();
    expect(repo.cambiarEstado).toHaveBeenCalledWith(R, 'e1', 'PENDIENTE', {
      estado: 'FALLIDO',
      error: 'No pudimos enviar las fotos',
      rutaFotos: null,
    });
    expect(deps.fotos.borrarFotos).toHaveBeenCalledWith('/uploads/escaneos/abc');
  });

  it('PROCESANDO en proceso y sin vencer: no cambia nada', async () => {
    const f = procesando({ actualizadoEn: new Date(AHORA.getTime() - 30 * MINUTO) });
    const { service, repo, deps } = armar([f]);
    await service.procesarEnCurso();
    expect(repo.cambiarEstado).not.toHaveBeenCalled();
    expect(deps.fotos.borrarFotos).not.toHaveBeenCalled();
  });

  it('PROCESANDO pasado el timeout: FALLIDO y borra las fotos', async () => {
    const f = procesando({ actualizadoEn: new Date(AHORA.getTime() - 30 * MINUTO - 1) });
    const { service, repo, deps } = armar([f]);
    await service.procesarEnCurso();
    expect(repo.cambiarEstado).toHaveBeenCalledWith(R, 'e1', 'PROCESANDO', {
      estado: 'FALLIDO',
      error: 'El escaneo tardó demasiado',
      rutaFotos: null,
    });
    expect(deps.fotos.borrarFotos).toHaveBeenCalledWith('/uploads/escaneos/abc');
  });

  it('PROCESANDO con el proveedor caído: reintenta y, vencido, pasa a FALLIDO', async () => {
    const proveedor = proveedorFalso({
      consultar: jest.fn().mockRejectedValue(new Error('sin conexión')),
    });
    const reciente = procesando({ actualizadoEn: new Date(AHORA.getTime() - 5 * MINUTO) });
    const a = armar([reciente], proveedor);
    await a.service.procesarEnCurso();
    expect(a.repo.cambiarEstado).not.toHaveBeenCalled();

    const vencido = procesando({ actualizadoEn: new Date(AHORA.getTime() - 31 * MINUTO) });
    const b = armar([vencido], proveedor);
    await b.service.procesarEnCurso();
    expect(b.repo.cambiarEstado).toHaveBeenCalledWith(R, 'e1', 'PROCESANDO', {
      estado: 'FALLIDO',
      error: 'El escaneo tardó demasiado',
      rutaFotos: null,
    });
  });

  it('PROCESANDO con guardarModelo fallando: reintenta y, vencido, falla sin consultar', async () => {
    const proveedor = proveedorFalso({
      consultar: jest.fn().mockResolvedValue({ estado: 'LISTO', glb: GLB }),
    });
    const reciente = procesando({ actualizadoEn: new Date(AHORA.getTime() - 5 * MINUTO) });
    const a = armar([reciente], proveedor);
    a.deps.modelos.guardarModelo.mockRejectedValue(new Error('disco'));
    await a.service.procesarEnCurso();
    expect(a.repo.cambiarEstado).not.toHaveBeenCalled();

    const vencido = procesando({ actualizadoEn: new Date(AHORA.getTime() - 31 * MINUTO) });
    const b = armar([vencido], proveedor);
    (proveedor.consultar as jest.Mock).mockClear();
    await b.service.procesarEnCurso();
    expect(proveedor.consultar).not.toHaveBeenCalled();
    expect(b.repo.cambiarEstado).toHaveBeenCalledWith(R, 'e1', 'PROCESANDO', {
      estado: 'FALLIDO',
      error: 'El escaneo tardó demasiado',
      rutaFotos: null,
    });
  });

  it('PENDIENTE vencido con un proveedor desconocido: FALLIDO', async () => {
    const vencido = pendiente({ actualizadoEn: new Date(AHORA.getTime() - 31 * MINUTO) });
    const { service, repo, deps } = armar([vencido]);
    deps.proveedores.buscar = jest.fn().mockImplementation(() => {
      throw new Error('Proveedor no registrado');
    });
    await service.procesarEnCurso();
    expect(repo.cambiarEstado).toHaveBeenCalledWith(R, 'e1', 'PENDIENTE', {
      estado: 'FALLIDO',
      error: 'El escaneo tardó demasiado',
      rutaFotos: null,
    });
  });

  it('PROCESANDO listo: guarda el modelo, pasa a EN_REVISION y borra las fotos', async () => {
    const proveedor = proveedorFalso({
      consultar: jest.fn().mockResolvedValue({ estado: 'LISTO', glb: GLB, usdz: USDZ }),
    });
    const { service, repo, deps } = armar([procesando()], proveedor);
    deps.modelos.guardarModelo.mockResolvedValueOnce('/m/a.glb').mockResolvedValueOnce('/m/a.usdz');
    await service.procesarEnCurso();
    expect(proveedor.consultar).toHaveBeenCalledWith('tarea-1');
    expect(deps.modelos.validarGlb).toHaveBeenCalledWith(GLB);
    expect(deps.modelos.validarUsdz).toHaveBeenCalledWith(USDZ);
    expect(deps.modelos.guardarModelo).toHaveBeenCalledWith(GLB, 'glb');
    expect(deps.modelos.guardarModelo).toHaveBeenCalledWith(USDZ, 'usdz');
    expect(repo.cambiarEstado).toHaveBeenCalledWith(R, 'e1', 'PROCESANDO', {
      estado: 'EN_REVISION',
      urlModelo: '/m/a.glb',
      urlModeloIos: '/m/a.usdz',
      rutaFotos: null,
    });
    expect(deps.fotos.borrarFotos).toHaveBeenCalledWith('/uploads/escaneos/abc');
    expect(deps.modelos.borrarModelo).not.toHaveBeenCalled();
  });

  it('PROCESANDO listo sin .usdz: urlModeloIos queda null', async () => {
    const proveedor = proveedorFalso({
      consultar: jest.fn().mockResolvedValue({ estado: 'LISTO', glb: GLB }),
    });
    const { service, repo, deps } = armar([procesando()], proveedor);
    deps.modelos.guardarModelo.mockResolvedValueOnce('/m/a.glb');
    await service.procesarEnCurso();
    expect(deps.modelos.validarUsdz).not.toHaveBeenCalled();
    expect(repo.cambiarEstado).toHaveBeenCalledWith(
      R,
      'e1',
      'PROCESANDO',
      expect.objectContaining({ estado: 'EN_REVISION', urlModeloIos: null }),
    );
  });

  it('PROCESANDO listo con .glb inválido: FALLIDO con un motivo fijo y el detalle en el log', async () => {
    const proveedor = proveedorFalso({
      consultar: jest.fn().mockResolvedValue({ estado: 'LISTO', glb: GLB }),
    });
    const { service, repo, deps } = armar([procesando()], proveedor);
    deps.modelos.validarGlb.mockImplementation(() => {
      throw new AppError(400, 'El archivo no es un modelo .glb');
    });
    await service.procesarEnCurso();
    expect(deps.modelos.guardarModelo).not.toHaveBeenCalled();
    expect(repo.cambiarEstado).toHaveBeenCalledWith(R, 'e1', 'PROCESANDO', {
      estado: 'FALLIDO',
      error: 'No pudimos armar el modelo con estas fotos',
      rutaFotos: null,
    });
    expect(error).toHaveBeenCalledWith(
      expect.any(String),
      'e1',
      expect.objectContaining({ message: 'El archivo no es un modelo .glb' }),
    );
    expect(deps.fotos.borrarFotos).toHaveBeenCalledWith('/uploads/escaneos/abc');
  });

  it('PROCESANDO listo con un .glb que supera el tope: FALLIDO sin guardar nada', async () => {
    const enorme = Buffer.alloc(LIMITE_MODELO_MB * 1024 * 1024 + 1);
    const proveedor = proveedorFalso({
      consultar: jest.fn().mockResolvedValue({ estado: 'LISTO', glb: enorme }),
    });
    const { service, repo, deps } = armar([procesando()], proveedor);
    await service.procesarEnCurso();
    expect(deps.modelos.guardarModelo).not.toHaveBeenCalled();
    expect(repo.cambiarEstado).toHaveBeenCalledWith(R, 'e1', 'PROCESANDO', {
      estado: 'FALLIDO',
      error: 'No pudimos armar el modelo con estas fotos',
      rutaFotos: null,
    });
  });

  it('PROCESANDO listo: si el estado cambió, borra los modelos recién guardados y las fotos', async () => {
    const proveedor = proveedorFalso({
      consultar: jest.fn().mockResolvedValue({ estado: 'LISTO', glb: GLB, usdz: USDZ }),
    });
    const { service, repo, deps } = armar([procesando()], proveedor);
    repo.cambiarEstado.mockResolvedValue(false);
    deps.modelos.guardarModelo.mockResolvedValueOnce('/m/a.glb').mockResolvedValueOnce('/m/a.usdz');
    await service.procesarEnCurso();
    expect(deps.modelos.borrarModelo).toHaveBeenCalledWith('/m/a.glb');
    expect(deps.modelos.borrarModelo).toHaveBeenCalledWith('/m/a.usdz');
    expect(deps.fotos.borrarFotos).not.toHaveBeenCalled();
  });

  it('PROCESANDO listo: si falla guardar el .usdz, borra el .glb ya guardado y reintenta después', async () => {
    const proveedor = proveedorFalso({
      consultar: jest.fn().mockResolvedValue({ estado: 'LISTO', glb: GLB, usdz: USDZ }),
    });
    const { service, repo, deps } = armar([procesando()], proveedor);
    deps.modelos.guardarModelo
      .mockResolvedValueOnce('/m/a.glb')
      .mockRejectedValueOnce(new Error('disco'));
    await service.procesarEnCurso();
    expect(deps.modelos.borrarModelo).toHaveBeenCalledWith('/m/a.glb');
    expect(repo.cambiarEstado).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });

  it('PROCESANDO fallido en el proveedor: FALLIDO con el motivo y borra las fotos', async () => {
    const proveedor = proveedorFalso({
      consultar: jest.fn().mockResolvedValue({ estado: 'FALLIDO', motivo: 'Fotos borrosas' }),
    });
    const { service, repo, deps } = armar([procesando()], proveedor);
    await service.procesarEnCurso();
    expect(repo.cambiarEstado).toHaveBeenCalledWith(R, 'e1', 'PROCESANDO', {
      estado: 'FALLIDO',
      error: 'Fotos borrosas',
      rutaFotos: null,
    });
    expect(deps.fotos.borrarFotos).toHaveBeenCalledWith('/uploads/escaneos/abc');
  });

  it('si el primer escaneo lanza, el segundo igual se procesa', async () => {
    const proveedor = proveedorFalso();
    const { service, repo, deps } = armar(
      [pendiente({ id: 'e1' }), pendiente({ id: 'e2' })],
      proveedor,
    );
    deps.fotos.leerFotos.mockRejectedValueOnce(new Error('disco'));
    deps.fotos.leerFotos.mockResolvedValue(fotos());
    repo.cambiarEstado.mockRejectedValueOnce(new Error('caída'));
    await service.procesarEnCurso();
    expect(error).toHaveBeenCalled();
    expect(repo.cambiarEstado).toHaveBeenCalledWith(R, 'e2', 'PENDIENTE', expect.anything());
  });

  it('si borrar las fotos falla, el escaneo igual queda FALLIDO', async () => {
    const proveedor = proveedorFalso({ iniciar: jest.fn().mockRejectedValue(new Error('red')) });
    const { service, repo, deps } = armar([pendiente(), pendiente({ id: 'e2' })], proveedor);
    deps.fotos.borrarFotos.mockRejectedValueOnce(new Error('disco'));
    await service.procesarEnCurso();
    expect(repo.cambiarEstado).toHaveBeenCalledTimes(2);
  });

  it('con el ProveedorSimulado real, llega a EN_REVISION después de la demora', async () => {
    let ahora = AHORA;
    const simulado = new ProveedorSimulado({ demoraMs: 20_000, ahora: () => ahora.getTime() });
    let actual = pendiente();
    const repo = {
      enCurso: jest.fn(async () => [actual]),
      cambiarEstado: jest.fn(async (_r, _id, desde, cambio) => {
        if (actual.estado !== desde) return false;
        actual = { ...actual, ...cambio, actualizadoEn: ahora };
        return true;
      }),
    } as unknown as jest.Mocked<EscaneoRepository>;
    const m = montar();
    m.deps.proveedores.buscar = jest.fn().mockReturnValue(simulado);
    m.deps.ahora = () => ahora;
    m.deps.fotos.leerFotos.mockResolvedValue(fotos());
    m.deps.modelos.validarGlb.mockImplementation(archivosModelo.validarGlb);
    m.deps.modelos.guardarModelo.mockResolvedValue('/api/uploads/modelos/x.glb');
    const service = createEscaneoService(repo, m.deps as never);

    await service.procesarEnCurso();
    expect(actual.estado).toBe('PROCESANDO');
    ahora = new Date(AHORA.getTime() + 10_000);
    await service.procesarEnCurso();
    expect(actual.estado).toBe('PROCESANDO');
    ahora = new Date(AHORA.getTime() + 21_000);
    await service.procesarEnCurso();
    expect(actual).toMatchObject({
      estado: 'EN_REVISION',
      urlModelo: '/api/uploads/modelos/x.glb',
      rutaFotos: null,
    });
    expect(m.deps.fotos.borrarFotos).toHaveBeenCalledWith('/uploads/escaneos/abc');
  });
});
