import { convertirUnidad } from '@pgim/shared';

describe('convertirUnidad', () => {
  it('pasa de kilogramos a gramos', () => {
    expect(convertirUnidad(2, 'KILOGRAMO', 'GRAMO')).toBe(2000);
  });

  it('pasa de gramos a kilogramos', () => {
    expect(convertirUnidad(250, 'GRAMO', 'KILOGRAMO')).toBe(0.25);
  });

  it('pasa de litros a mililitros', () => {
    expect(convertirUnidad(1.5, 'LITRO', 'MILILITRO')).toBe(1500);
  });

  it('pasa de mililitros a litros', () => {
    expect(convertirUnidad(500, 'MILILITRO', 'LITRO')).toBe(0.5);
  });

  it('devuelve el mismo valor si la unidad no cambia', () => {
    expect(convertirUnidad(7, 'GRAMO', 'GRAMO')).toBe(7);
    expect(convertirUnidad(3, 'UNIDAD', 'UNIDAD')).toBe(3);
  });

  it('falla al convertir entre dimensiones distintas', () => {
    expect(() => convertirUnidad(1, 'KILOGRAMO', 'LITRO')).toThrow(/No se puede convertir/);
    expect(() => convertirUnidad(1, 'GRAMO', 'MILILITRO')).toThrow();
  });

  it('falla al mezclar unidades contables con peso o volumen', () => {
    expect(() => convertirUnidad(1, 'UNIDAD', 'GRAMO')).toThrow();
    expect(() => convertirUnidad(1, 'LITRO', 'UNIDAD')).toThrow();
  });
});
