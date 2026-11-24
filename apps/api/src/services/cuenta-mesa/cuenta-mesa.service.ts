import type { MiMesa, PedidoComensal, PedidoMiMesa } from '@pgim/shared';
import { pasarela as pasarelaPorDefecto, type PasarelaPago } from '../../pagos/pasarela';
import {
  cuentaMesaRepository,
  type CuentaMesaRepository,
  type FilaMesa,
} from '../../repositories/cuenta-mesa.repository';
import { pagoService } from '../pago/pago.service';

const centavos = (valor: number) => Math.round(valor * 100) / 100;
const aCentavos = (valor: number) => Math.round(valor * 100);

// Cada pago cubre todo el saldo del momento, así que lo pagado (y lo que
// cubrieron los beneficios) alcanza a los pedidos más viejos primero. Un pedido
// cubierto solo en parte sigue pendiente. Se cuenta en centavos enteros.
function conEstadoPago(pedidos: PedidoComensal[], cubierto: number): PedidoMiMesa[] {
  let restante = aCentavos(cubierto);
  const pagados = new Set<string>();
  for (const p of [...pedidos]
    .filter((p) => p.estado !== 'CANCELADO')
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))) {
    const total = aCentavos(p.total);
    if (restante < total) break;
    restante -= total;
    pagados.add(p.id);
  }
  return pedidos.map((p) => ({
    ...p,
    estadoPago: p.estado === 'CANCELADO' ? null : pagados.has(p.id) ? 'PAGADO' : 'PENDIENTE',
  }));
}

// "Mi mesa" del comensal: pedidos, saldo y el pago en curso, si hay uno. El
// pago en sí está en pago.service.
export function createCuentaMesaService(
  repo: CuentaMesaRepository,
  pasarela: Pick<PasarelaPago, 'habilitada'>,
  urlDePago: (pagoId: string) => string | null,
) {
  function aMiMesa(fila: FilaMesa): MiMesa {
    const total = centavos(
      fila.pedidos.filter((p) => p.estado !== 'CANCELADO').reduce((t, p) => t + p.total, 0),
    );
    return {
      cuentaMesaId: fila.cuentaMesaId,
      sucursal: fila.sucursal,
      mesa: { numero: fila.mesaNumero },
      abiertaEn: fila.abiertaEn.toISOString(),
      pedidos: conEstadoPago(fila.pedidos, fila.pagado + fila.descuentos),
      total,
      pagado: fila.pagado,
      descuentos: fila.descuentos,
      saldo: centavos(total - fila.pagado - fila.descuentos),
      pagoHabilitado: pasarela.habilitada,
      pagoEnCurso: fila.pagoPendienteId
        ? { pagoId: fila.pagoPendienteId, urlPago: urlDePago(fila.pagoPendienteId) }
        : null,
    };
  }

  return {
    async miMesa(comensalId: string, sucursalId?: string): Promise<MiMesa | null> {
      const fila = await repo.mesaAbiertaDelComensal(comensalId, sucursalId);
      return fila && aMiMesa(fila);
    },
  };
}

export const cuentaMesaService = createCuentaMesaService(
  cuentaMesaRepository,
  pasarelaPorDefecto,
  (pagoId) => pagoService.urlDePago(pagoId),
);
