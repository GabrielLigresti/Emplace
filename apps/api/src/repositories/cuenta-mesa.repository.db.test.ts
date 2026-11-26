import { prisma } from '../lib/prisma';
import { crearEscenario, limpiarBase, type Escenario } from '../test/db-setup';
import { cuentaMesaRepository } from './cuenta-mesa.repository';
import { pedidoRepository, type CuentaParaPedido } from './pedido.repository';
import { reservaRepository } from './reserva.repository';

afterAll(() => prisma.$disconnect());

let e: Escenario;
let cuenta: CuentaParaPedido;

beforeEach(async () => {
  await limpiarBase();
  e = await crearEscenario();
  cuenta = (await pedidoRepository.buscarCuentaDelComensal(e.comensalId, e.cuentaMesaId))!;
});

const agua = () => ({
  itemMenuId: e.aguaId,
  cantidad: 2,
  precioUnitario: 300,
  observaciones: null,
  insumos: new Map<string, number>(),
});

// El saldo de la mesa (un agua de $600) pagado y aprobado.
const pagoAprobado = () =>
  prisma.pago.create({
    data: {
      cuentaMesaId: e.cuentaMesaId,
      comensalId: e.comensalId,
      monto: 600,
      metodo: 'TARJETA',
      estado: 'APROBADO',
    },
  });

async function entregar(id: string) {
  await prisma.pedido.update({ where: { id }, data: { estado: 'ENTREGADO' } });
}

describe('cuentaMesaRepository', () => {
  it('encuentra la mesa abierta del comensal, en la sucursal o en cualquiera', async () => {
    const pedido = await pedidoRepository.confirmar(cuenta, [agua()]);

    const mesa = await cuentaMesaRepository.mesaAbiertaDelComensal(e.comensalId, e.sucursalId);
    expect(mesa).toMatchObject({
      cuentaMesaId: e.cuentaMesaId,
      estado: 'ABIERTA',
      mesaNumero: 4,
      comensalId: e.comensalId,
      pagado: 0,
    });
    expect(mesa!.pedidos).toEqual([
      expect.objectContaining({ id: pedido.id, numero: 1, estado: 'CONFIRMADO', total: 600 }),
    ]);
    expect(await cuentaMesaRepository.mesaAbiertaDelComensal(e.comensalId)).not.toBeNull();
    expect(await cuentaMesaRepository.mesaAbiertaDelComensal(e.comensalId, e.harinaId)).toBeNull();
    expect(await cuentaMesaRepository.buscarDelComensal(e.harinaId, e.cuentaMesaId)).toBeNull();
  });
});

describe('reservaRepository.cerrar', () => {
  const cerrar = (confirmarSaldo: boolean) =>
    reservaRepository.cerrar(e.restauranteId, e.sucursalId, e.reservaId, confirmarSaldo);

  it('con pedidos sin entregar se bloquea', async () => {
    await pedidoRepository.confirmar(cuenta, [agua()]);
    expect(await cerrar(true)).toEqual({
      resultado: 'BLOQUEADA',
      bloqueo: { pedidosSinEntregar: 1 },
    });
  });

  it('con saldo pendiente pide confirmación y después cierra', async () => {
    const pedido = await pedidoRepository.confirmar(cuenta, [agua()]);
    await entregar(pedido.id);

    expect(await cerrar(false)).toEqual({
      resultado: 'BLOQUEADA',
      bloqueo: { saldoPendiente: 600 },
    });
    expect(await cerrar(true)).toEqual({
      resultado: 'CERRADA',
      cuentaMesaId: e.cuentaMesaId,
      comensalId: e.comensalId,
    });

    const reserva = await prisma.reserva.findUniqueOrThrow({
      where: { id: e.reservaId },
      include: { cuentaMesa: true },
    });
    expect(reserva.estado).toBe('FINALIZADA');
    expect(reserva.cuentaMesa!.estado).toBe('CERRADA');
    expect(reserva.cuentaMesa!.cerradaEn).toBeInstanceOf(Date);
  });

  it('pagada, cierra sin pedir confirmación', async () => {
    const pedido = await pedidoRepository.confirmar(cuenta, [agua()]);
    await entregar(pedido.id);
    await pagoAprobado();

    expect((await cerrar(false)).resultado).toBe('CERRADA');
  });

  it('un pedido cancelado no bloquea ni suma al saldo', async () => {
    const pedido = await pedidoRepository.confirmar(cuenta, [agua()]);
    await pedidoRepository.cancelar(e.restauranteId, e.sucursalId, pedido.id, 'x');

    expect((await cerrar(false)).resultado).toBe('CERRADA');
  });

  it('con un pago en curso se bloquea', async () => {
    const pedido = await pedidoRepository.confirmar(cuenta, [agua()]);
    await entregar(pedido.id);
    await prisma.pago.create({
      data: {
        cuentaMesaId: e.cuentaMesaId,
        comensalId: e.comensalId,
        monto: 600,
        metodo: 'TARJETA',
      },
    });

    expect(await cerrar(true)).toEqual({ resultado: 'BLOQUEADA', bloqueo: { pagoEnCurso: true } });
  });

  it('un pago que Mercado Pago sigue revisando después del vencimiento se cierra con confirmación', async () => {
    const pedido = await pedidoRepository.confirmar(cuenta, [agua()]);
    await entregar(pedido.id);
    await prisma.pago.create({
      data: {
        cuentaMesaId: e.cuentaMesaId,
        comensalId: e.comensalId,
        monto: 600,
        metodo: 'TARJETA',
        fecha: new Date(Date.now() - 20 * 60_000),
      },
    });

    expect(await cerrar(false)).toEqual({
      resultado: 'BLOQUEADA',
      bloqueo: { pagoEnRevision: true },
    });
    expect((await cerrar(true)).resultado).toBe('CERRADA');
  });

  it('una reserva que ya no está activa no se cierra', async () => {
    await prisma.reserva.update({ where: { id: e.reservaId }, data: { estado: 'FINALIZADA' } });
    expect(await cerrar(true)).toEqual({ resultado: 'CAMBIO' });
  });

  it('una reserva de otra sucursal no se cierra', async () => {
    expect(await reservaRepository.cerrar(e.restauranteId, e.harinaId, e.reservaId, true)).toEqual({
      resultado: 'CAMBIO',
    });
  });
});

describe('cuentaMesaRepository.registrarVisita', () => {
  const visitar = () =>
    cuentaMesaRepository.registrarVisita(e.cuentaMesaId, e.restauranteId, e.comensalId);

  it('con un pago aprobado registra una visita, una sola vez', async () => {
    await pedidoRepository.confirmar(cuenta, [agua()]);
    await pagoAprobado();

    expect(await visitar()).toBe(true);
    expect(await visitar()).toBe(false);

    expect(await prisma.visita.count()).toBe(1);
    const fidelidad = await prisma.cuentaFidelidad.findFirstOrThrow();
    expect(fidelidad.cantidadVisitas).toBe(1);
  });

  it('una mesa pagada entera con un beneficio ($0) también suma visita', async () => {
    await prisma.pago.create({
      data: {
        cuentaMesaId: e.cuentaMesaId,
        comensalId: e.comensalId,
        monto: 0,
        metodo: 'TARJETA',
        estado: 'APROBADO',
      },
    });
    expect(await visitar()).toBe(true);
  });

  it('sin pago no registra visita ni crea la cuenta de fidelidad', async () => {
    expect(await visitar()).toBe(false);
    expect(await prisma.visita.count()).toBe(0);
    expect(await prisma.cuentaFidelidad.count()).toBe(0);
  });
});

describe('reservaRepository.activar', () => {
  // Una reserva PENDIENTE del mismo comensal en otra sucursal del restaurante.
  async function reservaEnOtraSucursal(comensalId = e.comensalId) {
    const sucursal = await prisma.sucursal.create({
      data: {
        restauranteId: e.restauranteId,
        nombre: 'Norte',
        direccion: 'Calle Norte 1',
        barrio: 'SAN_NICOLAS',
        horarioApertura: new Date('1970-01-01T12:00:00Z'),
        horarioCierre: new Date('1970-01-01T00:00:00Z'),
        toleranciaNoShowMin: 15,
      },
    });
    const mesa = await prisma.mesa.create({
      data: { sucursalId: sucursal.id, numero: 1, capacidad: 2, posX: 1, posY: 1 },
    });
    const inicio = new Date();
    inicio.setUTCMinutes(0, 0, 0);
    const reserva = await prisma.reserva.create({
      data: {
        sucursalId: sucursal.id,
        mesaId: mesa.id,
        comensalId,
        inicio,
        cantidadPersonas: 2,
        modoAsignacion: 'MANUAL',
      },
    });
    return { sucursalId: sucursal.id, reservaId: reserva.id };
  }

  const activar = (r: { sucursalId: string; reservaId: string }, ahora = new Date()) =>
    reservaRepository.activar(
      e.restauranteId,
      r.sucursalId,
      r.reservaId,
      'PENDIENTE',
      'ACTIVA',
      ahora,
    );

  const HORA = 3_600_000;
  // Inicio en punto (lo exige la base), a `n` horas de la hora actual.
  const enPunto = (n: number) => {
    const inicio = new Date();
    inicio.setUTCMinutes(0, 0, 0);
    return new Date(inicio.getTime() + n * HORA);
  };

  async function comensalNuevo() {
    const usuario = await prisma.usuario.create({
      data: {
        email: `comensal-${Math.random().toString(36).slice(2)}@prueba.test`,
        passwordHash: 'x',
        tipo: 'COMENSAL',
        comensal: { create: { nombre: 'Otro comensal' } },
      },
    });
    return usuario.id;
  }

  async function mesaNueva(numero: number) {
    return (
      await prisma.mesa.create({
        data: { sucursalId: e.sucursalId, numero, capacidad: 4, posX: 20, posY: 20 },
      })
    ).id;
  }

  // Una reserva de la sucursal del escenario, de otro comensal salvo que se indique.
  async function reservaEn(
    mesaId: string,
    inicio: Date,
    estado: 'PENDIENTE' | 'ACTIVA' | 'CANCELADA' = 'PENDIENTE',
    comensalId?: string,
  ) {
    const reserva = await prisma.reserva.create({
      data: {
        sucursalId: e.sucursalId,
        mesaId,
        comensalId: comensalId ?? (await comensalNuevo()),
        inicio,
        cantidadPersonas: 2,
        modoAsignacion: 'MANUAL',
        estado,
      },
    });
    return { sucursalId: e.sucursalId, reservaId: reserva.id };
  }

  const mesaDelEscenario = async () =>
    (await prisma.reserva.findUniqueOrThrow({ where: { id: e.reservaId } })).mesaId;

  const estadoDe = async (r: { reservaId: string }) =>
    (await prisma.reserva.findUniqueOrThrow({ where: { id: r.reservaId } })).estado;

  it('con otra mesa abierta del comensal no se activa', async () => {
    const norte = await reservaEnOtraSucursal();
    expect(await activar(norte)).toEqual({ resultado: 'OTRA_MESA_ABIERTA' });
    expect(
      (await prisma.reserva.findUniqueOrThrow({ where: { id: norte.reservaId } })).estado,
    ).toBe('PENDIENTE');
  });

  it('sin otra mesa abierta, se activa y abre la cuenta', async () => {
    await prisma.cuentaMesa.update({ where: { id: e.cuentaMesaId }, data: { estado: 'CERRADA' } });
    const norte = await reservaEnOtraSucursal();
    expect(await activar(norte)).toEqual({ resultado: 'ACTIVADA' });
    expect(await prisma.cuentaMesa.count({ where: { estado: 'ABIERTA' } })).toBe(1);
  });

  it('dos activaciones simultáneas del mismo comensal dejan una sola mesa abierta', async () => {
    await prisma.cuentaMesa.update({ where: { id: e.cuentaMesaId }, data: { estado: 'CERRADA' } });
    const [a, b] = [await reservaEnOtraSucursal(), await reservaEnOtraSucursal()];
    const resultados = await Promise.all([activar(a), activar(b)]);
    expect(resultados.map((r) => r.resultado).sort()).toEqual(['ACTIVADA', 'OTRA_MESA_ABIERTA']);
    expect(await prisma.cuentaMesa.count({ where: { estado: 'ABIERTA' } })).toBe(1);
  });

  it('con otra reserva ACTIVA en la misma mesa, de ayer, no se activa', async () => {
    // El escenario deja la mesa 4 con una ACTIVA; se la lleva a ayer, sin cerrar.
    const ayer = enPunto(-24);
    await prisma.reserva.update({ where: { id: e.reservaId }, data: { inicio: ayer } });
    const mesaId = await mesaDelEscenario();
    const cuentasAntes = await prisma.cuentaMesa.count();
    const pendiente = await reservaEn(mesaId, enPunto(1));

    expect(await activar(pendiente)).toEqual({ resultado: 'MESA_OCUPADA' });
    expect(await estadoDe(pendiente)).toBe('PENDIENTE');
    expect(await prisma.cuentaMesa.count()).toBe(cuentasAntes);
  });

  it('una ACTIVA en otra mesa de la sucursal no impide activar', async () => {
    const pendiente = await reservaEn(await mesaNueva(5), enPunto(1));
    expect(await activar(pendiente)).toEqual({ resultado: 'ACTIVADA' });
  });

  it('una PENDIENTE anterior dentro de su tolerancia bloquea; pasada, no', async () => {
    const mesaId = await mesaNueva(5);
    const inicioAnterior = enPunto(-2);
    await reservaEn(mesaId, inicioAnterior);
    const pendiente = await reservaEn(mesaId, new Date(inicioAnterior.getTime() + HORA));
    const limite = new Date(inicioAnterior.getTime() + 15 * 60_000);

    expect(await activar(pendiente, limite)).toEqual({
      resultado: 'RESERVA_ANTERIOR',
      inicio: inicioAnterior,
    });
    expect(await estadoDe(pendiente)).toBe('PENDIENTE');
    expect(await activar(pendiente, new Date(limite.getTime() + 1))).toEqual({
      resultado: 'ACTIVADA',
    });
  });

  it('una PENDIENTE posterior o una CANCELADA anterior no bloquean', async () => {
    const mesaId = await mesaNueva(5);
    const base = enPunto(3);
    await reservaEn(mesaId, new Date(base.getTime() - HORA), 'CANCELADA');
    await reservaEn(mesaId, new Date(base.getTime() + HORA));
    const pendiente = await reservaEn(mesaId, base);

    expect(await activar(pendiente, new Date(base.getTime() - 30 * 60_000))).toEqual({
      resultado: 'ACTIVADA',
    });
  });

  it('dos reservas de la misma mesa activadas a la vez: gana una sola', async () => {
    const mesaId = await mesaNueva(5);
    const primera = enPunto(-3);
    const a = await reservaEn(mesaId, primera);
    const b = await reservaEn(mesaId, new Date(primera.getTime() + HORA));
    // Pasado el límite de la primera, ninguna bloquea a la otra por espera.
    const resultados = await Promise.all([activar(a), activar(b)]);

    expect(resultados.map((r) => r.resultado).sort()).toEqual(['ACTIVADA', 'MESA_OCUPADA']);
    expect(
      await prisma.cuentaMesa.count({ where: { estado: 'ABIERTA', reserva: { mesaId } } }),
    ).toBe(1);
  });

  it('el mismo comensal en la misma mesa ocupada recibe MESA_OCUPADA', async () => {
    // La mesa del escenario tiene una ACTIVA del comensal con la cuenta abierta.
    const mesaId = await mesaDelEscenario();
    const pendiente = await reservaEn(mesaId, enPunto(1), 'PENDIENTE', e.comensalId);

    expect(await activar(pendiente)).toEqual({ resultado: 'MESA_OCUPADA' });
    expect(await estadoDe(pendiente)).toBe('PENDIENTE');
  });

  it('con un restaurante ajeno y la sucursal correcta responde CAMBIO', async () => {
    const pendiente = await reservaEn(await mesaNueva(5), enPunto(1));
    const ajeno = await prisma.restaurante.create({
      data: { nombre: 'Restaurante ajeno', cuit: `30-${Date.now() + 1}-9` },
    });

    expect(
      await reservaRepository.activar(
        ajeno.id,
        pendiente.sucursalId,
        pendiente.reservaId,
        'PENDIENTE',
        'ACTIVA',
        new Date(),
      ),
    ).toEqual({ resultado: 'CAMBIO' });
    expect(await estadoDe(pendiente)).toBe('PENDIENTE');
  });

  it('con otra sucursal responde CAMBIO', async () => {
    const pendiente = await reservaEn(await mesaNueva(5), enPunto(1));
    const norte = await reservaEnOtraSucursal();
    expect(
      await reservaRepository.activar(
        e.restauranteId,
        norte.sucursalId,
        pendiente.reservaId,
        'PENDIENTE',
        'ACTIVA',
        new Date(),
      ),
    ).toEqual({ resultado: 'CAMBIO' });
  });
});
