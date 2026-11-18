import { PERMISOS, type RegistroRestaurante } from '@pgim/shared';
import { prisma } from '../lib/prisma';
import { limpiarBase } from '../test/db-setup';
import { restauranteRepository } from './restaurante.repository';
import { rolRepository } from './rol.repository';

afterAll(() => prisma.$disconnect());

const sucursal: RegistroRestaurante['sucursal'] = {
  nombre: 'Casa central',
  direccion: 'Calle Falsa 123',
  barrio: 'SAN_NICOLAS',
  horarioApertura: '12:00',
  horarioCierre: '23:30',
  toleranciaNoShowMin: 15,
  horariosServicio: [{ franja: 'CENA', horaInicio: '20:00', horaFin: '23:30' }],
};

async function crearRestaurante(cuit: string, email: string) {
  const { usuarioId } = await restauranteRepository.registrar({
    restaurante: { nombre: `Resto ${cuit}`, cuit },
    sucursal,
    administrador: { nombreCompleto: 'Ana Pérez', email, passwordHash: 'hash' },
  });
  const empleado = await prisma.empleado.findUniqueOrThrow({ where: { usuarioId } });
  const roles = await prisma.rol.findMany({ where: { restauranteId: empleado.restauranteId } });
  return { restauranteId: empleado.restauranteId, usuarioId, roles, rolAdminId: empleado.rolId };
}

describe('rolRepository: empleados y eliminación', () => {
  beforeEach(async () => {
    await limpiarBase();
    await prisma.permiso.createMany({
      data: PERMISOS.map(({ codigo, modulo, accion }) => ({ codigo, modulo, accion })),
    });
  });

  it('cuenta los empleados activos e inactivos y bloquea la eliminación', async () => {
    const { restauranteId, usuarioId, rolAdminId } = await crearRestaurante(
      '30712345678',
      'a@x.test',
    );
    await prisma.usuario.update({ where: { id: usuarioId }, data: { activo: false } });

    expect(await rolRepository.contarEmpleados(restauranteId, rolAdminId)).toEqual({
      activos: 0,
      inactivos: 1,
    });
    expect(await rolRepository.eliminar(restauranteId, rolAdminId)).toBe(false);
    expect(await rolRepository.buscar(restauranteId, rolAdminId)).not.toBeNull();
  });

  it('elimina un rol sin empleados junto con sus permisos', async () => {
    const { restauranteId, roles, rolAdminId } = await crearRestaurante('30712345678', 'a@x.test');
    const libre = roles.find((rol) => rol.id !== rolAdminId)!;

    expect(await rolRepository.eliminar(restauranteId, libre.id)).toBe(true);

    expect(await prisma.rol.count({ where: { id: libre.id } })).toBe(0);
    expect(await prisma.rolPermiso.count({ where: { rolId: libre.id } })).toBe(0);
  });

  it('lista solo empleados activos del restaurante y asigna sin cruzar tenants', async () => {
    const a = await crearRestaurante('30712345678', 'a@x.test');
    const b = await crearRestaurante('30711111118', 'b@x.test');
    const destino = a.roles.find((rol) => rol.id !== a.rolAdminId)!;

    const lista = await rolRepository.listarEmpleadosActivos(a.restauranteId);
    expect(lista.map((e) => e.id)).toEqual([a.usuarioId]);
    expect(lista[0]).toMatchObject({ email: 'a@x.test', rol: { id: a.rolAdminId } });
    expect(lista[0]!.sucursales).toHaveLength(1);

    await expect(
      rolRepository.asignarEmpleados(a.restauranteId, destino.id, [b.usuarioId]),
    ).rejects.toThrow();
    expect(await rolRepository.buscarEmpleadosActivos(a.restauranteId, [b.usuarioId])).toEqual([]);

    await rolRepository.asignarEmpleados(a.restauranteId, destino.id, [a.usuarioId]);
    expect(await rolRepository.contarEmpleados(a.restauranteId, destino.id)).toEqual({
      activos: 1,
      inactivos: 0,
    });
  });

  it('contarGestoresDeRoles excluye a todos los usuarios indicados', async () => {
    const { restauranteId, usuarioId } = await crearRestaurante('30712345678', 'a@x.test');

    expect(await rolRepository.contarGestoresDeRoles(restauranteId, {})).toBe(1);
    expect(
      await rolRepository.contarGestoresDeRoles(restauranteId, { usuarioIds: [usuarioId] }),
    ).toBe(0);
    expect(await rolRepository.contarGestoresDeRoles(restauranteId, { usuarioId })).toBe(0);
  });
});
