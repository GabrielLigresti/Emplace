import { API_PREFIX, VISTAS, type InformeCalidad, type VistaEscaneo } from '@pgim/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detalles?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// La cookie de sesión viaja sola: el front y la API comparten origen (proxy de Vite).
export async function api<T>(ruta: string, opciones: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${API_PREFIX}${ruta}`, {
    method: opciones.method ?? 'GET',
    headers: opciones.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
  });
  return leerRespuesta<T>(res);
}

// Sube un archivo como cuerpo binario (PUT), sin multipart.
export async function subirArchivo<T>(ruta: string, archivo: Blob) {
  const res = await fetch(`${API_PREFIX}${ruta}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: archivo,
  });
  return leerRespuesta<T>(res);
}

// Sube las 4 fotos de un escaneo (multipart): un archivo por vista, con el nombre de
// campo de la vista, y el informe de calidad como JSON en el campo `informe`.
export async function enviarFotos<T>(
  ruta: string,
  fotos: Record<VistaEscaneo, Blob>,
  informe: InformeCalidad,
) {
  const datos = new FormData();
  for (const vista of VISTAS) datos.append(vista, fotos[vista], `${vista}.jpg`);
  datos.append('informe', JSON.stringify(informe));
  const res = await fetch(`${API_PREFIX}${ruta}`, { method: 'POST', body: datos });
  return leerRespuesta<T>(res);
}

async function leerRespuesta<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  const datos: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const mensaje =
      datos && typeof datos === 'object' && 'error' in datos && typeof datos.error === 'string'
        ? datos.error
        : 'No se pudo conectar con el servidor';
    const detalles =
      datos && typeof datos === 'object' && 'detalles' in datos ? datos.detalles : undefined;
    throw new ApiError(res.status, mensaje, detalles);
  }
  return datos as T;
}
