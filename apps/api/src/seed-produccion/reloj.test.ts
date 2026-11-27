import { diasDelHistorial, FERIADOS_2026, instanteBA } from './reloj';

describe('reloj', () => {
  it('el historial tiene 182 días, de hoy-182 a hoy-1', () => {
    const dias = diasDelHistorial('2026-11-27');
    expect(dias).toHaveLength(182);
    expect(dias[0]).toBe('2026-05-29');
    expect(dias[181]).toBe('2026-11-26');
  });

  it('instanteBA convierte la hora de Buenos Aires a UTC', () => {
    expect(instanteBA('2026-11-26', '23:00').toISOString()).toBe('2026-11-27T02:00:00.000Z');
    expect(instanteBA('2026-11-26', '23:00', 30).toISOString()).toBe('2026-11-27T02:30:00.000Z');
  });

  it('incluye feriados del rango', () => {
    expect(FERIADOS_2026.has('2026-07-09')).toBe(true);
    expect(FERIADOS_2026.has('2026-12-25')).toBe(true);
  });
});
