// Azar determinista para la seed de producción: todo sale de un único generador con semilla.
export interface Azar {
  (): number;
  entero(min: number, max: number): number;
  elegir<T>(xs: readonly T[]): T;
  ponderado<T>(xs: readonly [T, number][]): T;
  normal(media: number, desvio: number): number;
}

// mulberry32
export function crearAzar(semilla: number): Azar {
  let estado = semilla >>> 0;
  const siguiente = (): number => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const azar = siguiente as Azar;
  azar.entero = (min, max) => min + Math.floor(siguiente() * (max - min + 1));
  azar.elegir = (xs) => xs[Math.floor(siguiente() * xs.length)]!;
  azar.ponderado = (xs) => {
    const total = xs.reduce((suma, [, peso]) => suma + peso, 0);
    let punto = siguiente() * total;
    for (const [valor, peso] of xs) {
      punto -= peso;
      if (punto < 0) return valor;
    }
    return xs[xs.length - 1]![0];
  };
  // Box-Muller
  azar.normal = (media, desvio) => {
    const u = 1 - siguiente();
    const v = siguiente();
    return media + desvio * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return azar;
}

// UUID v4 armado con el azar (no se usa randomUUID para que la salida sea reproducible).
export function uuidDesde(azar: Azar): string {
  const hex = (n: number): string =>
    Array.from({ length: n }, () => azar.entero(0, 15).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[azar.entero(0, 3)]}${hex(3)}-${hex(12)}`;
}
