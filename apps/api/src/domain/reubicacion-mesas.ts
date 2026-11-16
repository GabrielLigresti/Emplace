import {
  buscarLugarLibre,
  entraEnLienzo,
  rectanguloMesa,
  seSuperponen,
  type RectanguloMesa,
} from '@pgim/shared';

export interface MesaParaReubicar {
  id: string;
  numero: number;
  capacidad: number;
  vertical: boolean;
  posX: number;
  posY: number;
}

export interface MovimientoMesa {
  id: string;
  numero: number;
  desde: { posX: number; posY: number };
  hasta: { posX: number; posY: number };
}

export interface AvisoReubicacion {
  numero: number;
  motivo: 'RESERVA_ACTIVA' | 'SIN_LUGAR';
}

export interface PlanReubicacion {
  movimientos: MovimientoMesa[];
  avisos: AvisoReubicacion[];
}

// Decide qué mesas de una sucursal hay que mover tras el cambio de tamaños del
// plano. Recibe solo las mesas activas. Las mesas con reserva activa (hay gente
// sentada) no se mueven nunca: se procesan primero y quedan como ancla, así una
// mesa sin reserva que las pisa es la que se mueve. Después se recorre el resto
// por número: se queda en su lugar la que entra en el lienzo y no pisa a otra ya
// conservada; las demás se ubican en el primer lugar libre. Una mesa con reserva
// activa que no entra o pisa a otra ancla, y una sin lugar libre, no se mueven:
// se avisan y siguen ocupando su rectángulo actual. Es función pura: no toca la
// base.
export function planificarReubicacion(
  mesas: readonly MesaParaReubicar[],
  mesasConReservaActiva: ReadonlySet<string>,
): PlanReubicacion {
  const porNumero = [...mesas].sort((a, b) => a.numero - b.numero);
  const ordenadas = [
    ...porNumero.filter((m) => mesasConReservaActiva.has(m.id)),
    ...porNumero.filter((m) => !mesasConReservaActiva.has(m.id)),
  ];
  const ocupadas: RectanguloMesa[] = [];
  const aMover: MesaParaReubicar[] = [];

  for (const mesa of ordenadas) {
    const rect = rectanguloMesa(mesa);
    if (entraEnLienzo(rect) && !ocupadas.some((o) => seSuperponen(rect, o))) {
      ocupadas.push(rect);
    } else {
      aMover.push(mesa);
    }
  }

  const movimientos: MovimientoMesa[] = [];
  const avisos: AvisoReubicacion[] = [];
  for (const mesa of aMover) {
    if (mesasConReservaActiva.has(mesa.id)) {
      avisos.push({ numero: mesa.numero, motivo: 'RESERVA_ACTIVA' });
      ocupadas.push(rectanguloMesa(mesa));
      continue;
    }
    const lugar = buscarLugarLibre(mesa.capacidad, mesa.vertical, ocupadas);
    if (!lugar) {
      avisos.push({ numero: mesa.numero, motivo: 'SIN_LUGAR' });
      ocupadas.push(rectanguloMesa(mesa));
      continue;
    }
    movimientos.push({
      id: mesa.id,
      numero: mesa.numero,
      desde: { posX: mesa.posX, posY: mesa.posY },
      hasta: lugar,
    });
    ocupadas.push(rectanguloMesa({ ...mesa, ...lugar }));
  }
  return { movimientos, avisos };
}
