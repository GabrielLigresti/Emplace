import type { Rol, RolInput } from '@pgim/shared';
import type { RolRepository } from '../../repositories/rol.repository';
import { createRolService } from './rol.service';

const R = 'restaurante';

const admin: Rol = {
  id: 'admin',
  nombre: 'Administrador',
  arquetipo: 'OTRO',
  predeterminado: true,
  activo: true,
  permisos: ['rol.ver', 'rol.editar'],
  cantidadEmpleados: 0,
};

const mozo: Rol = { ...admin, id: 'mozo', nombre: 'Mozo', permisos: ['pedido.ver'] };

function repoFalso(rol: Rol, gestores = 1): jest.Mocked<RolRepository> {
  return {
    listar: jest.fn(),
    buscar: jest.fn().mockResolvedValue(rol),
    existeNombre: jest.fn().mockResolvedValue(false),
    crear: jest.fn(),
    actualizar: jest.fn().mockResolvedValue(rol),
    desactivar: jest.fn(),
    contarEmpleados: jest.fn().mockResolvedValue({ activos: 0, inactivos: 0 }),
    eliminar: jest.fn().mockResolvedValue(true),
    listarEmpleadosActivos: jest.fn(),
    buscarEmpleadosActivos: jest.fn().mockResolvedValue([]),
    asignarEmpleados: jest.fn().mockResolvedValue(undefined),
    contarGestoresDeRoles: jest.fn().mockResolvedValue(gestores),
  };
}

const input = (rol: Rol, cambios: Partial<RolInput> = {}): RolInput => ({
  nombre: rol.nombre,
  arquetipo: rol.arquetipo,
  permisos: rol.permisos,
  ...cambios,
});

describe('rolService', () => {
  it('E1: rechaza un nombre repetido', async () => {
    const repo = repoFalso(mozo);
    repo.existeNombre.mockResolvedValue(true);

    await expect(createRolService(repo).crear(R, input(mozo))).rejects.toMatchObject({
      status: 409,
    });
  });

  it('E2: no deja quitar rol.editar si nadie más lo tiene', async () => {
    const repo = repoFalso(admin, 0);

    await expect(
      createRolService(repo).actualizar(R, 'admin', input(admin, { permisos: ['rol.ver'] })),
    ).rejects.toMatchObject({ status: 409 });
    expect(repo.contarGestoresDeRoles).toHaveBeenCalledWith(R, { rolId: 'admin' });
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('E2: tampoco deja quitar rol.ver, porque sin él nadie abre la pantalla de roles', async () => {
    const repo = repoFalso(admin, 0);

    await expect(
      createRolService(repo).actualizar(R, 'admin', input(admin, { permisos: ['rol.editar'] })),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('E2: deja quitarlo si otro usuario conserva la gestión de roles', async () => {
    const repo = repoFalso(admin, 1);

    await createRolService(repo).actualizar(R, 'admin', input(admin, { permisos: ['rol.ver'] }));

    expect(repo.actualizar).toHaveBeenCalled();
  });

  it('E2: no consulta gestores si el rol no gestionaba roles', async () => {
    const repo = repoFalso(mozo, 0);

    await createRolService(repo).actualizar(R, 'mozo', input(mozo, { nombre: 'Camarero' }));

    expect(repo.contarGestoresDeRoles).not.toHaveBeenCalled();
  });

  it('B: no da de baja un rol con empleados activos', async () => {
    const repo = repoFalso({ ...mozo, cantidadEmpleados: 2 });

    await expect(createRolService(repo).desactivar(R, 'mozo')).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('reasignalos'),
    });
    expect(repo.desactivar).not.toHaveBeenCalled();
  });

  it('B: tampoco por edición con activo en false', async () => {
    const repo = repoFalso({ ...mozo, cantidadEmpleados: 1 });

    await expect(
      createRolService(repo).actualizar(R, 'mozo', input(mozo, { activo: false })),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('da de baja un rol sin empleados', async () => {
    const repo = repoFalso(mozo);

    await createRolService(repo).desactivar(R, 'mozo');

    expect(repo.desactivar).toHaveBeenCalledWith(R, 'mozo');
  });

  it('agrupa el catálogo de permisos por módulo', () => {
    const grupos = createRolService(repoFalso(mozo)).permisosPorModulo();

    expect(grupos.find((g) => g.modulo === 'rol')?.permisos.map((p) => p.accion)).toEqual([
      'ver',
      'crear',
      'editar',
      'eliminar',
    ]);
  });

  it('autobloqueo: no deja que un usuario se quite la gestión de roles de su propio rol', async () => {
    const repo = repoFalso(admin, 5);

    await expect(
      createRolService(repo).actualizar(R, 'admin', input(admin, { permisos: ['rol.ver'] }), {
        id: 'yo',
        rolId: 'admin',
      }),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('perderías') });
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('autobloqueo: tampoco desactivando su propio rol', async () => {
    const repo = repoFalso(admin, 5);

    await expect(
      createRolService(repo).actualizar(R, 'admin', input(admin, { activo: false }), {
        id: 'yo',
        rolId: 'admin',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  describe('asignarEmpleados', () => {
    const gestor = (id: string) => ({
      id,
      rol: { id: 'admin', activo: true, permisos: admin.permisos },
    });
    const comun = (id: string) => ({
      id,
      rol: { id: 'otro', activo: true, permisos: mozo.permisos },
    });

    it('autobloqueo: no deja moverse a uno mismo a un rol sin gestión de roles', async () => {
      const repo = repoFalso(mozo);
      repo.buscarEmpleadosActivos.mockResolvedValue([gestor('yo')]);

      await expect(
        createRolService(repo).asignarEmpleados(R, 'mozo', ['yo'], { id: 'yo', rolId: 'admin' }),
      ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('perderías') });
      expect(repo.asignarEmpleados).not.toHaveBeenCalled();
    });

    it('E2: excluye a todos los movidos al contar los gestores que quedan', async () => {
      const repo = repoFalso(mozo, 0);
      repo.buscarEmpleadosActivos.mockResolvedValue([gestor('a'), gestor('b')]);

      await expect(
        createRolService(repo).asignarEmpleados(R, 'mozo', ['a', 'b'], { id: 'yo', rolId: 'x' }),
      ).rejects.toMatchObject({ status: 409 });
      expect(repo.contarGestoresDeRoles).toHaveBeenCalledWith(R, { usuarioIds: ['a', 'b'] });
      expect(repo.asignarEmpleados).not.toHaveBeenCalled();
    });

    it('E2: mueve si queda otro gestor', async () => {
      const repo = repoFalso(mozo, 1);
      repo.buscarEmpleadosActivos.mockResolvedValue([gestor('a'), comun('b')]);

      await createRolService(repo).asignarEmpleados(R, 'mozo', ['a', 'b'], {
        id: 'yo',
        rolId: 'x',
      });

      expect(repo.asignarEmpleados).toHaveBeenCalledWith(R, 'mozo', ['a', 'b']);
    });

    it('no consulta gestores si ninguno de los movidos gestionaba roles', async () => {
      const repo = repoFalso(mozo, 0);
      repo.buscarEmpleadosActivos.mockResolvedValue([comun('a')]);

      await createRolService(repo).asignarEmpleados(R, 'mozo', ['a'], { id: 'yo', rolId: 'x' });

      expect(repo.contarGestoresDeRoles).not.toHaveBeenCalled();
    });

    it('responde 404 si algún empleado no es del restaurante o está inactivo', async () => {
      const repo = repoFalso(mozo);
      repo.buscarEmpleadosActivos.mockResolvedValue([comun('a')]);

      await expect(
        createRolService(repo).asignarEmpleados(R, 'mozo', ['a', 'b'], { id: 'yo', rolId: 'x' }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('responde 409 si el rol destino está desactivado', async () => {
      const repo = repoFalso({ ...mozo, activo: false });

      await expect(
        createRolService(repo).asignarEmpleados(R, 'mozo', ['a'], { id: 'yo', rolId: 'x' }),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('eliminar', () => {
    it('se bloquea si hay empleados activos asignados', async () => {
      const repo = repoFalso(mozo);
      repo.contarEmpleados.mockResolvedValue({ activos: 2, inactivos: 1 });

      await expect(createRolService(repo).eliminar(R, 'mozo')).rejects.toMatchObject({
        status: 409,
        message: expect.stringContaining('2 empleado(s) activo(s)'),
      });
      expect(repo.eliminar).not.toHaveBeenCalled();
    });

    it('se bloquea si solo hay empleados dados de baja, y lo aclara', async () => {
      const repo = repoFalso(mozo);
      repo.contarEmpleados.mockResolvedValue({ activos: 0, inactivos: 3 });

      await expect(createRolService(repo).eliminar(R, 'mozo')).rejects.toMatchObject({
        status: 409,
        message: `El rol "${mozo.nombre}" tiene 3 empleado(s) dado(s) de baja asignado(s): cambiales el rol desde Personal antes de eliminarlo`,
      });
      expect(repo.eliminar).not.toHaveBeenCalled();
    });

    it('borra el rol sin empleados', async () => {
      const repo = repoFalso(mozo);

      await createRolService(repo).eliminar(R, 'mozo');

      expect(repo.eliminar).toHaveBeenCalledWith(R, 'mozo');
    });

    it('responde 409 si apareció un empleado durante la transacción', async () => {
      const repo = repoFalso(mozo);
      repo.eliminar.mockResolvedValue(false);

      await expect(createRolService(repo).eliminar(R, 'mozo')).rejects.toMatchObject({
        status: 409,
      });
    });
  });
});
