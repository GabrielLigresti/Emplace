import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { VISTAS, type VistaEscaneo } from '@pgim/shared';
import { env } from '../config/env';
import type { FotosEscaneo } from '../escaneo/proveedor-3d';

// Fotos del escaneo: cada escaneo tiene su carpeta con nombre aleatorio y una foto
// por vista. Nunca se sirven por HTTP; el proveedor las lee desde la ruta y
// después se borran.

export const CARPETA_ESCANEOS = path.resolve(env.UPLOADS_DIR, 'escaneos');

const archivoDe = (carpeta: string, vista: VistaEscaneo) => path.join(carpeta, `${vista}.jpg`);

export async function guardarFotos(fotos: FotosEscaneo): Promise<string> {
  const carpeta = path.join(CARPETA_ESCANEOS, randomUUID());
  await mkdir(carpeta, { recursive: true });
  try {
    for (const vista of VISTAS) await writeFile(archivoDe(carpeta, vista), fotos[vista]);
  } catch (e) {
    await rm(carpeta, { recursive: true, force: true });
    throw e;
  }
  return carpeta;
}

export async function leerFotos(ruta: string): Promise<FotosEscaneo> {
  const carpeta = path.resolve(ruta);
  const buffers = await Promise.all(VISTAS.map((v) => readFile(archivoDe(carpeta, v))));
  return Object.fromEntries(VISTAS.map((v, i) => [v, buffers[i]!])) as FotosEscaneo;
}

// Solo borra carpetas dentro de la de escaneos; una que ya no está no es error.
export async function borrarFotos(ruta: string | null): Promise<void> {
  if (!ruta) return;
  const absoluta = path.resolve(ruta);
  if (path.dirname(absoluta) !== CARPETA_ESCANEOS) return;
  await rm(absoluta, { recursive: true, force: true });
}
