import request from 'supertest';
import { createApp } from '../app';
import { mesaRepository } from '../repositories/mesa.repository';
import { IDS } from '../test/fake-usuarios';
import { cookieConPermisos } from '../test/sesion-falsa';

jest.mock('../repositories/usuario.repository', () => ({
  usuarioRepository: { findCredencialesByEmail: jest.fn(), findSesionById: jest.fn() },
}));

jest.mock('../repositories/mesa.repository', () => ({
  mesaRepository: {
    listar: jest.fn().mockResolvedValue([]),
    existeSucursal: jest.fn().mockResolvedValue(true),
    buscar: jest.fn().mockResolvedValue(null),
    existeNumero: jest.fn().mockResolvedValue(false),
    crear: jest.fn(),
    actualizar: jest.fn(),
    desactivar: jest.fn(),
    reservasVigentes: jest.fn().mockResolvedValue([]),
    actualizarPosiciones: jest.fn().mockResolvedValue(undefined),
  },
}));

const URL = `/api/sucursales/${IDS.centro}/mesas`;
const valida = { numero: 1, capacidad: 4, posX: 10, posY: 10 };
const mesaGuardada = {
  id: IDS.centro,
  numero: 1,
  capacidad: 4,
  posX: 10,
  posY: 10,
  vertical: false,
  activa: true,
};

describe('/api/sucursales/:sucursalId/mesas', () => {
  const app = createApp();

  it('sin cookie responde 401', async () => {
    expect((await request(app).get(URL)).status).toBe(401);
  });

  it('sin sucursal.ver responde 403', async () => {
    const res = await request(app)
      .get(URL)
      .set('Cookie', cookieConPermisos(['menu.ver']));
    expect(res.status).toBe(403);
  });

  it('con sucursal.ver lista el salón', async () => {
    const res = await request(app)
      .get(URL)
      .set('Cookie', cookieConPermisos(['sucursal.ver']));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('crear sin sucursal.editar responde 403', async () => {
    const res = await request(app)
      .post(URL)
      .set('Cookie', cookieConPermisos(['sucursal.ver']))
      .send(valida);
    expect(res.status).toBe(403);
  });

  it('rechaza una capacidad de 0', async () => {
    const res = await request(app)
      .post(URL)
      .set('Cookie', cookieConPermisos(['sucursal.editar']))
      .send({ ...valida, capacidad: 0 });
    expect(res.status).toBe(400);
  });

  it('rechaza una posición fuera del lienzo', async () => {
    const res = await request(app)
      .post(URL)
      .set('Cookie', cookieConPermisos(['sucursal.editar']))
      .send({ ...valida, posX: 101 });
    expect(res.status).toBe(400);
  });

  it('valida el id de la sucursal', async () => {
    const res = await request(app)
      .get('/api/sucursales/no-es-uuid/mesas')
      .set('Cookie', cookieConPermisos(['sucursal.ver']));
    expect(res.status).toBe(400);
  });

  it('PUT que choca con una vecina responde 409 con el motivo', async () => {
    const centrada = { ...mesaGuardada, posX: 20 };
    const vecina = { ...mesaGuardada, id: IDS.palermo, numero: 2, posX: 35 };
    jest.mocked(mesaRepository.buscar).mockResolvedValueOnce(centrada);
    jest.mocked(mesaRepository.listar).mockResolvedValueOnce([centrada, vecina]);

    const res = await request(app)
      .put(`${URL}/${mesaGuardada.id}`)
      .set('Cookie', cookieConPermisos(['sucursal.editar']))
      .send({ ...valida, posX: 20, capacidad: 8 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Se superpone con la mesa 2');
  });

  describe('PUT /distribucion', () => {
    const DISTRIBUCION = `${URL}/distribucion`;
    const cuerpo = { mesas: [{ id: IDS.centro, posX: 30, posY: 20 }] };

    it('sin sucursal.editar responde 403', async () => {
      const res = await request(app)
        .put(DISTRIBUCION)
        .set('Cookie', cookieConPermisos(['sucursal.ver']))
        .send(cuerpo);
      expect(res.status).toBe(403);
    });

    it.each([
      ['sin mesas', { mesas: [] }],
      ['id que no es uuid', { mesas: [{ id: 'x', posX: 10, posY: 10 }] }],
      ['posición fuera del lienzo', { mesas: [{ id: IDS.centro, posX: 101, posY: 10 }] }],
      [
        'mesas repetidas',
        {
          mesas: [
            { id: IDS.centro, posX: 10, posY: 10 },
            { id: IDS.centro, posX: 20, posY: 10 },
          ],
        },
      ],
    ])('rechaza el cuerpo: %s', async (_caso, body) => {
      const res = await request(app)
        .put(DISTRIBUCION)
        .set('Cookie', cookieConPermisos(['sucursal.editar']))
        .send(body);
      expect(res.status).toBe(400);
    });

    it('guarda y responde 200 con las mesas, sin chocar con /:id', async () => {
      const guardada = { ...mesaGuardada, posX: 30, posY: 20 };
      jest.mocked(mesaRepository.listar).mockResolvedValueOnce([mesaGuardada]);
      jest.mocked(mesaRepository.listar).mockResolvedValueOnce([guardada]);

      const res = await request(app)
        .put(DISTRIBUCION)
        .set('Cookie', cookieConPermisos(['sucursal.editar']))
        .send(cuerpo);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([guardada]);
      expect(mesaRepository.actualizarPosiciones).toHaveBeenCalledWith(
        expect.any(String),
        IDS.centro,
        cuerpo.mesas,
      );
    });
  });
});
