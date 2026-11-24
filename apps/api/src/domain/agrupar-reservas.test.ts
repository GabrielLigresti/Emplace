import { agruparReservasPorRestaurante, type EstadoReserva } from '@pgim/shared';

const reserva = (id: string, restaurante: string, estado: EstadoReserva, dia: string) => ({
  id,
  restaurante: { id: restaurante, nombre: restaurante },
  estado,
  inicio: `2030-01-${dia}T23:00:00.000Z`,
});

describe('agruparReservasPorRestaurante', () => {
  it('ordena las vigentes por proximidad y las anteriores por recientes', () => {
    const [grupo] = agruparReservasPorRestaurante([
      reserva('vencida', 'a', 'VENCIDA', '02'),
      reserva('pendiente', 'a', 'PENDIENTE', '20'),
      reserva('cancelada', 'a', 'CANCELADA', '25'),
      reserva('finalizada', 'a', 'FINALIZADA', '05'),
      reserva('activa', 'a', 'ACTIVA', '10'),
    ]);

    expect(grupo?.vigentes.map((r) => r.id)).toEqual(['activa', 'pendiente']);
    expect(grupo?.anteriores.map((r) => r.id)).toEqual(['cancelada', 'finalizada', 'vencida']);
  });

  it('pone primero el restaurante con la vigente más próxima y al final los de solo historial', () => {
    const grupos = agruparReservasPorRestaurante([
      reserva('1', 'historial-viejo', 'VENCIDA', '01'),
      reserva('2', 'historial-reciente', 'CANCELADA', '28'),
      reserva('3', 'lejana', 'PENDIENTE', '20'),
      reserva('4', 'proxima', 'PENDIENTE', '15'),
      reserva('5', 'proxima', 'FINALIZADA', '03'),
    ]);

    expect(grupos.map((g) => g.restaurante.id)).toEqual([
      'proxima',
      'lejana',
      'historial-reciente',
      'historial-viejo',
    ]);
  });

  it('sin reservas no hay grupos', () => {
    expect(agruparReservasPorRestaurante([])).toEqual([]);
  });
});
