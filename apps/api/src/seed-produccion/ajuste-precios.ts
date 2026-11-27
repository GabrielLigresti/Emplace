import { redondearCentena } from './precios';

const PARRILLA = 'Fuego de Quebracho';
const PIZZERIA = 'Horno de Barrio';
const CATEGORIA_PIZZAS = 'Pizzas';
const CATEGORIA_BEBIDAS = 'Bebidas';

export function aplicarAjuste(precioBase: number, factor: number): number {
  return redondearCentena(precioBase * factor);
}

// Factor de la carta de hoy sobre el precio de seed-deploy.ts.
export function factorPlato(restaurante: string, categoria: string): number {
  if (categoria === CATEGORIA_BEBIDAS) return 1.25;
  if (restaurante === PARRILLA) return 1.6;
  if (restaurante === PIZZERIA && categoria === CATEGORIA_PIZZAS) return 2.4;
  return 1.25;
}

// usosPorCategoria: categorías de plato del restaurante cuyas recetas usan el insumo.
export function factorInsumo(
  restaurante: string,
  _insumo: string,
  usosPorCategoria: Set<string>,
): number {
  if (restaurante === PARRILLA) return 1.6;
  if (
    restaurante === PIZZERIA &&
    usosPorCategoria.size > 0 &&
    [...usosPorCategoria].every((c) => c === CATEGORIA_PIZZAS)
  )
    return 2.4;
  return 1.25;
}

// costoCatalogo es el costo base del insumo en el catálogo de seed-deploy.ts.
export function costoInsumoHoy(
  restaurante: string,
  insumo: string,
  costoCatalogo: number,
  usosPorCategoria: Set<string>,
): number {
  return (
    Math.round(costoCatalogo * factorInsumo(restaurante, insumo, usosPorCategoria) * 100) / 100
  );
}
