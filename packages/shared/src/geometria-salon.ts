import { LIENZO_SALON } from './salon';

// Geometría del plano del salón. posX/posY de la mesa son su centro; el
// rectángulo se expresa con la esquina superior izquierda.
export interface RectanguloMesa {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export interface MesaGeometria {
  capacidad: number;
  vertical?: boolean;
  posX: number;
  posY: number;
}

// Tamaño horizontal por tramo de capacidad; el último tramo no tiene tope.
const TAMANOS_MESA: { hasta: number; ancho: number; alto: number }[] = [
  { hasta: 2, ancho: 10, alto: 8 },
  { hasta: 4, ancho: 15, alto: 10 },
  { hasta: 6, ancho: 20, alto: 10 },
  { hasta: Infinity, ancho: 26, alto: 12 },
];

// Tolerancia para los decimales: el borde compartido no es una superposición.
const EPSILON = 1e-9;

export function dimensionesMesa(
  capacidad: number,
  vertical = false,
): { ancho: number; alto: number } {
  const tramo =
    TAMANOS_MESA.find((t) => capacidad <= t.hasta) ?? TAMANOS_MESA[TAMANOS_MESA.length - 1]!;
  return vertical
    ? { ancho: tramo.alto, alto: tramo.ancho }
    : { ancho: tramo.ancho, alto: tramo.alto };
}

export function rectanguloMesa(m: MesaGeometria): RectanguloMesa {
  const { ancho, alto } = dimensionesMesa(m.capacidad, m.vertical);
  return { x: m.posX - ancho / 2, y: m.posY - alto / 2, ancho, alto };
}

export function entraEnLienzo(r: RectanguloMesa): boolean {
  return (
    r.x >= -EPSILON &&
    r.y >= -EPSILON &&
    r.x + r.ancho <= LIENZO_SALON.ancho + EPSILON &&
    r.y + r.alto <= LIENZO_SALON.alto + EPSILON
  );
}

export function seSuperponen(a: RectanguloMesa, b: RectanguloMesa): boolean {
  return (
    a.x < b.x + b.ancho - EPSILON &&
    b.x < a.x + a.ancho - EPSILON &&
    a.y < b.y + b.alto - EPSILON &&
    b.y < a.y + a.alto - EPSILON
  );
}

// Primer lugar libre recorriendo de arriba abajo y de izquierda a derecha, con
// margen y separación respecto de las demás mesas. Devuelve el centro.
export function buscarLugarLibre(
  capacidad: number,
  vertical: boolean,
  ocupadas: RectanguloMesa[],
  separacion = 2,
): { posX: number; posY: number } | null {
  const { ancho, alto } = dimensionesMesa(capacidad, vertical);
  const ensanchadas = ocupadas.map((o) => ({
    x: o.x - separacion,
    y: o.y - separacion,
    ancho: o.ancho + 2 * separacion,
    alto: o.alto + 2 * separacion,
  }));
  const margen = 2;
  for (let y = margen; y + alto <= LIENZO_SALON.alto; y += 1) {
    for (let x = margen; x + ancho <= LIENZO_SALON.ancho; x += 1) {
      const candidata = { x, y, ancho, alto };
      if (!ensanchadas.some((o) => seSuperponen(candidata, o))) {
        return { posX: x + ancho / 2, posY: y + alto / 2 };
      }
    }
  }
  return null;
}
