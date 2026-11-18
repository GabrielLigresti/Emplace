import type { CodigoPermiso, EmpleadoDeRol, Rol, RolInput } from '@pgim/shared';
import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';
import { contarGestoresDeRoles, type ContarGestoresDeRoles } from './gestores-roles';

// Empleado activo con los datos de su rol actual, para decidir si moverlo es seguro.
export interface EmpleadoConRol {
  id: string;
  rol: { id: string; activo: boolean; permisos: CodigoPermiso[] };
}

export interface RolRepository {
  listar(restauranteId: string): Promise<Rol[]>;
  buscar(restauranteId: string, id: string): Promise<Rol | null>;
  existeNombre(restauranteId: string, nombre: string, excluirId?: string): Promise<boolean>;
  crear(restauranteId: string, datos: RolInput): Promise<Rol>;
  actualizar(restauranteId: string, id: string, datos: RolInput): Promise<Rol>;
  desactivar(restauranteId: string, id: string): Promise<void>;
  // Cuenta los empleados del rol por separado: activos y dados de baja.
  contarEmpleados(
    restauranteId: string,
    rolId: string,
  ): Promise<{ activos: number; inactivos: number }>;
  // Borra el rol en una transacción; false si apareció algún empleado asignado.
  eliminar(restauranteId: string, id: string): Promise<boolean>;
  listarEmpleadosActivos(restauranteId: string): Promise<EmpleadoDeRol[]>;
  buscarEmpleadosActivos(restauranteId: string, ids: string[]): Promise<EmpleadoConRol[]>;
  asignarEmpleados(restauranteId: string, rolId: string, empleadoIds: string[]): Promise<void>;
  contarGestoresDeRoles: ContarGestoresDeRoles;
}

const seleccion = {
  id: true,
  nombre: true,
  arquetipo: true,
  predeterminado: true,
  activo: true,
  permisos: { select: { permiso: { select: { codigo: true } } } },
  _count: { select: { empleados: { where: { usuario: { activo: true } } } } },
} satisfies Prisma.RolSelect;

type Fila = Prisma.RolGetPayload<{ select: typeof seleccion }>;

function aRol({ permisos, _count, ...fila }: Fila): Rol {
  return {
    ...fila,
    permisos: permisos.map(({ permiso }) => permiso.codigo as CodigoPermiso),
    cantidadEmpleados: _count.empleados,
  };
}

// El catálogo de permisos es global (no depende del restaurante).
async function permisosPorCodigo(codigos: CodigoPermiso[]) {
  const permisos = await prisma.permiso.findMany({
    where: { codigo: { in: codigos } },
    select: { id: true },
  });
  return permisos.map(({ id }) => ({ permisoId: id }));
}

export const rolRepository: RolRepository = {
  async listar(restauranteId) {
    const filas = await prisma.rol.findMany({
      where: { restauranteId },
      select: seleccion,
      orderBy: [{ activo: 'desc' }, { predeterminado: 'desc' }, { nombre: 'asc' }],
    });
    return filas.map(aRol);
  },

  async buscar(restauranteId, id) {
    const fila = await prisma.rol.findFirst({ where: { id, restauranteId }, select: seleccion });
    return fila && aRol(fila);
  },

  async existeNombre(restauranteId, nombre, excluirId) {
    const cantidad = await prisma.rol.count({
      where: {
        restauranteId,
        nombre: { equals: nombre, mode: 'insensitive' },
        ...(excluirId && { id: { not: excluirId } }),
      },
    });
    return cantidad > 0;
  },

  async crear(restauranteId, datos) {
    const fila = await prisma.rol.create({
      data: {
        restauranteId,
        nombre: datos.nombre,
        arquetipo: datos.arquetipo,
        permisos: { create: await permisosPorCodigo(datos.permisos) },
      },
      select: seleccion,
    });
    return aRol(fila);
  },

  async actualizar(restauranteId, id, datos) {
    const fila = await prisma.rol.update({
      where: { id, restauranteId },
      data: {
        nombre: datos.nombre,
        arquetipo: datos.arquetipo,
        ...(datos.activo !== undefined && { activo: datos.activo }),
        permisos: { deleteMany: {}, create: await permisosPorCodigo(datos.permisos) },
      },
      select: seleccion,
    });
    return aRol(fila);
  },

  async desactivar(restauranteId, id) {
    await prisma.rol.update({ where: { id, restauranteId }, data: { activo: false } });
  },

  async contarEmpleados(restauranteId, rolId) {
    const [activos, inactivos] = await Promise.all([
      prisma.empleado.count({ where: { restauranteId, rolId, usuario: { activo: true } } }),
      prisma.empleado.count({ where: { restauranteId, rolId, usuario: { activo: false } } }),
    ]);
    return { activos, inactivos };
  },

  async eliminar(restauranteId, id) {
    try {
      return await prisma.$transaction(async (tx) => {
        const asignados = await tx.empleado.count({ where: { restauranteId, rolId: id } });
        if (asignados > 0) return false;
        await tx.rol.delete({ where: { id, restauranteId } });
        return true;
      });
    } catch (error) {
      // Una asignación concurrente rompe la FK de empleado.rol_id: es un bloqueo, no un fallo.
      if ((error as { code?: string }).code === 'P2003') return false;
      throw error;
    }
  },

  async listarEmpleadosActivos(restauranteId) {
    const filas = await prisma.empleado.findMany({
      where: { restauranteId, usuario: { activo: true } },
      select: {
        usuarioId: true,
        nombreCompleto: true,
        usuario: { select: { email: true } },
        rol: { select: { id: true, nombre: true } },
        sucursales: {
          select: { sucursal: { select: { id: true, nombre: true } } },
          orderBy: { sucursal: { nombre: 'asc' } },
        },
      },
      orderBy: { nombreCompleto: 'asc' },
    });
    return filas.map((fila) => ({
      id: fila.usuarioId,
      nombreCompleto: fila.nombreCompleto,
      email: fila.usuario.email,
      rol: fila.rol,
      sucursales: fila.sucursales.map(({ sucursal }) => sucursal),
    }));
  },

  async buscarEmpleadosActivos(restauranteId, ids) {
    const filas = await prisma.empleado.findMany({
      where: { restauranteId, usuarioId: { in: ids }, usuario: { activo: true } },
      select: {
        usuarioId: true,
        rol: {
          select: {
            id: true,
            activo: true,
            permisos: { select: { permiso: { select: { codigo: true } } } },
          },
        },
      },
    });
    return filas.map((fila) => ({
      id: fila.usuarioId,
      rol: {
        id: fila.rol.id,
        activo: fila.rol.activo,
        permisos: fila.rol.permisos.map(({ permiso }) => permiso.codigo as CodigoPermiso),
      },
    }));
  },

  async asignarEmpleados(restauranteId, rolId, empleadoIds) {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.empleado.updateMany({
        where: { restauranteId, usuarioId: { in: empleadoIds } },
        data: { rolId },
      });
      if (count !== empleadoIds.length) throw new Error('Asignación incompleta');
    });
  },

  contarGestoresDeRoles,
};
