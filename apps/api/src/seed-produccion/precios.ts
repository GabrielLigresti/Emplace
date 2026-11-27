import type { Azar } from './azar';
import { fechaAMs, sumarDias } from './reloj';

const DIA_MS = 86_400_000;
const DIAS_POR_MES = 30.4375;

export interface Escalon {
  fecha: string;
  factor: number;
}

export function redondearCentena(n: number): number {
  return Math.round(n / 100) * 100;
}

// El costo de hoy es el ancla. Hacia atrás se descuenta mes a mes con tasa + ruido[k] del mes k
// (k = 0 es el mes más cercano a hoy). Un mes parcial descuenta la fracción en forma geométrica,
// con el ruido de ese mes. Si faltan meses de ruido se repite el último.
export function costoEnFecha(
  costoHoy: number,
  tasaMensual: number,
  ruido: number[],
  hoy: string,
  fecha: string,
): number {
  const meses = Math.max(0, (fechaAMs(hoy) - fechaAMs(fecha)) / DIA_MS / DIAS_POR_MES);
  const tasaDe = (k: number): number =>
    1 + tasaMensual + (ruido.length ? ruido[Math.min(k, ruido.length - 1)]! : 0);
  const completos = Math.floor(meses);
  let divisor = 1;
  for (let k = 0; k < completos; k++) divisor *= tasaDe(k);
  divisor *= Math.pow(tasaDe(completos), meses - completos);
  return Math.round((costoHoy / divisor) * 100) / 100;
}

// 3 aumentos de entre 5 % y 7 %, cada ~2 meses; el último entre 2 y 5 semanas antes de hoy.
export function crearEscalonesCarta(azar: Azar, hoy: string): Escalon[] {
  const ultimo = sumarDias(hoy, -azar.entero(14, 35));
  const medio = sumarDias(ultimo, -azar.entero(50, 70));
  const primero = sumarDias(medio, -azar.entero(50, 70));
  return [primero, medio, ultimo].map((fecha) => ({
    fecha,
    factor: Math.round((1.05 + azar() * 0.02) * 1000) / 1000,
  }));
}

// Cada escalón rige desde su fecha: hacia atrás se divide por los que todavía no ocurrieron.
export function precioEnFecha(precioHoy: number, escalones: Escalon[], fecha: string): number {
  const futuros = escalones.filter((e) => e.fecha > fecha);
  if (futuros.length === 0) return precioHoy;
  return redondearCentena(precioHoy / futuros.reduce((p, e) => p * e.factor, 1));
}
