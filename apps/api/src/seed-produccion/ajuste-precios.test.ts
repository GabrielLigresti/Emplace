import { aplicarAjuste, costoInsumoHoy, factorInsumo, factorPlato } from './ajuste-precios';

describe('ajuste de precios de hoy', () => {
  it('aplica el factor y redondea a centenas', () => {
    expect(aplicarAjuste(11000, 2.4)).toBe(26400);
    expect(aplicarAjuste(2000, 1.25)).toBe(2500);
    expect(aplicarAjuste(4800, 1.25)).toBe(6000);
    expect(aplicarAjuste(4200, 1.6)).toBe(6700);
  });

  it('elige el factor de cada plato según restaurante y categoría', () => {
    expect(factorPlato('Fuego de Quebracho', 'Principales')).toBe(1.6);
    expect(factorPlato('Horno de Barrio', 'Pizzas')).toBe(2.4);
    expect(factorPlato('Horno de Barrio', 'Postres')).toBe(1.25);
    expect(factorPlato('Hoshi Sushi Bar', 'Bebidas')).toBe(1.25);
    expect(factorPlato('Doble Medallón', 'Hamburguesas')).toBe(1.25);
  });

  it('las bebidas suben 25 % también en la parrilla', () => {
    expect(factorPlato('Fuego de Quebracho', 'Bebidas')).toBe(1.25);
  });

  it('el insumo que solo usan las pizzas toma 2,4', () => {
    expect(factorInsumo('Horno de Barrio', 'Muzzarella', new Set(['Pizzas']))).toBe(2.4);
  });

  it('el insumo que usan las pizzas y otra categoría toma 1,25', () => {
    expect(factorInsumo('Horno de Barrio', 'Tomate', new Set(['Pizzas', 'Postres']))).toBe(1.25);
  });

  it('los insumos de la parrilla toman 1,6 y los del resto 1,25', () => {
    expect(factorInsumo('Fuego de Quebracho', 'Chorizo', new Set(['Principales']))).toBe(1.6);
    expect(factorInsumo('Nonna Ermelinda', 'Harina', new Set(['Pastas']))).toBe(1.25);
  });

  it('el costo de hoy es el del catálogo por el factor', () => {
    expect(costoInsumoHoy('Horno de Barrio', 'Muzzarella', 10, new Set(['Pizzas']))).toBe(24);
    expect(costoInsumoHoy('Fuego de Quebracho', 'Chorizo', 10, new Set(['Principales']))).toBe(16);
  });
});
