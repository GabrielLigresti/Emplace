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
// plano. Recibe solo las mesas activas. Recorre por número: se queda en su lugar
// la que entra en el lienzo y no pisa a otra ya conservada; el resto se ubica en
// el primer lugar libre. Una mesa con reserva activa no se mueve (hay gente
// sentada) y una sin lugar libre tampoco; las dos se avisan y siguen ocupando su
// rectángulo actual. Es función pura: no toca la base.
export function planificarReubicacion(
  mesas: readonly MesaParaReubicar[],
  mesasConReservaActiva: ReadonlySet<string>,
): PlanReubicacion {
  const ordenadas = [...mesas].sort((a, b) => a.numero - b.numero);
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
