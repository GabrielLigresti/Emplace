// Valor de la variable TRUST_PROXY para Express: una cantidad de saltos (número)
// o un nombre, lista de IP o subredes (texto), como `loopback`.
export function parsearTrustProxy(valor: string): number | string {
  const limpio = valor.trim();
  return /^\d+$/.test(limpio) ? Number(limpio) : limpio;
}
