import type { PedidoComensal } from '@pgim/shared';
import { crearPasarelaSimulada } from '../../pagos/pasarela';
import type { CuentaMesaRepository, FilaMesa } from '../../repositories/cuenta-mesa.repository';
import { createCuentaMesaService } from './cuenta-mesa.service';

function pedido(
  id: string,
  total: number,
  estado: PedidoComensal['estado'],
  creadoEn = '2026-10-30T23:00:00.000Z',
): PedidoComensal {
  return { id, numero: 1, creadoEn, estado, total, lineas: [] };
}

function mesa(cambios: Partial<FilaMesa> = {}): FilaMesa {
  return {
    cuentaMesaId: 'cuenta',
    estado: 'ABIERTA',
    sucursal: { id: 'centro', nombre: 'Centro' },
    restauranteId: 'r',
    comensalId: 'C',
    mesaNumero: 4,
    abiertaEn: new Date('2026-10-30T22:55:00.000Z'),
    pedidos: [pedido('a', 1000, 'ENTREGADO'), pedido('b', 500, 'CANCELADO')],
    pagado: 0,
    descuentos: 0,
    pagoPendienteId: null,
    ...cambios,
  };
}

function armar(fila: FilaMesa | null, habilitada = true) {
  const repo: jest.Mocked<CuentaMesaRepository> = {
    mesaAbiertaDelComensal: jest.fn().mockResolvedValue(fila),
    buscarDelComensal: jest.fn().mockResolvedValue(fila),
    registrarVisita: jest.fn(),
  };
  const servicio = createCuentaMesaService(repo, crearPasarelaSimulada(habilitada), (id) =>
    id === 'p-curso' ? 'https://mp/pagar' : null,
  );
  return { repo, servicio };
}

describe('cuentaMesaService.miMesa', () => {
  it('sin mesa abierta devuelve null', async () => {
    expect(await armar(null).servicio.miMesa('C', 'centro')).toBeNull();
  });

  it('sin sucursal busca la mesa abierta en cualquiera', async () => {
    const { servicio, repo } = armar(mesa());
    await servicio.miMesa('C');
    expect(repo.mesaAbiertaDelComensal).toHaveBeenCalledWith('C', undefined);
  });

  it('el total no cuenta los pedidos cancelados', async () => {
    const resultado = await armar(mesa({ pagado: 400 })).servicio.miMesa('C', 'centro');
    expect(resultado).toMatchObject({
      cuentaMesaId: 'cuenta',
      mesa: { numero: 4 },
      total: 1000,
      pagado: 400,
      saldo: 600,
      pagoHabilitado: true,
    });
  });
});

describe('cuentaMesaService.miMesa con un pago en curso', () => {
  it('ofrece retomar el pago con su link de Mercado Pago', async () => {
    const { servicio } = armar(mesa({ pagoPendienteId: 'p-curso' }));
    expect((await servicio.miMesa('C'))!.pagoEnCurso).toEqual({
      pagoId: 'p-curso',
      urlPago: 'https://mp/pagar',
    });
  });

  it('sin pago en curso, null', async () => {
    const { servicio } = armar(mesa());
    expect((await servicio.miMesa('C'))!.pagoEnCurso).toBeNull();
  });
});

describe('cuentaMesaService.miMesa: estado de pago de cada pedido', () => {
  const estados = async (fila: FilaMesa) =>
    Object.fromEntries(
      (await armar(fila).servicio.miMesa('C'))!.pedidos.map((p) => [p.id, p.estadoPago]),
    );
  const tres = [
    pedido('a', 1000, 'ENTREGADO', '2026-10-30T23:00:00.000Z'),
    pedido('b', 500, 'CANCELADO', '2026-10-30T23:05:00.000Z'),
    pedido('c', 800.1, 'CONFIRMADO', '2026-10-30T23:10:00.000Z'),
  ];

  it('sin pagos, todo pendiente; el cancelado no lleva estado de pago', async () => {
    expect(await estados(mesa({ pedidos: tres }))).toEqual({
      a: 'PENDIENTE',
      b: null,
      c: 'PENDIENTE',
    });
  });

  it('con el saldo pagado, todo pagado (sin errores de redondeo)', async () => {
    expect(await estados(mesa({ pedidos: tres, pagado: 1800.1 }))).toEqual({
      a: 'PAGADO',
      b: null,
      c: 'PAGADO',
    });
  });

  it('el pedido hecho después del último pago queda pendiente', async () => {
    expect(await estados(mesa({ pedidos: tres, pagado: 1000 }))).toEqual({
      a: 'PAGADO',
      b: null,
      c: 'PENDIENTE',
    });
  });

  it('lo que cubrió un beneficio cuenta como pagado', async () => {
    expect(await estados(mesa({ pedidos: tres, pagado: 700, descuentos: 300 }))).toEqual({
      a: 'PAGADO',
      b: null,
      c: 'PENDIENTE',
    });
  });

  it('reparte por fecha de creación aunque la lista venga en otro orden', async () => {
    const desordenados = [tres[2], tres[0]];
    expect(await estados(mesa({ pedidos: desordenados, pagado: 1000 }))).toEqual({
      a: 'PAGADO',
      c: 'PENDIENTE',
    });
  });

  it('un pedido cubierto solo en parte sigue pendiente', async () => {
    expect(await estados(mesa({ pedidos: tres, pagado: 1500 }))).toEqual({
      a: 'PAGADO',
      b: null,
      c: 'PENDIENTE',
    });
  });
});
