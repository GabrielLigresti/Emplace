import { UMBRALES_POR_DEFECTO, VISTAS, type UmbralesCalidad } from '@pgim/shared';
import type { FotosEscaneo, Proveedor3D, ResultadoEscaneo } from './proveedor-3d';

// Proveedor real: sube las 4 fotos a Tripo, crea la tarea multivista y baja el
// .glb cuando termina. El detalle técnico va solo a console.error; el motivo
// que ve el staff es siempre el mismo.

const BASE_POR_DEFECTO = 'https://openapi.tripo3d.ai/v3';
const TIMEOUT_PEDIDO_MS = 30_000;
const TIMEOUT_DESCARGA_MS = 60_000;
const MOTIVO_FALLA = 'No pudimos armar el modelo con estas fotos';
// Códigos de Tripo que se resuelven reintentando.
const CODIGOS_TRANSITORIOS = new Set([1007, 2000]);

export interface OpcionesTripo {
  apiKey: string;
  fetch?: typeof fetch;
  baseUrl?: string;
}

interface RespuestaTripo {
  httpStatus: number;
  codigo?: number;
  requestId?: string;
  data?: Record<string, any>;
  ok: boolean;
}

class ErrorTripo extends Error {
  constructor(
    mensaje: string,
    readonly transitorio: boolean,
  ) {
    super(mensaje);
  }
}

export class ProveedorTripo implements Proveedor3D {
  readonly nombre = 'tripo';
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;

  constructor(opciones: OpcionesTripo) {
    this.apiKey = opciones.apiKey;
    this.fetchFn = opciones.fetch ?? fetch;
    this.baseUrl = (opciones.baseUrl ?? BASE_POR_DEFECTO).replace(/\/+$/, '');
  }

  requisitos(): UmbralesCalidad {
    return UMBRALES_POR_DEFECTO;
  }

  async iniciar(fotos: FotosEscaneo): Promise<string> {
    const tokens: string[] = [];
    for (const vista of VISTAS) {
      const form = new FormData();
      form.append(
        'file',
        new Blob([new Uint8Array(fotos[vista])], { type: 'image/jpeg' }),
        `${vista}.jpg`,
      );
      const r = await this.pedir('/files', { method: 'POST', body: form });
      const token = r.data?.file_token;
      if (typeof token !== 'string') throw this.errorDe('Tripo no devolvió file_token', r);
      tokens.push(token);
    }
    const r = await this.pedir('/generation/multiview-to-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: tokens.map((file_token) => ({ file_token })),
        model: 'v3.1-20260211',
        texture: true,
        pbr: true,
        texture_quality: 'standard',
        face_limit: 50000,
      }),
    });
    const id = r.data?.task_id;
    if (typeof id !== 'string') throw this.errorDe('Tripo no devolvió task_id', r);
    return id;
  }

  async consultar(tareaId: string): Promise<ResultadoEscaneo> {
    let r: RespuestaTripo;
    try {
      r = await this.pedir(`/tasks/${encodeURIComponent(tareaId)}`, { method: 'GET' });
    } catch (e) {
      if (e instanceof ErrorTripo && e.transitorio) {
        console.error(
          `Tripo: error transitorio al consultar la tarea, se reintenta (${e.message})`,
        );
        return { estado: 'EN_PROCESO' };
      }
      console.error(`Tripo: error al consultar la tarea (${(e as Error).message})`);
      return { estado: 'FALLIDO', motivo: MOTIVO_FALLA };
    }

    const estado = r.data?.status;
    if (estado === 'queued' || estado === 'running') return { estado: 'EN_PROCESO' };
    if (estado !== 'success') {
      console.error(
        `Tripo: la tarea terminó en "${String(estado)}" (request_id ${r.requestId ?? '-'})`,
      );
      return { estado: 'FALLIDO', motivo: MOTIVO_FALLA };
    }

    // Con pbr, Tripo puede dejar el modelo en pbr_model en lugar de model_url.
    const url = r.data?.output?.model_url || r.data?.output?.pbr_model;
    if (typeof url !== 'string' || !url) {
      console.error(`Tripo: la tarea terminó sin model_url (request_id ${r.requestId ?? '-'})`);
      return { estado: 'FALLIDO', motivo: MOTIVO_FALLA };
    }
    try {
      // El link del modelo es de una URL firmada que vence: no lleva la clave.
      const res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_DESCARGA_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { estado: 'LISTO', glb: Buffer.from(await res.arrayBuffer()) };
    } catch (e) {
      console.error(`Tripo: no se pudo bajar el modelo (${(e as Error).message})`);
      return { estado: 'FALLIDO', motivo: MOTIVO_FALLA };
    }
  }

  // Un pedido a la API: lanza ErrorTripo si no es exitoso (HTTP 2xx y code 0).
  private async pedir(ruta: string, init: RequestInit): Promise<RespuestaTripo> {
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}${ruta}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(TIMEOUT_PEDIDO_MS),
      });
    } catch (e) {
      // Timeout o error de red.
      throw new ErrorTripo(`sin respuesta de Tripo (${(e as Error).message})`, true);
    }
    let cuerpo: any;
    try {
      cuerpo = await res.json();
    } catch {
      cuerpo = undefined;
    }
    const r: RespuestaTripo = {
      httpStatus: res.status,
      codigo: typeof cuerpo?.code === 'number' ? cuerpo.code : undefined,
      requestId: typeof cuerpo?.request_id === 'string' ? cuerpo.request_id : undefined,
      data: cuerpo?.data,
      ok: res.ok && cuerpo?.code === 0,
    };
    if (!r.ok) throw this.errorDe('pedido rechazado', r);
    return r;
  }

  private errorDe(mensaje: string, r: RespuestaTripo): ErrorTripo {
    const transitorio =
      r.httpStatus === 429 ||
      r.httpStatus >= 500 ||
      (r.codigo !== undefined && CODIGOS_TRANSITORIOS.has(r.codigo));
    return new ErrorTripo(
      `Tripo: ${mensaje} (HTTP ${r.httpStatus}, code ${r.codigo ?? '-'}, request_id ${r.requestId ?? '-'})`,
      transitorio,
    );
  }
}
