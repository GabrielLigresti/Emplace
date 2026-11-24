import { LIENZO_SALON } from '@pgim/shared';
import { planificarReubicacion, type MesaParaReubicar } from './reubicacion-mesas';

const mesa = (
  numero: number,
  posX: number,
  posY: number,
  capacidad = 4,
  vertical = false,
): MesaParaReubicar => ({ id: `m${numero}`, numero, capacidad, vertical, posX, posY });

const SIN_RESERVAS = new Set<string>();

// Aplica el plan para comprobar que una segunda corrida ya no mueve nada.
function aplicar(mesas: MesaParaReubicar[], plan: ReturnType<typeof planificarReubicacion>) {
  return mesas.map((m) => {
    const mov = plan.movimientos.find((x) => x.id === m.id);
    return mov ? { ...m, ...mov.hasta } : m;
  });
}

describe('planificarReubicacion', () => {
  it('no mueve nada si todas entran y no se pisan', () => {
    const mesas = [mesa(1, 10, 10), mesa(2, 40, 10), mesa(3, 70, 30)];
    expect(planificarReubicacion(mesas, SIN_RESERVAS)).toEqual({ movimientos: [], avisos: [] });
  });

  it('el borde compartido no cuenta como superposición', () => {
    // Mesas de 4: 15 × 10; centros a 15 de distancia en X comparten borde.
    const mesas = [mesa(1, 10, 10), mesa(2, 25, 10)];
    expect(planificarReubicacion(mesas, SIN_RESERVAS).movimientos).toEqual([]);
  });

  it('mueve la de número mayor cuando dos se superponen', () => {
    const mesas = [mesa(1, 10, 10), mesa(2, 14, 10)];
    const { movimientos, avisos } = planificarReubicacion(mesas, SIN_RESERVAS);
    expect(avisos).toEqual([]);
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0]).toMatchObject({ id: 'm2', numero: 2, desde: { posX: 14, posY: 10 } });
  });

  it('reubica la que queda fuera del lienzo', () => {
    const mesas = [mesa(1, 10, 10), mesa(2, LIENZO_SALON.ancho + 20, 10)];
    const { movimientos } = planificarReubicacion(mesas, SIN_RESERVAS);
    expect(movimientos.map((m) => m.numero)).toEqual([2]);
    expect(movimientos[0]!.hasta.posX).toBeLessThan(LIENZO_SALON.ancho);
  });

  it('desapila las mesas nacidas todas en (50, 30) y conserva la primera', () => {
    const mesas = [mesa(1, 50, 30), mesa(2, 50, 30), mesa(3, 50, 30)];
    const plan = planificarReubicacion(mesas, SIN_RESERVAS);
    expect(plan.movimientos.map((m) => m.numero)).toEqual([2, 3]);
    const destinos = plan.movimientos.map((m) => `${m.hasta.posX},${m.hasta.posY}`);
    expect(new Set(destinos).size).toBe(2);
  });

  it('mueve la mesa sin reserva que pisa a una con reserva activa, aunque tenga número menor', () => {
    const mesas = [mesa(1, 10, 10), mesa(2, 12, 10)];
    const plan = planificarReubicacion(mesas, new Set(['m2']));
    expect(plan.avisos).toEqual([]);
    expect(plan.movimientos.map((m) => m.numero)).toEqual([1]);
  });

  it('no mueve una mesa con reserva activa que no entra en el lienzo y avisa', () => {
    const mesas = [mesa(1, 10, 10), mesa(2, 130, 10)];
    const plan = planificarReubicacion(mesas, new Set(['m2']));
    expect(plan.movimientos).toEqual([]);
    expect(plan.avisos).toEqual([{ numero: 2, motivo: 'RESERVA_ACTIVA' }]);
  });

  it('dos mesas con reserva activa que se pisan: se avisa de la de número mayor y ninguna se mueve', () => {
    const mesas = [mesa(1, 10, 10), mesa(2, 12, 10)];
    const plan = planificarReubicacion(mesas, new Set(['m1', 'm2']));
    expect(plan.movimientos).toEqual([]);
    expect(plan.avisos).toEqual([{ numero: 2, motivo: 'RESERVA_ACTIVA' }]);
  });

  it('la mesa con reserva activa sigue ocupando su lugar para las demás', () => {
    // La 2 queda quieta; la 1 y la 3 se la pisaban y no pueden caer encima.
    const mesas = [mesa(1, 10, 10), mesa(2, 12, 10), mesa(3, 12, 10)];
    const plan = planificarReubicacion(mesas, new Set(['m2']));
    expect(plan.movimientos.map((m) => m.numero)).toEqual([1, 3]);
    for (const mov of plan.movimientos) {
      expect(mov.hasta).not.toEqual({ posX: 12, posY: 10 });
    }
  });

  it('avisa y sigue si el salón está lleno', () => {
    // Una mesa de 8 enorme que ocupa todo el lienzo útil; la otra no entra.
    const mesas = [
      mesa(1, LIENZO_SALON.ancho / 2, LIENZO_SALON.alto / 2, 8),
      ...Array.from({ length: 30 }, (_, i) => mesa(i + 2, 50, 30, 8)),
    ];
    // Se llena el lienzo con mesas de 8 y las que sobran se avisan sin moverse.
    const plan = planificarReubicacion(mesas, SIN_RESERVAS);
    expect(plan.avisos.length).toBeGreaterThan(0);
    expect(plan.avisos.every((a) => a.motivo === 'SIN_LUGAR')).toBe(true);
    const conAviso = new Set(plan.avisos.map((a) => a.numero));
    expect(plan.movimientos.some((m) => conAviso.has(m.numero))).toBe(false);
  });

  it('es idempotente: aplicar el plan y volver a planificar no mueve nada', () => {
    const mesas = [
      mesa(1, 50, 30),
      mesa(2, 50, 30),
      mesa(3, 52, 31, 8),
      mesa(4, 200, 5, 2, true),
      mesa(5, 50, 30, 6, true),
    ];
    const plan = planificarReubicacion(mesas, SIN_RESERVAS);
    expect(plan.movimientos.length).toBeGreaterThan(0);
    const despues = aplicar(mesas, plan);
    expect(planificarReubicacion(despues, SIN_RESERVAS)).toEqual({ movimientos: [], avisos: [] });
  });
});
