import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { healthResponseSchema } from '@pgim/shared';
import { createApp } from './app';

describe('GET /api/health', () => {
  it('responde ok con un timestamp ISO', async () => {
    const res = await request(createApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
  });
});

describe('rutas inexistentes', () => {
  it('responden 404 en JSON', async () => {
    const res = await request(createApp()).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Recurso no encontrado' });
  });
});

describe('trust proxy', () => {
  it('toma la opción recibida', () => {
    expect(createApp({ trustProxy: 1 }).get('trust proxy')).toBe(1);
  });

  it('por defecto confía solo en loopback', () => {
    expect(createApp().get('trust proxy')).toBe('loopback');
  });
});

describe('web estática', () => {
  let carpeta: string;

  beforeAll(() => {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'pgim-web-'));
    fs.writeFileSync(path.join(carpeta, 'index.html'), '<!doctype html><title>PGIM</title>');
    fs.mkdirSync(path.join(carpeta, 'assets'));
    fs.writeFileSync(path.join(carpeta, 'assets', 'app-abc123.js'), 'console.log(1);');
  });

  afterAll(() => {
    fs.rmSync(carpeta, { recursive: true, force: true });
  });

  it('GET / devuelve index.html sin caché', async () => {
    const res = await request(createApp({ webDist: carpeta })).get('/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<title>PGIM</title>');
    expect(res.headers['cache-control']).toContain('no-cache');
  });

  it('una ruta de React devuelve index.html sin caché', async () => {
    const res = await request(createApp({ webDist: carpeta })).get('/mesa/una-mesa-cualquiera');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>PGIM</title>');
    expect(res.headers['cache-control']).toContain('no-cache');
  });

  it('los assets con hash son inmutables por un año', async () => {
    const res = await request(createApp({ webDist: carpeta })).get('/assets/app-abc123.js');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
    expect(res.headers['cache-control']).toContain('max-age=31536000');
  });

  it('una ruta inexistente de /api sigue dando 404 JSON', async () => {
    const res = await request(createApp({ webDist: carpeta })).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Recurso no encontrado' });
  });

  it('un método distinto de GET o HEAD da 404 JSON', async () => {
    const res = await request(createApp({ webDist: carpeta })).post('/mesa/x');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Recurso no encontrado' });
  });

  it('un asset faltante da 404 y no index.html', async () => {
    const res = await request(createApp({ webDist: carpeta })).get('/assets/no-existe.js');

    expect(res.status).toBe(404);
    expect(res.text).not.toContain('<title>PGIM</title>');
  });

  it('sirve index.html aunque la carpeta esté bajo un directorio oculto', async () => {
    const oculta = path.join(carpeta, '.oculta', 'dist');
    fs.mkdirSync(oculta, { recursive: true });
    fs.writeFileSync(path.join(oculta, 'index.html'), '<!doctype html><title>PGIM</title>');

    const res = await request(createApp({ webDist: oculta })).get('/mesa/x');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>PGIM</title>');
  });

  it('sin webDist, GET / da 404 JSON', async () => {
    const res = await request(createApp()).get('/');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Recurso no encontrado' });
  });
});
