import request from 'supertest';
import { createApp } from '../app';
import { cookieConPermisos } from '../test/sesion-falsa';

jest.mock('../repositories/usuario.repository', () => ({
  usuarioRepository: { findCredencialesByEmail: jest.fn(), findSesionById: jest.fn() },
}));

jest.mock('../services/menu/menu.service', () => ({
  menuService: { actualizarPlato: jest.fn().mockResolvedValue({}), crearPlato: jest.fn() },
}));

const ID = '01900000-0000-7000-8000-000000000011';
const datos = {
  categoriaId: '01900000-0000-7000-8000-000000000012',
  nombre: 'Bife',
  precio: 1000,
  disponible: true,
};

// Las URLs de /api/uploads/ las escribe solo la ruta de subida: si el admin
// pudiera pegarlas, la próxima subida borraría la foto de otro restaurante.
describe('PUT /api/platos/:id: fotoUrl', () => {
  const app = createApp();
  const guardar = (fotoUrl: string) =>
    request(app)
      .put(`/api/platos/${ID}`)
      .set('Cookie', cookieConPermisos(['menu.editar']))
      .send({ ...datos, fotoUrl });

  it('rechaza una ruta de fotos subidas', async () => {
    expect((await guardar('/api/uploads/fotos/x.jpg')).status).toBe(400);
    expect((await guardar('  /api/uploads/modelos/x.glb')).status).toBe(400);
  });

  it('acepta una foto de demo', async () => {
    expect((await guardar('/fotos-demo/bife.jpg')).status).toBe(200);
  });

  it('acepta un enlace https', async () => {
    expect((await guardar('https://ejemplo.com/bife.jpg')).status).toBe(200);
  });
});

describe('PUT /api/platos/:id: diametroCm', () => {
  const app = createApp();

  it('sin menu.editar responde 403', async () => {
    const res = await request(app)
      .put(`/api/platos/${ID}`)
      .set('Cookie', cookieConPermisos(['menu.ver']))
      .send({ ...datos, diametroCm: 26 });
    expect(res.status).toBe(403);
  });

  it('con menu.editar acepta el diámetro y rechaza uno de 61 cm con 400', async () => {
    const guardar = (diametroCm: number) =>
      request(app)
        .put(`/api/platos/${ID}`)
        .set('Cookie', cookieConPermisos(['menu.editar']))
        .send({ ...datos, diametroCm });
    expect((await guardar(26)).status).toBe(200);
    expect((await guardar(61)).status).toBe(400);
  });
});
