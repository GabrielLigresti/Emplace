// Reloj de la seed: America/Argentina/Buenos_Aires es UTC-3 todo el año (sin horario de verano).
const DIA_MS = 86_400_000;
const OFFSET_BA_HORAS = 3;

export function fechaAMs(fecha: string): number {
  const [a = 0, m = 1, d = 1] = fecha.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date(fechaAMs(fecha) + dias * DIA_MS).toISOString().slice(0, 10);
}

// De hoy-182 a hoy-1 inclusive: 182 días. Hoy queda vacío.
export function diasDelHistorial(hoy: string): string[] {
  return Array.from({ length: 182 }, (_, i) => sumarDias(hoy, i - 182));
}

// Hora de pared de Buenos Aires convertida a UTC.
export function instanteBA(fecha: string, hhmm: string, minutosExtra = 0): Date {
  const [h = 0, min = 0] = hhmm.split(':').map(Number);
  return new Date(
    fechaAMs(fecha) + (h + OFFSET_BA_HORAS) * 3_600_000 + (min + minutosExtra) * 60_000,
  );
}

// Feriados nacionales argentinos de 2026, con los trasladables ya movidos y los días puente.
export const FERIADOS_2026: ReadonlySet<string> = new Set([
  '2026-01-01',
  '2026-02-16',
  '2026-02-17',
  '2026-03-23',
  '2026-03-24',
  '2026-04-02',
  '2026-04-03',
  '2026-05-01',
  '2026-05-25',
  '2026-06-15',
  '2026-06-20',
  '2026-07-09',
  '2026-07-10',
  '2026-08-17',
  '2026-10-12',
  '2026-11-23',
  '2026-12-07',
  '2026-12-08',
  '2026-12-25',
]);
