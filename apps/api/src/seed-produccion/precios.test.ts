import { crearAzar } from './azar';
import { costoEnFecha, crearEscalonesCarta, precioEnFecha, redondearCentena } from './precios';
import { sumarDias } from './reloj';

const hoy = '2026-11-27';
const ruido0 = [0, 0, 0, 0, 0, 0];

describe('precios', () => {
  it('redondearCentena', () => {
    expect(redondearCentena(26437)).toBe(26400);
  });

  it('costoEnFecha: hoy es el ancla y seis meses antes ronda 1000/1,023^6', () => {
    expect(costoEnFecha(1000, 0.023, ruido0, hoy, hoy)).toBe(1000);
    const esperado = 1000 / Math.pow(1.023, 6);
    const c = costoEnFecha(1000, 0.023, ruido0, hoy, sumarDias(hoy, -182));
    expect(c).toBeLessThan(1000);
    expect(Math.abs(c - esperado) / esperado).toBeLessThan(0.01);
  });

  it('costoEnFecha usa el ruido del mes y baja de forma monótona', () => {
    const ruido = [0.005, -0.005, 0.005, -0.005, 0.005, -0.005];
    const a = costoEnFecha(1000, 0.02, ruido, hoy, sumarDias(hoy, -45));
    const b = costoEnFecha(1000, 0.02, ruido, hoy, sumarDias(hoy, -90));
    expect(b).toBeLessThan(a);
    expect(a).toBeLessThan(1000);
  });

  it('escalones: 3, con factores 1,05-1,07 y el último 2 a 5 semanas antes de hoy', () => {
    for (let s = 1; s <= 20; s++) {
      const e = crearEscalonesCarta(crearAzar(s), hoy);
      expect(e).toHaveLength(3);
      e.forEach((x) => {
        expect(x.factor).toBeGreaterThanOrEqual(1.05);
        expect(x.factor).toBeLessThanOrEqual(1.07);
      });
      expect(e[0]!.fecha < e[1]!.fecha && e[1]!.fecha < e[2]!.fecha).toBe(true);
      expect(e[2]!.fecha <= sumarDias(hoy, -14) && e[2]!.fecha >= sumarDias(hoy, -35)).toBe(true);
    }
  });

  it('precioEnFecha divide por los escalones que todavía no ocurrieron', () => {
    const e = crearEscalonesCarta(crearAzar(3), hoy);
    const [f1, f2, f3] = e.map((x) => x.factor) as [number, number, number];
    expect(precioEnFecha(26400, e, sumarDias(e[0]!.fecha, -1))).toBe(
      redondearCentena(26400 / (f1 * f2 * f3)),
    );
    expect(precioEnFecha(26400, e, e[2]!.fecha)).toBe(26400);
    expect(precioEnFecha(26400, e, hoy)).toBe(26400);
    expect(precioEnFecha(26400, e, e[1]!.fecha)).toBe(redondearCentena(26400 / f3));
  });
});
