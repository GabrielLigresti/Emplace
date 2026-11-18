import {
  PERMISOS,
  gestionaRoles as tienePermisosDeGestion,
  type GrupoPermisos,
  type Rol,
  type RolInput,
} from '@pgim/shared';
import { AppError } from '../../lib/errors';
import { rolRepository, type RolRepository } from '../../repositories/rol.repository';
import { verificarGestorDeRoles } from './gestion-roles';

// Catálogo agrupado por módulo, para el formulario de roles (Permiso.listarPorModulo).
function permisosPorModulo(): GrupoPermisos[] {
  const grupos = new Map<string, GrupoPermisos>();
  for (const { codigo, modulo, accion } of PERMISOS) {
    const grupo = grupos.get(modulo) ?? { modulo, permisos: [] };
    grupo.permisos.push({ codigo, accion });
    grupos.set(modulo, grupo);
  }
  return [...grupos.values()];
}

// Quien hace el pedido: su rol sale de la sesión.
export interface UsuarioActual {
  id: string;
  rolId: string | null;
}

const MENSAJE_AUTOBLOQUEO =
  'No podés quitarte el permiso de gestionar roles: perderías el acceso a esta pantalla';

export function createRolService(repo: RolRepository) {
  async function obtener(restauranteId: string, id: string): Promise<Rol> {
    const rol = await repo.buscar(restauranteId, id);
    if (!rol) throw new AppError(404, 'El rol no existe');
    return rol;
  }

  // E1: nombre único dentro del restaurante.
  async function verificarNombre(restauranteId: string, nombre: string, excluirId?: string) {
    if (await repo.existeNombre(restauranteId, nombre, excluirId)) {
      throw new AppError(409, `Ya existe un rol llamado "${nombre}"`);
    }
  }

  // Flujo B: un rol con empleados activos no se da de baja hasta reasignarlos.
  function verificarSinEmpleados(rol: Rol) {
    if (rol.cantidadEmpleados > 0) {
      throw new AppError(
        409,
        `El rol "${rol.nombre}" tiene ${rol.cantidadEmpleados} empleado(s) activo(s): reasignalos a otro rol antes de darlo de baja`,
      );
    }
  }

  const gestionaRoles = (rol: Rol) => rol.activo && tienePermisosDeGestion(rol.permisos);

  return {
    listar: (restauranteId: string) => repo.listar(restauranteId),

    permisosPorModulo,

    async crear(restauranteId: string, datos: RolInput) {
      await verificarNombre(restauranteId, datos.nombre);
      return repo.crear(restauranteId, datos);
    },

    async actualizar(restauranteId: string, id: string, datos: RolInput, actual?: UsuarioActual) {
      const rol = await obtener(restauranteId, id);
      await verificarNombre(restauranteId, datos.nombre, id);

      const seDesactiva = rol.activo && datos.activo === false;
      if (seDesactiva) verificarSinEmpleados(rol);

      const sigueGestionando = datos.activo !== false && tienePermisosDeGestion(datos.permisos);
      // Autobloqueo: nadie se quita a sí mismo el acceso a la pantalla de roles.
      if (actual?.rolId === id && gestionaRoles(rol) && !sigueGestionando) {
        throw new AppError(409, MENSAJE_AUTOBLOQUEO);
      }
      // E2: el cambio no puede dejar al restaurante sin nadie que gestione roles.
      if (gestionaRoles(rol) && !sigueGestionando) {
        await verificarGestorDeRoles(repo.contarGestoresDeRoles, restauranteId, { rolId: id });
      }
      return repo.actualizar(restauranteId, id, datos);
    },

    // Baja física: solo si ningún empleado, activo o inactivo, referencia el rol.
    async eliminar(restauranteId: string, id: string) {
      const rol = await obtener(restauranteId, id);
      const asignados = await repo.contarEmpleados(restauranteId, id);
      const bloqueado = () =>
        new AppError(
          409,
          `El rol "${rol.nombre}" tiene ${asignados} empleado(s) asignado(s): reasignalos a otro rol antes de eliminarlo`,
        );
      if (asignados > 0) throw bloqueado();
      if (!(await repo.eliminar(restauranteId, id))) throw bloqueado();
    },

    listarEmpleados: (restauranteId: string) => repo.listarEmpleadosActivos(restauranteId),

    // Pasa los empleados al rol destino en una sola transacción.
    async asignarEmpleados(
      restauranteId: string,
      id: string,
      empleadoIds: string[],
      actual: UsuarioActual,
    ) {
      const destino = await obtener(restauranteId, id);
      if (!destino.activo) {
        throw new AppError(409, `El rol "${destino.nombre}" está desactivado: activalo primero`);
      }
      const ids = [...new Set(empleadoIds)];
      const empleados = await repo.buscarEmpleadosActivos(restauranteId, ids);
      if (empleados.length !== ids.length) {
        throw new AppError(404, 'Alguno de los empleados no existe o está inactivo');
      }

      if (!gestionaRoles(destino)) {
        if (ids.includes(actual.id)) throw new AppError(409, MENSAJE_AUTOBLOQUEO);
        // E2: al menos otro gestor tiene que quedar fuera de los movidos.
        const gestoresMovidos = empleados.filter(
          ({ rol }) => rol.activo && tienePermisosDeGestion(rol.permisos),
        );
        if (gestoresMovidos.length > 0) {
          await verificarGestorDeRoles(repo.contarGestoresDeRoles, restauranteId, {
            usuarioIds: ids,
          });
        }
      }
      await repo.asignarEmpleados(restauranteId, id, ids);
    },

    async desactivar(restauranteId: string, id: string) {
      const actual = await obtener(restauranteId, id);
      if (!actual.activo) return;
      verificarSinEmpleados(actual);
      if (gestionaRoles(actual)) {
        await verificarGestorDeRoles(repo.contarGestoresDeRoles, restauranteId, { rolId: id });
      }
      await repo.desactivar(restauranteId, id);
    },
  };
}

export const rolService = createRolService(rolRepository);
