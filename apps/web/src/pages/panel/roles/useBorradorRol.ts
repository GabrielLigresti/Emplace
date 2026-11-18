import { useState } from 'react';
import type { Arquetipo, CodigoPermiso, Rol, RolInput } from '@pgim/shared';

// Lo que se edita en General y Permisos: una sola copia de trabajo para las dos pestañas.
export interface BorradorRol {
  nombre: string;
  arquetipo: Arquetipo;
  activo: boolean;
  permisos: CodigoPermiso[];
}

const VACIO: BorradorRol = { nombre: '', arquetipo: 'OTRO', activo: true, permisos: [] };

function desdeRol(rol: Rol | null): BorradorRol {
  if (!rol) return VACIO;
  return {
    nombre: rol.nombre,
    arquetipo: rol.arquetipo,
    activo: rol.activo,
    permisos: [...rol.permisos],
  };
}

function iguales(a: BorradorRol, b: BorradorRol): boolean {
  return (
    a.nombre.trim() === b.nombre.trim() &&
    a.arquetipo === b.arquetipo &&
    a.activo === b.activo &&
    a.permisos.length === b.permisos.length &&
    a.permisos.every((p) => b.permisos.includes(p))
  );
}

export function aRolInput(b: BorradorRol): RolInput {
  return { ...b, nombre: b.nombre.trim() };
}

// Borrador del rol contra lo guardado. `rol` es null en el modo "Crear rol".
// Si lo guardado cambia desde afuera (se recargó la lista), el borrador lo
// sigue solo cuando no tiene cambios propios.
export function useBorradorRol(rol: Rol | null) {
  const [guardado, setGuardado] = useState<BorradorRol>(() => desdeRol(rol));
  const [borrador, setBorrador] = useState<BorradorRol>(() => desdeRol(rol));
  const [rolVisto, setRolVisto] = useState(rol);

  if (rol !== rolVisto) {
    setRolVisto(rol);
    const nuevo = desdeRol(rol);
    if (iguales(borrador, guardado)) setBorrador(nuevo);
    setGuardado(nuevo);
  }

  return {
    borrador,
    hayCambios: !iguales(borrador, guardado),
    cambiar: (parcial: Partial<BorradorRol>) => setBorrador((b) => ({ ...b, ...parcial })),
    descartar: () => setBorrador(guardado),
    // Tras guardar, lo enviado pasa a ser lo guardado (sin esperar la recarga).
    marcarGuardado: (b: BorradorRol) => setGuardado({ ...b, nombre: b.nombre.trim() }),
  };
}
