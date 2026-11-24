import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { CRITERIOS_FOTO, VISTAS, type InformeCalidad } from '@pgim/shared';

jest.mock('../repositories/usuario.repository', () => ({
  usuarioRepository: { findCredencialesByEmail: jest.fn(), findSesionById: jest.fn() },
}));

// Límite chico para probar el 413 sin mandar 5 MB.
jest.mock('@pgim/shared', () => ({
  ...jest.requireActual('@pgim/shared'),
  LIMITE_FOTO_MB: 1,
}));

// Las rutas se prueban sin base: el servicio se reemplaza y los casos de negocio
// (plato ajeno, escaneo activo, rechazo) se simulan con el error que lanza.
jest.mock('../services/escaneo/escaneo.service', () => ({
  escaneoService: {
    requisitos: jest.fn(),
    crear: jest.fn(),
    ultimo: jest.fn(),
    publicar: jest.fn(),
    descartar: jest.fn(),
  },
}));

// La carpeta de uploads se fija antes de cargar la configuración: por eso la
// app y la sesión falsa se cargan con require, después de esta línea.
const UPLOADS = mkdtempSync(path.join(tmpdir(), 'pgim-uploads-'));
process.env.UPLOADS_DIR = UPLOADS;
const { createApp } = require('../app') as typeof import('../app');
const { cookieConPermisos } =
  require('../test/sesion-falsa') as typeof import('../test/sesion-falsa');
const { AppError } = require('../lib/errors') as typeof import('../lib/errors');
const { jpegFalso } = require('../test/jpeg-falso') as typeof import('../test/jpeg-falso');
const { escaneoService } = jest.requireMock('../services/escaneo/escaneo.service') as {
  escaneoService: Record<'requisitos' | 'crear' | 'ultimo' | 'publicar' | 'descartar', jest.Mock>;
};

const ID = '01900000-0000-7000-8000-000000000011';
const ESCANEO = { id: ID, platoId: ID, estado: 'PENDIENTE' };
const EDITAR = ['menu.editar'] as const;

const foto = jpegFalso(1280, 960);

function informe(nivelGlobal: InformeCalidad['nivelGlobal'] = 'OK'): InformeCalidad {
  return {
    version: 2,
    nivelGlobal,
    fotos: VISTAS.map((vista, i) => ({
      vista,
      anguloGrados: i * 90,
      ancho: 1280,
      alto: 960,
      criterios: CRITERIOS_FOTO.map((criterio) => ({
        criterio,
        nivel: nivelGlobal,
        valor: 1,
        mensaje: null,
      })),
    })),
  };
}

describe('modelos RA servidos como estáticos', () => {
  const app = createApp();

  beforeAll(() => {
    const carpeta = path.join(UPLOADS, 'modelos');
    mkdirSync(carpeta, { recursive: true });
    writeFileSync(path.join(carpeta, 'abc.glb'), 'glTF');
  });

  it('se descargan sin sesión, con tipo fijo y nosniff', async () => {
    const res = await request(app).get('/api/uploads/modelos/abc.glb');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('model/gltf-binary');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('no se lista la carpeta', async () => {
    expect((await request(app).get('/api/uploads/modelos/')).status).toBe(404);
  });

  it('no se sale de la carpeta', async () => {
    const res = await request(app).get('/api/uploads/modelos/..%2F..%2Fpackage.json');
    expect(res.status).not.toBe(200);
  });
});

describe('retiro de la subida manual', () => {
  const app = createApp();

  it('PUT /platos/:id/modelo-ra/glb ya no existe', async () => {
    const res = await request(app)
      .put(`/api/platos/${ID}/modelo-ra/glb`)
      .set('Cookie', cookieConPermisos([...EDITAR]))
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('glTF'));

    expect(res.status).toBe(404);
  });
});

describe('POST /api/platos/:id/escaneos', () => {
  const app = createApp();

  // Multipart con las vistas indicadas y el informe (por defecto, uno válido).
  function enviar(
    opciones: { permisos?: string[]; vistas?: readonly string[]; informe?: string | null } = {},
  ) {
    const { permisos = [...EDITAR], vistas = VISTAS, informe: cuerpo } = opciones;
    const pedido = request(app)
      .post(`/api/platos/${ID}/escaneos`)
      .set('Cookie', cookieConPermisos(permisos as never));
    for (const v of vistas)
      pedido.attach(v, foto, { filename: `${v}.jpg`, contentType: 'image/jpeg' });
    const texto = cuerpo === undefined ? JSON.stringify(informe()) : cuerpo;
    if (texto !== null) pedido.field('informe', texto);
    return pedido;
  }

  beforeEach(() => jest.resetAllMocks());

  it('sin menu.editar responde 403', async () => {
    const res = await enviar({ permisos: ['menu.ver'] });

    expect(res.status).toBe(403);
    expect(escaneoService.crear).not.toHaveBeenCalled();
  });

  it('sin sesión responde 401', async () => {
    const res = await request(app)
      .post(`/api/platos/${ID}/escaneos`)
      .attach('front', foto, 'front.jpg')
      .field('informe', JSON.stringify(informe()));

    expect(res.status).toBe(401);
    expect(escaneoService.crear).not.toHaveBeenCalled();
  });

  it('crea el escaneo con el empleado de la sesión y las 4 fotos', async () => {
    escaneoService.crear.mockResolvedValue(ESCANEO);

    const res = await enviar();

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('PENDIENTE');
    const [restauranteId, platoId, empleadoId, fotos, enviado] =
      escaneoService.crear.mock.calls[0]!;
    expect(restauranteId).toEqual(expect.any(String));
    expect(platoId).toBe(ID);
    expect(empleadoId).toEqual(expect.any(String));
    expect(Object.keys(fotos).sort()).toEqual([...VISTAS].sort());
    for (const v of VISTAS) expect(Buffer.isBuffer(fotos[v])).toBe(true);
    expect(enviado).toEqual(informe());
  });

  it('con solo la foto front responde 400 "Faltan fotos"', async () => {
    const res = await enviar({ vistas: ['front'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Faltan fotos');
    expect(escaneoService.crear).not.toHaveBeenCalled();
  });

  it('responde 413 si una foto supera el límite', async () => {
    const pedido = request(app)
      .post(`/api/platos/${ID}/escaneos`)
      .set('Cookie', cookieConPermisos([...EDITAR]));
    for (const v of VISTAS) {
      pedido.attach(v, v === 'back' ? Buffer.alloc(1024 * 1024 + 1) : foto, `${v}.jpg`);
    }
    pedido.field('informe', JSON.stringify(informe()));

    const res = await pedido;

    expect(res.status).toBe(413);
    expect(escaneoService.crear).not.toHaveBeenCalled();
  });

  it('rechaza una foto en un campo que no es una vista', async () => {
    const res = await enviar().attach('extra', foto, 'extra.jpg');

    expect(res.status).toBe(400);
    expect(escaneoService.crear).not.toHaveBeenCalled();
  });

  it.each([
    ['falta', null],
    ['no es JSON', 'esto no es json'],
    ['no es un informe', '{"version":1}'],
  ])('si el informe %s responde 422 y no 500', async (_caso, valor) => {
    const res = await enviar({ informe: valor });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Falta el informe de calidad de las fotos');
    expect(escaneoService.crear).not.toHaveBeenCalled();
  });

  it('responde 404 si el plato es de otro restaurante', async () => {
    escaneoService.crear.mockRejectedValue(new AppError(404, 'El plato no existe'));

    const res = await enviar();

    expect(res.status).toBe(404);
  });

  it('responde 409 si ya hay un escaneo en curso', async () => {
    escaneoService.crear.mockRejectedValue(
      new AppError(409, 'Este plato ya tiene un escaneo en curso'),
    );

    expect((await enviar()).status).toBe(409);
  });

  it('responde 422 si el plato no tiene diámetro', async () => {
    escaneoService.crear.mockRejectedValue(
      new AppError(422, 'Cargá el diámetro del plato para escanearlo'),
    );

    const res = await enviar();

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Cargá el diámetro del plato para escanearlo');
  });

  it('responde 422 si el informe es un rechazo', async () => {
    escaneoService.crear.mockRejectedValue(
      new AppError(422, 'Las fotos no pasaron la revisión de calidad'),
    );

    expect((await enviar({ informe: JSON.stringify(informe('RECHAZO')) })).status).toBe(422);
  });
});

describe('GET /api/platos/:id/escaneo', () => {
  const app = createApp();
  beforeEach(() => jest.resetAllMocks());

  it('sin escaneos responde 200 con null', async () => {
    escaneoService.ultimo.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/platos/${ID}/escaneo`)
      .set('Cookie', cookieConPermisos(['menu.editar']));

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('sin menu.editar responde 403', async () => {
    const res = await request(app)
      .get(`/api/platos/${ID}/escaneo`)
      .set('Cookie', cookieConPermisos(['menu.ver']));

    expect(res.status).toBe(403);
  });
});

describe('/api/escaneos', () => {
  const app = createApp();
  beforeEach(() => jest.resetAllMocks());

  it('GET /requisitos devuelve los umbrales del proveedor', async () => {
    escaneoService.requisitos.mockReturnValue({ anchoMin: 1280 });

    const res = await request(app)
      .get('/api/escaneos/requisitos')
      .set('Cookie', cookieConPermisos(['menu.editar']));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ anchoMin: 1280 });
  });

  it('GET /requisitos sin menu.editar responde 403', async () => {
    const res = await request(app)
      .get('/api/escaneos/requisitos')
      .set('Cookie', cookieConPermisos(['menu.ver']));

    expect(res.status).toBe(403);
  });

  it('publicar con datos inválidos responde 400', async () => {
    const res = await request(app)
      .post(`/api/escaneos/${ID}/publicar`)
      .set('Cookie', cookieConPermisos(['menu.editar']))
      .send({ escalaReal: 'mucho' });

    expect(res.status).toBe(400);
    expect(escaneoService.publicar).not.toHaveBeenCalled();
  });

  it('publicar con datos válidos responde 200', async () => {
    escaneoService.publicar.mockResolvedValue({ ...ESCANEO, estado: 'PUBLICADO' });

    const res = await request(app)
      .post(`/api/escaneos/${ID}/publicar`)
      .set('Cookie', cookieConPermisos(['menu.editar']))
      .send({ escalaReal: 0.5, porcionGramos: 350 });

    expect(res.status).toBe(200);
    expect(escaneoService.publicar).toHaveBeenCalledWith(expect.any(String), ID, {
      escalaReal: 0.5,
      porcionGramos: 350,
    });
  });

  it('descartar responde 200', async () => {
    escaneoService.descartar.mockResolvedValue({ ...ESCANEO, estado: 'DESCARTADO' });

    const res = await request(app)
      .post(`/api/escaneos/${ID}/descartar`)
      .set('Cookie', cookieConPermisos(['menu.editar']));

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('DESCARTADO');
  });
});
