import request from 'supertest';
import type { CodigoPermiso } from '@pgim/shared';
import { createApp } from '../app';
import { cookieConPermisos } from '../test/sesion-falsa';

jest.mock('../repositories/usuario.repository', () => ({
  usuarioRepository: { findCredencialesByEmail: jest.fn(), findSesionById: jest.fn() },
}));
jest.mock('../repositories/rol.repository', () => ({
  rolRepository: {
    buscar: jest.fn(),
    contarEmpleados: jest.fn(),
    eliminar: jest.fn(),
    listarEmpleadosActivos: jest.fn(),
    buscarEmpleadosActivos: jest.fn(),
    asignarEmpleados: jest.fn(),
    contarGestoresDeRoles: jest.fn(),
  },
}));

const ID = '01900000-0000-7000-8000-000000000021';
const EMPLEADO = '01900000-0000-7000-8000-000000000032';
const repo = () => jest.requireMock('../repositories/rol.repository').rolRepository;
const gestion: CodigoPermiso[] = ['rol.ver', 'rol.editar'];

describe('/api/roles: empleados y eliminación definitiva', () => {
  const app = createApp();

  beforeEach(() => jest.clearAllMocks());

  it('GET /empleados sin rol.editar responde 403', async () => {
    const res = await request(app)
      .get('/api/roles/empleados')
      .set('Cookie', cookieConPermisos(['rol.ver']));

    expect(res.status).toBe(403);
  });

  it('GET /empleados lista con la gestión de roles, filtrando por restaurante', async () => {
    repo().listarEmpleadosActivos.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/roles/empleados')
      .set('Cookie', cookieConPermisos(gestion));

    expect(res.status).toBe(200);
    expect(repo().listarEmpleadosActivos).toHaveBeenCalledWith(expect.any(String));
  });

  it('PUT /:id/empleados sin rol.editar responde 403', async () => {
    const res = await request(app)
      .put(`/api/roles/${ID}/empleados`)
      .set('Cookie', cookieConPermisos(['rol.ver']))
      .send({ empleadoIds: [EMPLEADO] });

    expect(res.status).toBe(403);
  });

  it('PUT /:id/empleados valida el body', async () => {
    const cookie = cookieConPermisos(gestion);

    const vacio = await request(app)
      .put(`/api/roles/${ID}/empleados`)
      .set('Cookie', cookie)
      .send({ empleadoIds: [] });
    const mal = await request(app)
      .put(`/api/roles/${ID}/empleados`)
      .set('Cookie', cookie)
      .send({ empleadoIds: ['no-es-uuid'] });

    expect(vacio.status).toBe(400);
    expect(mal.status).toBe(400);
  });

  it('PUT /:id/empleados con un rol de otro restaurante responde 404', async () => {
    repo().buscar.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/roles/${ID}/empleados`)
      .set('Cookie', cookieConPermisos(gestion))
      .send({ empleadoIds: [EMPLEADO] });

    expect(res.status).toBe(404);
    expect(repo().asignarEmpleados).not.toHaveBeenCalled();
  });

  it('DELETE /:id/definitivo sin rol.eliminar responde 403', async () => {
    const res = await request(app)
      .delete(`/api/roles/${ID}/definitivo`)
      .set('Cookie', cookieConPermisos(gestion));

    expect(res.status).toBe(403);
  });

  it('DELETE /:id/definitivo con un id mal formado responde 400', async () => {
    const res = await request(app)
      .delete('/api/roles/no-es-uuid/definitivo')
      .set('Cookie', cookieConPermisos(['rol.eliminar']));

    expect(res.status).toBe(400);
  });

  it('DELETE /:id/definitivo con un rol de otro restaurante responde 404', async () => {
    repo().buscar.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/roles/${ID}/definitivo`)
      .set('Cookie', cookieConPermisos(['rol.eliminar']));

    expect(res.status).toBe(404);
    expect(repo().eliminar).not.toHaveBeenCalled();
  });
});
