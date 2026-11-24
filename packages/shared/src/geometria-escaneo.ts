import { VISTAS, ANGULO_VISTA, distanciaAngular, type VistaEscaneo } from './calidad-fotos';

// Geometría de la aureola del escaneo: funciones puras sobre posiciones en el
// espacio de la sesión (metros, +Y hacia arriba). La web las usa para pintar los
// tramos y decidir cuándo sacar cada foto.

export interface Punto3 {
  x: number;
  y: number;
  z: number;
}

export const TRAMOS_AUREOLA = 36;
const GRADOS_POR_TRAMO = 360 / TRAMOS_AUREOLA;
// Separación entre el borde del plato y la aureola.
const MARGEN_AUREOLA_CM = 4;

const norm360 = (g: number) => ((g % 360) + 360) % 360;

// Grados en [0, 360) sobre el plano XZ, horario visto desde arriba (+Y):
// 0 en -Z, 90 en +X, 180 en +Z, 270 en -X.
export function anguloAlrededor(centro: Punto3, camara: Punto3): number {
  return norm360((Math.atan2(camara.x - centro.x, -(camara.z - centro.z)) * 180) / Math.PI);
}

export function anguloRelativo(angulo: number, inicio: number): number {
  return norm360(angulo - inicio);
}

export function tramoDeAngulo(anguloRel: number): number {
  return Math.min(TRAMOS_AUREOLA - 1, Math.floor(norm360(anguloRel) / GRADOS_POR_TRAMO));
}

export function vistaCercana(anguloRel: number, toleranciaGrados: number): VistaEscaneo | null {
  return (
    VISTAS.find((v) => distanciaAngular(anguloRel, ANGULO_VISTA[v]) <= toleranciaGrados) ?? null
  );
}

// ¿La dirección de la cámara se desvía menos de maxGrados de la línea al centro?
export function apuntaAlCentro(
  camara: Punto3,
  direccion: Punto3,
  centro: Punto3,
  maxGrados: number,
): boolean {
  const hacia = { x: centro.x - camara.x, y: centro.y - camara.y, z: centro.z - camara.z };
  const largoA = Math.hypot(direccion.x, direccion.y, direccion.z);
  const largoB = Math.hypot(hacia.x, hacia.y, hacia.z);
  if (largoA === 0 || largoB === 0) return false;
  const cos =
    (direccion.x * hacia.x + direccion.y * hacia.y + direccion.z * hacia.z) / (largoA * largoB);
  const grados = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  return grados < maxGrados;
}

export function vueltaCompleta(tramos: readonly boolean[]): boolean {
  return tramos.length === TRAMOS_AUREOLA && tramos.every(Boolean);
}

export function radioAureolaM(diametroCm: number): number {
  return (diametroCm / 2 + MARGEN_AUREOLA_CM) / 100;
}
