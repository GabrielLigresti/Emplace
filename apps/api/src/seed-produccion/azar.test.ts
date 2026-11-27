import { crearAzar, uuidDesde } from './azar';

describe('azar', () => {
  const secuencia = (semilla: number) => {
    const a = crearAzar(semilla);
    return Array.from({ length: 10 }, () => a());
  };

  it('misma semilla, misma secuencia; semilla distinta, otra', () => {
    expect(secuencia(1)).toEqual(secuencia(1));
    expect(secuencia(1)).not.toEqual(secuencia(2));
  });

  it('entero, elegir, ponderado y normal respetan sus rangos', () => {
    const a = crearAzar(7);
    for (let i = 0; i < 200; i++) {
      const n = a.entero(3, 5);
      expect(n >= 3 && n <= 5).toBe(true);
    }
    expect(['x', 'y']).toContain(a.elegir(['x', 'y']));
    expect(
      a.ponderado([
        ['a', 0],
        ['b', 1],
      ]),
    ).toBe('b');
    const muestras = Array.from({ length: 2000 }, () => a.normal(10, 2));
    const media = muestras.reduce((s, x) => s + x, 0) / muestras.length;
    expect(Math.abs(media - 10)).toBeLessThan(0.3);
  });

  it('uuidDesde arma un UUID v4 reproducible', () => {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(uuidDesde(crearAzar(1))).toMatch(re);
    expect(uuidDesde(crearAzar(1))).toBe(uuidDesde(crearAzar(1)));
  });
});
