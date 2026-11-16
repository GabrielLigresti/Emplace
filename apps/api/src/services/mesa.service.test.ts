import type { Mesa, MesaInput } from '@pgim/shared';
import type { MesaRepository } from '../repositories/mesa.repository';
import type { BusEventos } from '../domain/eventos';
import { createMesaService } from './mesa.service';

const R = 'restaurante';

const mesa: Mesa = {
  id: 'm1',
  numero: 1,
  capacidad: 4,
  posX: 10,
  posY: 15,
  vertical: false,
  activa: true,
};
const datos: MesaInput = { numero: 1, capacidad: 4, posX: 10, posY: 15, vertical: false };

function repoFalso(cambios: Partial<MesaRepository> = {}): jest.Mocked<MesaRepository> {
  return {
    listar: jest.fn().mockResolvedValue([]),
    existeSucursal: jest.fn().mockResolvedValue(true),
    buscar: jest.fn().mockResolvedValue(mesa),
    existeNumero: jest.fn().mockResolvedValue(false),
    crear: jest.fn().mockResolvedValue(mesa),
    actualizar: jest.fn().mockResolvedValue(mesa),
    desactivar: jest.fn(),
    reservasVigentes: jest.fn().mockResolvedValue([]),
    actualizarPosiciones: jest.fn().mockResolvedValue(undefined),
    ...cambios,
  } as jest.Mocked<MesaRepository>;
}

describe('mesaService', () => {
  it('una sucursal de otro restaurante responde 404', async () => {
    const repo = repoFalso({ existeSucursal: jest.fn().mockResolvedValue(false) });

    await expect(createMesaService(repo).crear(R, 'ajena', datos)).rejects.toMatchObject({
      status: 404,
    });
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('rechaza un número de mesa repetido en la sucursal', async () => {
    const repo = repoFalso({ existeNumero: jest.fn().mockResolvedValue(true) });

    await expect(createMesaService(repo).crear(R, 'centro', datos)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('al editar, el número se compara con las demás mesas', async () => {
    const repo = repoFalso();

    await createMesaService(repo).actualizar(R, 'centro', 'm1', datos);

    expect(repo.existeNumero).toHaveBeenCalledWith(R, 'centro', 1, 'm1');
    expect(repo.actualizar).toHaveBeenCalledWith(R, 'centro', 'm1', datos);
  });

  it('editar una mesa que no existe responde 404', async () => {
    const repo = repoFalso({ buscar: jest.fn().mockResolvedValue(null) });

    await expect(
      createMesaService(repo).actualizar(R, 'centro', 'otra', datos),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('quien solo ve sucursales no ve el salón de una sucursal no asignada', async () => {
    const repo = repoFalso();

    await expect(
      createMesaService(repo).listar(R, ['sucursal.ver'], ['otra'], 'centro'),
    ).rejects.toMatchObject({ status: 404 });
    expect(repo.listar).not.toHaveBeenCalled();
  });

  it('quien administra sucursales ve el salón de cualquiera', async () => {
    const repo = repoFalso();

    await createMesaService(repo).listar(R, ['sucursal.ver', 'sucursal.editar'], [], 'centro');

    expect(repo.listar).toHaveBeenCalledWith(R, 'centro');
  });

  it('la baja es lógica', async () => {
    const repo = repoFalso();

    await createMesaService(repo).desactivar(R, 'centro', 'm1');

    expect(repo.desactivar).toHaveBeenCalledWith(R, 'centro', 'm1');
  });

  it('crea la mesa acotada al restaurante', async () => {
    const repo = repoFalso();

    await createMesaService(repo).crear(R, 'centro', datos);

    expect(repo.existeNumero).toHaveBeenCalledWith(R, 'centro', 1, undefined);
    expect(repo.crear).toHaveBeenCalledWith(R, 'centro', datos);
  });

  describe('geometría', () => {
    // Vecina 2 de 4 personas pegada a la derecha de `mesa` (x de 17,5 a 32,5).
    const vecina: Mesa = { ...mesa, id: 'm2', numero: 2, posX: 25, posY: 15 };
    const conVecina = (cambios: Partial<MesaRepository> = {}) =>
      repoFalso({ listar: jest.fn().mockResolvedValue([mesa, vecina]), ...cambios });

    it('crear fuera del lienzo responde 409', async () => {
      const repo = repoFalso();

      await expect(
        createMesaService(repo).crear(R, 'centro', { ...datos, posX: 3 }),
      ).rejects.toMatchObject({ status: 409, message: 'La mesa no entra en el salón' });
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('crear con el borde justo sobre el lienzo se permite', async () => {
      const repo = repoFalso();

      await createMesaService(repo).crear(R, 'centro', { ...datos, posX: 7.5, posY: 5 });

      expect(repo.crear).toHaveBeenCalled();
    });

    it('crear encima de otra mesa activa responde 409', async () => {
      const repo = repoFalso({ listar: jest.fn().mockResolvedValue([mesa]) });

      await expect(
        createMesaService(repo).crear(R, 'centro', { ...datos, numero: 2, posX: 12 }),
      ).rejects.toMatchObject({ status: 409, message: 'Se superpone con la mesa 1' });
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('crear con un solape de 0,1 responde 409', async () => {
      const repo = repoFalso({ listar: jest.fn().mockResolvedValue([mesa]) });

      await expect(
        createMesaService(repo).crear(R, 'centro', { ...datos, numero: 2, posX: 24.9 }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('crear con borde compartido se permite', async () => {
      const repo = repoFalso({ listar: jest.fn().mockResolvedValue([mesa]) });

      await createMesaService(repo).crear(R, 'centro', { ...datos, numero: 2, posX: 25 });

      expect(repo.crear).toHaveBeenCalled();
    });

    it('una mesa dada de baja en ese lugar no cuenta', async () => {
      const repo = repoFalso({
        listar: jest.fn().mockResolvedValue([{ ...mesa, activa: false }]),
      });

      await createMesaService(repo).crear(R, 'centro', { ...datos, numero: 2 });

      expect(repo.crear).toHaveBeenCalled();
    });

    it('crear una mesa inactiva no valida su geometría', async () => {
      const repo = repoFalso({ listar: jest.fn().mockResolvedValue([mesa]) });

      await createMesaService(repo).crear(R, 'centro', { ...datos, numero: 2, activa: false });

      expect(repo.crear).toHaveBeenCalled();
    });

    it('subir la capacidad de 4 a 8 contra una vecina responde 409', async () => {
      // Pegada por la derecha: 4 personas ocupa de 12,5 a 27,5 y 8 personas de 7 a 33.
      const centrada = { ...mesa, posX: 20 };
      const pegada: Mesa = { ...vecina, posX: 35 };
      const repo = repoFalso({
        buscar: jest.fn().mockResolvedValue(centrada),
        listar: jest.fn().mockResolvedValue([centrada, pegada]),
      });

      await expect(
        createMesaService(repo).actualizar(R, 'centro', 'm1', {
          ...datos,
          posX: 20,
          capacidad: 8,
        }),
      ).rejects.toMatchObject({ status: 409, message: 'Se superpone con la mesa 2' });
      expect(repo.actualizar).not.toHaveBeenCalled();
    });

    it('girar contra una vecina responde 409', async () => {
      // De 15x10 a 10x15: de 5 a 15 en x y de 7,5 a 22,5 en y; la vecina cubre y de 10 a 20 desde x 17,5.
      const repo = repoFalso({
        listar: jest.fn().mockResolvedValue([mesa, { ...vecina, posX: 18, posY: 15 }]),
      });

      await expect(
        createMesaService(repo).actualizar(R, 'centro', 'm1', { ...datos, vertical: true }),
      ).rejects.toMatchObject({ status: 409, message: 'Se superpone con la mesa 2' });
    });

    it('girar sin choque se guarda', async () => {
      const repo = repoFalso({ listar: jest.fn().mockResolvedValue([mesa]) });
      const girada = { ...datos, vertical: true };

      await createMesaService(repo).actualizar(R, 'centro', 'm1', girada);

      expect(repo.actualizar).toHaveBeenCalledWith(R, 'centro', 'm1', girada);
    });

    it('la mesa que se edita no choca consigo misma', async () => {
      const repo = repoFalso({ listar: jest.fn().mockResolvedValue([mesa]) });

      await createMesaService(repo).actualizar(R, 'centro', 'm1', { ...datos, posX: 12 });

      expect(repo.actualizar).toHaveBeenCalled();
    });

    it('sin vertical en los datos se conserva la orientación guardada', async () => {
      // Vertical ocupa de 15 a 25 en x; horizontal iría de 12,5 a 27,5 y pisaría a la vecina (desde 25,5).
      const girada = { ...mesa, posX: 20, vertical: true };
      const lejana: Mesa = { ...vecina, posX: 33 };
      const repo = repoFalso({
        buscar: jest.fn().mockResolvedValue(girada),
        listar: jest.fn().mockResolvedValue([girada, lejana]),
      });
      const { vertical: _omitido, ...sinVertical } = datos;

      await createMesaService(repo).actualizar(R, 'centro', 'm1', { ...sinVertical, posX: 20 });

      expect(repo.actualizar).toHaveBeenCalled();
      await expect(
        createMesaService(repo).actualizar(R, 'centro', 'm1', {
          ...sinVertical,
          posX: 20,
          vertical: false,
        }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('una mesa dada de baja que sigue dada de baja se guarda sin validar', async () => {
      const repo = conVecina({
        buscar: jest.fn().mockResolvedValue({ ...mesa, activa: false }),
      });

      await createMesaService(repo).actualizar(R, 'centro', 'm1', {
        ...datos,
        activa: false,
        posX: 25,
      });

      expect(repo.actualizar).toHaveBeenCalled();
    });

    it('una mesa dada de baja sin el campo activa tampoco se valida', async () => {
      const repo = conVecina({
        buscar: jest.fn().mockResolvedValue({ ...mesa, activa: false }),
      });

      await createMesaService(repo).actualizar(R, 'centro', 'm1', { ...datos, posX: 25 });

      expect(repo.actualizar).toHaveBeenCalled();
    });

    it('reactivar en un lugar tomado responde 409', async () => {
      const repo = conVecina({
        buscar: jest.fn().mockResolvedValue({ ...mesa, activa: false }),
      });

      await expect(
        createMesaService(repo).actualizar(R, 'centro', 'm1', {
          ...datos,
          activa: true,
          posX: 25,
        }),
      ).rejects.toMatchObject({ status: 409, message: 'Se superpone con la mesa 2' });
    });

    it('reactivar en un lugar libre se guarda', async () => {
      const repo = repoFalso({
        buscar: jest.fn().mockResolvedValue({ ...mesa, activa: false }),
        listar: jest.fn().mockResolvedValue([vecina]),
      });

      await createMesaService(repo).actualizar(R, 'centro', 'm1', { ...datos, activa: true });

      expect(repo.actualizar).toHaveBeenCalled();
    });

    it('una capacidad fuera de la lista (3, 5 o 20) no rompe la validación', async () => {
      // La vecina empieza en x 31: 3 personas (15 a 25) y 5 (10 a 30) caben; 20 (7 a 33) la pisa.
      const centrada = { ...mesa, posX: 20 };
      const derecha: Mesa = { ...vecina, posX: 38.5 };
      const repo = repoFalso({
        buscar: jest.fn().mockResolvedValue(centrada),
        listar: jest.fn().mockResolvedValue([centrada, derecha]),
      });
      const con = (capacidad: number) =>
        createMesaService(repo).actualizar(R, 'centro', 'm1', { ...datos, posX: 20, capacidad });

      await expect(con(3)).resolves.toBeDefined();
      await expect(con(5)).resolves.toBeDefined();
      await expect(con(20)).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('mesa ocupada por una reserva activa', () => {
    // Activa de una franja que ya terminó: igual la mesa está en uso hasta que se cierre.
    const AHORA = new Date('2026-10-30T20:00:00.000Z');
    const activa = {
      estado: 'ACTIVA' as const,
      inicio: new Date('2026-10-29T23:00:00.000Z'),
      cantidadPersonas: 2,
      toleranciaNoShowMin: 15,
    };
    const ocupada = () => repoFalso({ reservasVigentes: jest.fn().mockResolvedValue([activa]) });
    const servicio = (repo: MesaRepository) => createMesaService(repo, () => AHORA);
    const MENSAJE = 'La mesa está ocupada: movela cuando se cierre';

    it.each([
      ['posX', { posX: 40 }],
      ['posY', { posY: 30 }],
      ['vertical', { vertical: true }],
    ])('cambiar %s responde 409', async (_campo, cambio) => {
      const repo = ocupada();

      await expect(
        servicio(repo).actualizar(R, 'centro', 'm1', { ...datos, ...cambio }),
      ).rejects.toMatchObject({ status: 409, message: MENSAJE });
      expect(repo.actualizar).not.toHaveBeenCalled();
    });

    it('cambiar solo el número o subir la capacidad sin choque se guarda', async () => {
      const repo = ocupada();

      await servicio(repo).actualizar(R, 'centro', 'm1', { ...datos, numero: 5 });
      await servicio(repo).actualizar(R, 'centro', 'm1', { ...datos, capacidad: 6 });

      expect(repo.actualizar).toHaveBeenCalledTimes(2);
    });

    it('subir la capacidad contra una vecina sigue chocando', async () => {
      const centrada = { ...mesa, posX: 20 };
      const vecina: Mesa = { ...mesa, id: 'm2', numero: 2, posX: 35 };
      const repo = repoFalso({
        buscar: jest.fn().mockResolvedValue(centrada),
        reservasVigentes: jest.fn().mockResolvedValue([activa]),
        listar: jest.fn().mockResolvedValue([centrada, vecina]),
      });

      await expect(
        servicio(repo).actualizar(R, 'centro', 'm1', { ...datos, posX: 20, capacidad: 8 }),
      ).rejects.toMatchObject({ status: 409, message: 'Se superpone con la mesa 2' });
    });

    it('una reserva pendiente no fija la mesa', async () => {
      const repo = repoFalso({
        reservasVigentes: jest
          .fn()
          .mockResolvedValue([
            { ...activa, estado: 'PENDIENTE', inicio: new Date('2026-10-30T23:00:00.000Z') },
          ]),
      });

      await servicio(repo).actualizar(R, 'centro', 'm1', { ...datos, posX: 40 });

      expect(repo.actualizar).toHaveBeenCalled();
    });
  });

  describe('con reservas vigentes', () => {
    // 17:00 del 30/10 en Argentina.
    const AHORA = new Date('2026-10-30T20:00:00.000Z');
    const reserva = (estado: 'PENDIENTE' | 'ACTIVA', inicio: string, cantidadPersonas = 3) => ({
      estado,
      inicio: new Date(inicio),
      cantidadPersonas,
      toleranciaNoShowMin: 15,
    });
    // Una para 3 personas a las 20:00 de hoy.
    const conReservas = (filas = [reserva('PENDIENTE', '2026-10-30T23:00:00.000Z')]) =>
      repoFalso({ reservasVigentes: jest.fn().mockResolvedValue(filas) });
    const servicio = (repo: MesaRepository) => createMesaService(repo, () => AHORA);

    it('no se da de baja', async () => {
      const repo = conReservas();

      await expect(servicio(repo).desactivar(R, 'centro', 'm1')).rejects.toMatchObject({
        status: 409,
      });
      expect(repo.desactivar).not.toHaveBeenCalled();
    });

    it('tampoco por edición con activa en false', async () => {
      const repo = conReservas();

      await expect(
        servicio(repo).actualizar(R, 'centro', 'm1', { ...datos, activa: false }),
      ).rejects.toMatchObject({ status: 409 });
      expect(repo.actualizar).not.toHaveBeenCalled();
    });

    it('no se achica por debajo del grupo más grande que la tiene reservada', async () => {
      const repo = conReservas();

      await expect(
        servicio(repo).actualizar(R, 'centro', 'm1', { ...datos, capacidad: 2 }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('se puede mover o achicar hasta ese grupo', async () => {
      const repo = conReservas();

      await servicio(repo).actualizar(R, 'centro', 'm1', { ...datos, capacidad: 3, posX: 40 });

      expect(repo.actualizar).toHaveBeenCalled();
    });

    it('mover una mesa con una reserva mayor que su capacidad no cuenta como achicarla', async () => {
      const repo = conReservas([reserva('PENDIENTE', '2026-10-30T23:00:00.000Z', 12)]);

      await servicio(repo).actualizar(R, 'centro', 'm1', { ...datos, posX: 40 });

      expect(repo.actualizar).toHaveBeenCalled();
    });

    it('achicar por debajo de esa reserva mayor sigue respondiendo 409', async () => {
      const repo = conReservas([reserva('PENDIENTE', '2026-10-30T23:00:00.000Z', 12)]);

      await expect(
        servicio(repo).actualizar(R, 'centro', 'm1', { ...datos, capacidad: 2 }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('una activa de una franja que ya terminó no la traba', async () => {
      const repo = conReservas([reserva('ACTIVA', '2026-10-29T23:00:00.000Z', 8)]);

      await servicio(repo).desactivar(R, 'centro', 'm1');

      expect(repo.desactivar).toHaveBeenCalled();
    });

    it('una pendiente pasada la tolerancia (a punto de vencer) no la traba', async () => {
      const repo = conReservas([reserva('PENDIENTE', '2026-10-30T19:00:00.000Z', 8)]);

      await servicio(repo).actualizar(R, 'centro', 'm1', { ...datos, capacidad: 2 });

      expect(repo.actualizar).toHaveBeenCalled();
    });

    it('el grupo más grande se toma solo de las reservas que todavía la ocupan', async () => {
      const filas = [
        reserva('ACTIVA', '2026-10-29T23:00:00.000Z', 8),
        reserva('PENDIENTE', '2026-10-30T23:00:00.000Z', 3),
      ];

      await servicio(conReservas(filas)).actualizar(R, 'centro', 'm1', { ...datos, capacidad: 3 });
      await expect(
        servicio(conReservas(filas)).actualizar(R, 'centro', 'm1', { ...datos, capacidad: 2 }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('dar de baja otra vez una mesa ya inactiva no falla', async () => {
      const repo = conReservas();
      repo.buscar.mockResolvedValue({ ...mesa, activa: false });

      await servicio(repo).desactivar(R, 'centro', 'm1');

      expect(repo.desactivar).toHaveBeenCalled();
    });

    it('una mesa que ya estaba dada de baja se puede mover', async () => {
      const repo = conReservas();
      repo.buscar.mockResolvedValue({ ...mesa, activa: false });

      await servicio(repo).actualizar(R, 'centro', 'm1', { ...datos, activa: false, posX: 40 });

      expect(repo.actualizar).toHaveBeenCalled();
    });
  });

  describe('distribuir', () => {
    // Dos mesas de 4 personas (15x10) bien separadas, y una de 2 (10x8) abajo.
    const a: Mesa = { ...mesa, id: 'a', numero: 1, posX: 20, posY: 15 };
    const b: Mesa = { ...mesa, id: 'b', numero: 2, posX: 60, posY: 15 };
    const c: Mesa = { ...mesa, id: 'c', numero: 3, capacidad: 2, posX: 20, posY: 45 };
    const busFalso = () =>
      ({ publicar: jest.fn(), suscribir: jest.fn() }) as jest.Mocked<BusEventos>;
    const salon = (mesas: Mesa[] = [a, b, c], cambios: Partial<MesaRepository> = {}) =>
      repoFalso({ listar: jest.fn().mockResolvedValue(mesas), ...cambios });
    const activa = {
      estado: 'ACTIVA' as const,
      inicio: new Date('2026-10-29T23:00:00.000Z'),
      cantidadPersonas: 2,
      toleranciaNoShowMin: 15,
    };

    it('intercambiar la posición de dos mesas pasa aunque cada una caiga donde estaba la otra', async () => {
      const repo = salon();
      const cambios = [
        { id: 'a', posX: 60, posY: 15 },
        { id: 'b', posX: 20, posY: 15 },
      ];

      await createMesaService(repo).distribuir(R, 'centro', cambios);

      expect(repo.actualizarPosiciones).toHaveBeenCalledWith(R, 'centro', cambios);
    });

    it('responde con las mesas de la sucursal leídas después de escribir', async () => {
      const repo = salon();

      const res = await createMesaService(repo).distribuir(R, 'centro', [
        { id: 'a', posX: 30, posY: 15 },
      ]);

      expect(res).toEqual([a, b, c]);
      expect(repo.listar.mock.invocationCallOrder.at(-1)!).toBeGreaterThan(
        repo.actualizarPosiciones.mock.invocationCallOrder[0]!,
      );
    });

    it('una sucursal de otro restaurante responde 404', async () => {
      const repo = salon([a], { existeSucursal: jest.fn().mockResolvedValue(false) });

      await expect(
        createMesaService(repo).distribuir(R, 'ajena', [{ id: 'a', posX: 30, posY: 15 }]),
      ).rejects.toMatchObject({ status: 404, message: 'La sucursal no existe' });
      expect(repo.actualizarPosiciones).not.toHaveBeenCalled();
    });

    it('una mesa inexistente responde 404 y no escribe', async () => {
      const repo = salon();

      await expect(
        createMesaService(repo).distribuir(R, 'centro', [
          { id: 'a', posX: 30, posY: 15 },
          { id: 'zzz', posX: 40, posY: 15 },
        ]),
      ).rejects.toMatchObject({ status: 404, message: 'La mesa no existe' });
      expect(repo.actualizarPosiciones).not.toHaveBeenCalled();
    });

    it('chocar con una mesa que no se movió responde 409', async () => {
      const repo = salon();

      await expect(
        createMesaService(repo).distribuir(R, 'centro', [{ id: 'a', posX: 50, posY: 15 }]),
      ).rejects.toMatchObject({ status: 409, message: 'La mesa 1 se superpone con la mesa 2' });
      expect(repo.actualizarPosiciones).not.toHaveBeenCalled();
    });

    it('dos mesas movidas que terminan una sobre otra responden 409', async () => {
      const repo = salon();

      await expect(
        createMesaService(repo).distribuir(R, 'centro', [
          { id: 'a', posX: 40, posY: 40 },
          { id: 'c', posX: 42, posY: 40 },
        ]),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('fuera del lienzo responde 409', async () => {
      const repo = salon();

      await expect(
        createMesaService(repo).distribuir(R, 'centro', [{ id: 'a', posX: 3, posY: 15 }]),
      ).rejects.toMatchObject({ status: 409, message: 'La mesa 1 no entra en el salón' });
      expect(repo.actualizarPosiciones).not.toHaveBeenCalled();
    });

    it('una mesa con reserva activa que se mueve responde 409 y no escribe', async () => {
      const repo = salon([a, b, c], {
        reservasVigentes: jest.fn().mockResolvedValue([activa]),
      });

      await expect(
        createMesaService(repo).distribuir(R, 'centro', [{ id: 'a', posX: 30, posY: 15 }]),
      ).rejects.toMatchObject({
        status: 409,
        message: 'La mesa 1 está ocupada: movela cuando se cierre',
      });
      expect(repo.actualizarPosiciones).not.toHaveBeenCalled();
    });

    it('una mesa con reserva activa que no cambia de lugar no traba el guardado', async () => {
      // La reserva activa es de la mesa a, que se manda en su mismo lugar.
      const repo = salon([a, b, c], {
        reservasVigentes: jest.fn(async (_r, _s, id) => (id === 'a' ? [activa] : [])),
      });

      await createMesaService(repo).distribuir(R, 'centro', [
        { id: 'a', posX: 20, posY: 15 },
        { id: 'b', posX: 65, posY: 15 },
      ]);

      expect(repo.reservasVigentes).not.toHaveBeenCalledWith(R, 'centro', 'a');
      expect(repo.actualizarPosiciones).toHaveBeenCalledWith(R, 'centro', [
        { id: 'b', posX: 65, posY: 15 },
      ]);
    });

    it('una reserva pendiente no fija la mesa', async () => {
      const repo = salon([a, b, c], {
        reservasVigentes: jest.fn().mockResolvedValue([{ ...activa, estado: 'PENDIENTE' }]),
      });

      await createMesaService(repo).distribuir(R, 'centro', [{ id: 'a', posX: 30, posY: 15 }]);

      expect(repo.actualizarPosiciones).toHaveBeenCalled();
    });

    it('una mesa inactiva se mueve sin validar su geometría', async () => {
      const baja: Mesa = { ...c, activa: false };
      const repo = salon([a, b, baja]);

      await createMesaService(repo).distribuir(R, 'centro', [{ id: 'c', posX: 1, posY: 1 }]);

      expect(repo.actualizarPosiciones).toHaveBeenCalledWith(R, 'centro', [
        { id: 'c', posX: 1, posY: 1 },
      ]);
    });

    it('una mesa activa puede quedar sobre la posición final de una inactiva', async () => {
      const baja: Mesa = { ...c, activa: false };
      const repo = salon([a, b, baja]);
      const cambios = [
        { id: 'c', posX: 20, posY: 40 },
        { id: 'a', posX: 20, posY: 40 },
      ];

      await createMesaService(repo).distribuir(R, 'centro', cambios);

      expect(repo.actualizarPosiciones).toHaveBeenCalledWith(R, 'centro', cambios);
    });

    it('si todas las mesas quedan en su lugar no escribe, no publica y devuelve las actuales', async () => {
      const bus = busFalso();
      const repo = salon();

      const res = await createMesaService(repo, undefined, bus).distribuir(R, 'centro', [
        { id: 'a', posX: 20, posY: 15 },
        { id: 'b', posX: 60, posY: 15 },
        { id: 'c', posX: 20, posY: 45 },
      ]);

      expect(res).toEqual([a, b, c]);
      expect(repo.actualizarPosiciones).not.toHaveBeenCalled();
      expect(bus.publicar).not.toHaveBeenCalled();
    });

    it('una posición con más de dos decimales equivalente a la guardada no cuenta como movida', async () => {
      const bus = busFalso();
      const repo = salon([a, b, c], { reservasVigentes: jest.fn().mockResolvedValue([activa]) });

      await createMesaService(repo, undefined, bus).distribuir(R, 'centro', [
        { id: 'a', posX: 20.004, posY: 14.996 },
      ]);

      expect(repo.reservasVigentes).not.toHaveBeenCalled();
      expect(repo.actualizarPosiciones).not.toHaveBeenCalled();
      expect(bus.publicar).not.toHaveBeenCalled();
    });

    it('una posición que difiere se guarda redondeada a dos decimales', async () => {
      const repo = salon();

      await createMesaService(repo).distribuir(R, 'centro', [
        { id: 'a', posX: 30.126, posY: 15.004 },
      ]);

      expect(repo.actualizarPosiciones).toHaveBeenCalledWith(R, 'centro', [
        { id: 'a', posX: 30.13, posY: 15 },
      ]);
    });

    it('un par ya superpuesto que no se movió no bloquea el guardado', async () => {
      const pegada: Mesa = { ...b, posX: 24, posY: 15 };
      const repo = salon([a, pegada, c]);

      await createMesaService(repo).distribuir(R, 'centro', [{ id: 'c', posX: 20, posY: 50 }]);

      expect(repo.actualizarPosiciones).toHaveBeenCalled();
    });

    it('publica MAPA_EDITADO una sola vez, después de escribir', async () => {
      const bus = busFalso();
      const repo = salon();

      await createMesaService(repo, undefined, bus).distribuir(R, 'centro', [
        { id: 'a', posX: 30, posY: 15 },
        { id: 'c', posX: 30, posY: 45 },
      ]);

      expect(bus.publicar).toHaveBeenCalledTimes(1);
      expect(bus.publicar).toHaveBeenCalledWith({ tipo: 'MAPA_EDITADO', sucursalId: 'centro' });
      expect(repo.actualizarPosiciones.mock.invocationCallOrder[0]!).toBeLessThan(
        bus.publicar.mock.invocationCallOrder[0]!,
      );
    });

    it('si la validación o el repo fallan no publica', async () => {
      const bus = busFalso();

      await expect(
        createMesaService(salon(), undefined, bus).distribuir(R, 'centro', [
          { id: 'a', posX: 50, posY: 15 },
        ]),
      ).rejects.toMatchObject({ status: 409 });
      const roto = salon([a, b, c], {
        actualizarPosiciones: jest.fn().mockRejectedValue(new Error('base')),
      });
      await expect(
        createMesaService(roto, undefined, bus).distribuir(R, 'centro', [
          { id: 'a', posX: 30, posY: 15 },
        ]),
      ).rejects.toThrow('base');

      expect(bus.publicar).not.toHaveBeenCalled();
    });
  });

  describe('aviso MAPA_EDITADO', () => {
    const busFalso = () =>
      ({ publicar: jest.fn(), suscribir: jest.fn() }) as jest.Mocked<BusEventos>;
    const aviso = { tipo: 'MAPA_EDITADO', sucursalId: 'centro' };

    it('crear, actualizar y desactivar publican una vez, después de escribir', async () => {
      const bus = busFalso();
      const repo = repoFalso();
      const servicio = createMesaService(repo, undefined, bus);

      await servicio.crear(R, 'centro', datos);
      expect(bus.publicar).toHaveBeenCalledTimes(1);
      expect(bus.publicar).toHaveBeenLastCalledWith(aviso);
      await servicio.actualizar(R, 'centro', 'm1', datos);
      expect(bus.publicar).toHaveBeenCalledTimes(2);
      await servicio.desactivar(R, 'centro', 'm1');
      expect(bus.publicar).toHaveBeenCalledTimes(3);
      expect(bus.publicar).toHaveBeenLastCalledWith(aviso);
      const publicaciones = bus.publicar.mock.invocationCallOrder;
      expect(repo.crear.mock.invocationCallOrder[0]!).toBeLessThan(publicaciones[0]!);
      expect(repo.actualizar.mock.invocationCallOrder[0]!).toBeLessThan(publicaciones[1]!);
      expect(repo.desactivar.mock.invocationCallOrder[0]!).toBeLessThan(publicaciones[2]!);
    });

    it('si la validación falla no publica', async () => {
      const bus = busFalso();
      const servicio = createMesaService(repoFalso(), undefined, bus);

      await expect(servicio.crear(R, 'centro', { ...datos, posX: 3 })).rejects.toMatchObject({
        status: 409,
      });
      expect(bus.publicar).not.toHaveBeenCalled();
    });

    it('si el repo falla no publica', async () => {
      const bus = busFalso();
      const repo = repoFalso({ actualizar: jest.fn().mockRejectedValue(new Error('base')) });
      const servicio = createMesaService(repo, undefined, bus);

      await expect(servicio.actualizar(R, 'centro', 'm1', datos)).rejects.toThrow('base');
      expect(bus.publicar).not.toHaveBeenCalled();
    });
  });
});
