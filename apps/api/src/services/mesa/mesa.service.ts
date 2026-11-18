import {
  administraModulo,
  entraEnLienzo,
  rectanguloMesa,
  seSuperponen,
  type CodigoPermiso,
  type DistribucionInput,
  type Mesa,
  type MesaGeometria,
  type MesaInput,
} from '@pgim/shared';
import { busEventos, type BusEventos } from '../../domain/eventos/eventos';
import { ocupaLaMesa } from '../../domain/reserva/reserva';
import { AppError } from '../../lib/errors';
import { mesaRepository, type MesaRepository } from '../../repositories/mesa.repository';

// CU-14 Configurar mapa del salón.
export function createMesaService(
  repo: MesaRepository,
  ahora: () => Date = () => new Date(),
  bus: BusEventos = busEventos,
) {
  async function verificarSucursal(restauranteId: string, sucursalId: string) {
    if (!(await repo.existeSucursal(restauranteId, sucursalId))) {
      throw new AppError(404, 'La sucursal no existe');
    }
  }

  async function obtenerMesa(restauranteId: string, sucursalId: string, id: string) {
    const mesa = await repo.buscar(restauranteId, sucursalId, id);
    if (!mesa) throw new AppError(404, 'La mesa no existe');
    return mesa;
  }

  async function verificarNumero(
    restauranteId: string,
    sucursalId: string,
    numero: number,
    excluirId?: string,
  ) {
    if (await repo.existeNumero(restauranteId, sucursalId, numero, excluirId)) {
      throw new AppError(409, `Ya existe la mesa ${numero} en esta sucursal`);
    }
  }

  // Una mesa dada de baja no ocupa lugar: no se valida su geometría. Si está
  // activa, tiene que entrar en el lienzo y no pisar a otra mesa activa.
  async function verificarGeometria(
    restauranteId: string,
    sucursalId: string,
    mesa: MesaGeometria & { id?: string; activa: boolean },
  ) {
    if (!mesa.activa) return;
    const rectangulo = rectanguloMesa(mesa);
    if (!entraEnLienzo(rectangulo)) throw new AppError(409, 'La mesa no entra en el salón');
    const otras = await repo.listar(restauranteId, sucursalId);
    const choque = otras.find(
      (o) => o.activa && o.id !== mesa.id && seSuperponen(rectangulo, rectanguloMesa(o)),
    );
    if (choque) throw new AppError(409, `Se superpone con la mesa ${choque.numero}`);
  }

  // Una mesa con reservas que todavía la ocupan no se da de baja ni se achica
  // por debajo del grupo más grande: esas reservas quedarían sin mesa. Una
  // pendiente vencida o una activa de una franja ya terminada no cuentan.
  async function verificarReservas(
    restauranteId: string,
    sucursalId: string,
    mesa: Mesa,
    cambios: Partial<MesaInput>,
  ) {
    const todas = await repo.reservasVigentes(restauranteId, sucursalId, mesa.id);
    // Una reserva ACTIVA tiene a los comensales sentados hasta que se cierre,
    // aunque su franja haya terminado: la mesa no cambia de lugar ni de giro.
    const cambiaLugar =
      (cambios.posX !== undefined && cambios.posX !== mesa.posX) ||
      (cambios.posY !== undefined && cambios.posY !== mesa.posY) ||
      (cambios.vertical !== undefined && cambios.vertical !== mesa.vertical);
    if (cambiaLugar && todas.some((r) => r.estado === 'ACTIVA')) {
      throw new AppError(409, 'La mesa está ocupada: movela cuando se cierre');
    }
    const momento = ahora();
    const ocupan = todas.filter((r) => ocupaLaMesa(r, momento));
    const cantidad = ocupan.length;
    if (cantidad === 0) return;
    const maxPersonas = Math.max(...ocupan.map((r) => r.cantidadPersonas));
    // Solo el paso de activa a inactiva: una mesa ya dada de baja se puede mover.
    if (mesa.activa && cambios.activa === false) {
      throw new AppError(
        409,
        `La mesa tiene ${cantidad} ${cantidad === 1 ? 'reserva vigente' : 'reservas vigentes'}: no se puede dar de baja`,
      );
    }
    // Solo cuando se achica: el formulario manda siempre la capacidad, y mover o
    // girar una mesa que ya tenía una reserva mayor no la achica.
    if (
      cambios.capacidad !== undefined &&
      cambios.capacidad < mesa.capacidad &&
      cambios.capacidad < maxPersonas
    ) {
      throw new AppError(
        409,
        `La mesa tiene una reserva para ${maxPersonas} personas: la capacidad no puede ser menor`,
      );
    }
  }

  return {
    // Mismo alcance que las sucursales: quien solo las ve, ve el salón de las suyas.
    async listar(
      restauranteId: string,
      permisos: readonly CodigoPermiso[],
      asignadas: string[],
      sucursalId: string,
    ) {
      if (!administraModulo(permisos, 'sucursal') && !asignadas.includes(sucursalId)) {
        throw new AppError(404, 'La sucursal no existe');
      }
      await verificarSucursal(restauranteId, sucursalId);
      return repo.listar(restauranteId, sucursalId);
    },

    async crear(restauranteId: string, sucursalId: string, datos: MesaInput) {
      await verificarSucursal(restauranteId, sucursalId);
      await verificarNumero(restauranteId, sucursalId, datos.numero);
      await verificarGeometria(restauranteId, sucursalId, {
        ...datos,
        activa: datos.activa ?? true,
      });
      const creada = await repo.crear(restauranteId, sucursalId, datos);
      bus.publicar({ tipo: 'MAPA_EDITADO', sucursalId });
      return creada;
    },

    async actualizar(restauranteId: string, sucursalId: string, id: string, datos: MesaInput) {
      const mesa = await obtenerMesa(restauranteId, sucursalId, id);
      await verificarNumero(restauranteId, sucursalId, datos.numero, id);
      await verificarReservas(restauranteId, sucursalId, mesa, datos);
      await verificarGeometria(restauranteId, sucursalId, {
        id,
        capacidad: datos.capacidad,
        posX: datos.posX,
        posY: datos.posY,
        vertical: datos.vertical ?? mesa.vertical,
        activa: datos.activa ?? mesa.activa,
      });
      const actualizada = await repo.actualizar(restauranteId, sucursalId, id, datos);
      bus.publicar({ tipo: 'MAPA_EDITADO', sucursalId });
      return actualizada;
    },

    // Guarda de una vez las posiciones del borrador del editor. Se valida la
    // distribución final completa, así que dos mesas pueden intercambiar lugar.
    async distribuir(
      restauranteId: string,
      sucursalId: string,
      pedidos: DistribucionInput['mesas'],
    ) {
      // La base guarda dos decimales: se compara y valida con el valor ya redondeado.
      const cambios = pedidos.map((p) => ({
        id: p.id,
        posX: Math.round(p.posX * 100) / 100,
        posY: Math.round(p.posY * 100) / 100,
      }));
      await verificarSucursal(restauranteId, sucursalId);
      const actuales = await repo.listar(restauranteId, sucursalId);
      const porId = new Map(actuales.map((m) => [m.id, m]));
      const movidas = new Set<string>();
      for (const cambio of cambios) {
        const mesa = porId.get(cambio.id);
        if (!mesa) throw new AppError(404, 'La mesa no existe');
        if (mesa.posX !== cambio.posX || mesa.posY !== cambio.posY) movidas.add(mesa.id);
      }
      if (movidas.size === 0) return actuales;

      for (const id of movidas) {
        const mesa = porId.get(id)!;
        const reservas = await repo.reservasVigentes(restauranteId, sucursalId, id);
        if (reservas.some((r) => r.estado === 'ACTIVA')) {
          throw new AppError(409, `La mesa ${mesa.numero} está ocupada: movela cuando se cierre`);
        }
      }

      const finales = actuales.map((m) => {
        const cambio = cambios.find((c) => c.id === m.id);
        return cambio ? { ...m, posX: cambio.posX, posY: cambio.posY } : m;
      });
      const activas = finales.filter((m) => m.activa);
      for (const mesa of activas.filter((m) => movidas.has(m.id))) {
        const rectangulo = rectanguloMesa(mesa);
        if (!entraEnLienzo(rectangulo)) {
          throw new AppError(409, `La mesa ${mesa.numero} no entra en el salón`);
        }
        const choque = activas.find(
          (o) => o.id !== mesa.id && seSuperponen(rectangulo, rectanguloMesa(o)),
        );
        if (choque) {
          throw new AppError(
            409,
            `La mesa ${mesa.numero} se superpone con la mesa ${choque.numero}`,
          );
        }
      }

      await repo.actualizarPosiciones(
        restauranteId,
        sucursalId,
        cambios.filter((c) => movidas.has(c.id)),
      );
      bus.publicar({ tipo: 'MAPA_EDITADO', sucursalId });
      return repo.listar(restauranteId, sucursalId);
    },

    async desactivar(restauranteId: string, sucursalId: string, id: string) {
      const mesa = await obtenerMesa(restauranteId, sucursalId, id);
      await verificarReservas(restauranteId, sucursalId, mesa, { activa: false });
      await repo.desactivar(restauranteId, sucursalId, id);
      bus.publicar({ tipo: 'MAPA_EDITADO', sucursalId });
    },
  };
}

export const mesaService = createMesaService(mesaRepository);
