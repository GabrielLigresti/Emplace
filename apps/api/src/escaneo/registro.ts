import { env } from '../config/env';
import { AppError } from '../lib/errors';
import type { Proveedor3D } from './proveedor-3d';
import { ProveedorSimulado } from './proveedor-simulado';
import { ProveedorTripo } from './proveedor-tripo';

export interface RegistroProveedores {
  // El que se usa para los escaneos nuevos.
  activo(): Proveedor3D;
  // Un escaneo en curso sigue con el proveedor con el que empezó.
  buscar(nombre: string): Proveedor3D;
}

export function crearRegistro(proveedores: Proveedor3D[], activo: string): RegistroProveedores {
  const porNombre = new Map(proveedores.map((p) => [p.nombre, p]));
  if (!porNombre.has(activo)) {
    throw new Error(`El proveedor 3D "${activo}" no está registrado`);
  }
  return {
    activo: () => porNombre.get(activo)!,
    buscar(nombre) {
      const proveedor = porNombre.get(nombre);
      if (!proveedor) throw new AppError(500, `Proveedor 3D desconocido: ${nombre}`);
      return proveedor;
    },
  };
}

// Tripo solo está disponible si hay clave; el simulado siempre.
export function proveedoresDisponibles(
  e: { TRIPO_API_KEY?: string; SIMULADO_DEMORA_MS: number; SIMULADO_FALLA: boolean },
  f?: typeof fetch,
): Proveedor3D[] {
  const proveedores: Proveedor3D[] = [
    new ProveedorSimulado({ demoraMs: e.SIMULADO_DEMORA_MS, fallar: e.SIMULADO_FALLA }),
  ];
  if (e.TRIPO_API_KEY) proveedores.push(new ProveedorTripo({ apiKey: e.TRIPO_API_KEY, fetch: f }));
  return proveedores;
}

export const registroProveedores: RegistroProveedores = crearRegistro(
  proveedoresDisponibles(env),
  env.PROVEEDOR_3D,
);
