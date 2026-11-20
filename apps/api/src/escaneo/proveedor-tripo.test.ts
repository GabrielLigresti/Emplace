import { VISTAS } from '@pgim/shared';
import { ProveedorTripo } from './proveedor-tripo';
import type { FotosEscaneo } from './proveedor-3d';

const BASE = 'https://openapi.tripo3d.ai/v3';
const MOTIVO = 'No pudimos armar el modelo con estas fotos';

// Formas reales del spike (con ids inventados).
const subida = (n: number) => ({
  code: 0,
  status: 'success',
  data: { file_token: `file_00000000-0000-0000-0000-00000000000${n}` },
});
const sinCredito = {
  code: 2010,
  status: 'error',
  message: "You don't have enough credit to create this task",
  suggestion: 'Please purchase more credit',
  request_id: '00000000-0000-0000-0000-0000000000aa',
};

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fotos = Object.fromEntries(VISTAS.map((v) => [v, Buffer.from(`foto-${v}`)])) as FotosEscaneo;

function armar(respuestas: Array<Response | Error>) {
  const llamadas: Array<{ url: string; init: RequestInit }> = [];
  const cola = [...respuestas];
  const fetchFalso = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({ url: String(url), init: init ?? {} });
    const r = cola.shift();
    if (!r) throw new Error('sin respuesta preparada');
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  return { proveedor: new ProveedorTripo({ apiKey: 'k', fetch: fetchFalso }), llamadas };
}

describe('ProveedorTripo', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());

  describe('iniciar', () => {
    it('sube 4 fotos y crea la tarea con model v3.1-20260211 y face_limit 50000', async () => {
      const { proveedor, llamadas } = armar([
        json(subida(1)),
        json(subida(2)),
        json(subida(3)),
        json(subida(4)),
        json({ code: 0, data: { task_id: 'tarea-1' } }),
      ]);
      await expect(proveedor.iniciar(fotos)).resolves.toBe('tarea-1');

      expect(llamadas).toHaveLength(5);
      llamadas.slice(0, 4).forEach((l) => {
        expect(l.url).toBe(`${BASE}/files`);
        expect(l.init.method).toBe('POST');
        expect((l.init.headers as Record<string, string>).Authorization).toBe('Bearer k');
        const archivo = (l.init.body as FormData).get('file') as Blob;
        expect(archivo.type).toBe('image/jpeg');
      });
      const crear = llamadas[4]!;
      expect(crear.url).toBe(`${BASE}/generation/multiview-to-model`);
      expect((crear.init.headers as Record<string, string>).Authorization).toBe('Bearer k');
      expect(JSON.parse(crear.init.body as string)).toEqual({
        inputs: [1, 2, 3, 4].map((n) => ({
          file_token: `file_00000000-0000-0000-0000-00000000000${n}`,
        })),
        model: 'v3.1-20260211',
        texture: true,
        pbr: true,
        texture_quality: 'standard',
        face_limit: 50000,
      });
    });

    it('lanza un error con code 2010 y HTTP 403', async () => {
      const { proveedor } = armar([
        json(subida(1)),
        json(subida(2)),
        json(subida(3)),
        json(subida(4)),
        json(sinCredito, 403),
      ]);
      await expect(proveedor.iniciar(fotos)).rejects.toThrow(
        /2010.*00000000-0000-0000-0000-0000000000aa/,
      );
    });

    it('lanza un error con code 2010 aunque el HTTP sea 200', async () => {
      const { proveedor } = armar([json(sinCredito, 200)]);
      await expect(proveedor.iniciar(fotos)).rejects.toThrow(/2010/);
    });

    it('lanza un error con 429', async () => {
      const { proveedor } = armar([json({ code: 2000, message: 'rate' }, 429)]);
      await expect(proveedor.iniciar(fotos)).rejects.toThrow(/429/);
    });

    it('no filtra la clave en el mensaje del error', async () => {
      const { proveedor } = armar([json(sinCredito, 403)]);
      await expect(proveedor.iniciar(fotos)).rejects.not.toThrow(/Bearer|\bk\b/);
    });
  });

  describe('consultar', () => {
    const tarea = (status: string, output?: unknown) =>
      json({ code: 0, data: { task_id: 't', status, output } });

    it('running da EN_PROCESO y queued también', async () => {
      const a = armar([tarea('running'), tarea('queued')]);
      await expect(a.proveedor.consultar('t')).resolves.toEqual({ estado: 'EN_PROCESO' });
      await expect(a.proveedor.consultar('t')).resolves.toEqual({ estado: 'EN_PROCESO' });
      expect(a.llamadas[0]!.url).toBe(`${BASE}/tasks/t`);
    });

    it('success baja model_url y da LISTO con el buffer, sin usdz', async () => {
      const glb = Buffer.from([1, 2, 3, 4]);
      const { proveedor, llamadas } = armar([
        tarea('success', { model_url: 'https://cdn.example/m.glb?firma=x' }),
        new Response(glb, { status: 200 }),
      ]);
      const r = await proveedor.consultar('t');
      expect(r.estado).toBe('LISTO');
      if (r.estado === 'LISTO') {
        expect(r.glb.equals(glb)).toBe(true);
        expect(r.usdz).toBeUndefined();
      }
      expect(llamadas[1]!.url).toBe('https://cdn.example/m.glb?firma=x');
      // La URL firmada no recibe la clave.
      expect(llamadas[1]!.init.headers).toBeUndefined();
    });

    it('failed, cancelled, banned, expired y un status desconocido dan FALLIDO', async () => {
      for (const s of ['failed', 'cancelled', 'banned', 'expired', 'raro']) {
        const { proveedor } = armar([tarea(s)]);
        await expect(proveedor.consultar('t')).resolves.toEqual({
          estado: 'FALLIDO',
          motivo: MOTIVO,
        });
      }
    });

    it('success sin model_url baja pbr_model', async () => {
      const glb = Buffer.from([5, 6]);
      const { proveedor, llamadas } = armar([
        tarea('success', { pbr_model: 'https://cdn.example/pbr.glb' }),
        new Response(glb, { status: 200 }),
      ]);
      const r = await proveedor.consultar('t');
      expect(r.estado).toBe('LISTO');
      expect(llamadas[1]!.url).toBe('https://cdn.example/pbr.glb');
    });

    it('success sin model_url ni pbr_model da FALLIDO', async () => {
      const { proveedor } = armar([tarea('success', {})]);
      await expect(proveedor.consultar('t')).resolves.toEqual({
        estado: 'FALLIDO',
        motivo: MOTIVO,
      });
    });

    it('503 da EN_PROCESO', async () => {
      const { proveedor } = armar([json({ code: 2000 }, 503)]);
      await expect(proveedor.consultar('t')).resolves.toEqual({ estado: 'EN_PROCESO' });
    });

    it('429 y el code 1007 dan EN_PROCESO', async () => {
      const a = armar([json({ code: 2000 }, 429), json({ code: 1007 }, 200)]);
      await expect(a.proveedor.consultar('t')).resolves.toEqual({ estado: 'EN_PROCESO' });
      await expect(a.proveedor.consultar('t')).resolves.toEqual({ estado: 'EN_PROCESO' });
    });

    it('un error de red da EN_PROCESO', async () => {
      const { proveedor } = armar([new TypeError('fetch failed')]);
      await expect(proveedor.consultar('t')).resolves.toEqual({ estado: 'EN_PROCESO' });
    });

    it('404 en la tarea da FALLIDO', async () => {
      const { proveedor } = armar([json({ code: 2001, message: 'no existe' }, 404)]);
      await expect(proveedor.consultar('t')).resolves.toEqual({
        estado: 'FALLIDO',
        motivo: MOTIVO,
      });
    });

    it('success con model_url que responde 403 da FALLIDO', async () => {
      const { proveedor } = armar([
        tarea('success', { model_url: 'https://cdn.example/m.glb' }),
        new Response('vencido', { status: 403 }),
      ]);
      await expect(proveedor.consultar('t')).resolves.toEqual({
        estado: 'FALLIDO',
        motivo: MOTIVO,
      });
    });

    it('una descarga con error de red da FALLIDO', async () => {
      const { proveedor } = armar([
        tarea('success', { model_url: 'https://cdn.example/m.glb' }),
        new TypeError('fetch failed'),
      ]);
      await expect(proveedor.consultar('t')).resolves.toEqual({
        estado: 'FALLIDO',
        motivo: MOTIVO,
      });
    });

    it('el detalle técnico va a console.error y no al motivo', async () => {
      const { proveedor } = armar([json({ code: 2001, request_id: 'req-9' }, 404)]);
      const r = await proveedor.consultar('t');
      expect(r).toEqual({ estado: 'FALLIDO', motivo: MOTIVO });
      expect(errorSpy.mock.calls.flat().join(' ')).toMatch(/404.*2001.*req-9/);
    });
  });
});
