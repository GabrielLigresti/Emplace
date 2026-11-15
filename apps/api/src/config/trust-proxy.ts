// Valor de la variable TRUST_PROXY para Express: una cantidad de saltos (número)
// o un nombre, lista de IP o subredes (texto), como `loopback`. Sin valor (la
// línea de .env.example descomentada tal cual) queda en `loopback`.
export function parsearTrustProxy(valor: string): number | string {
  const limpio = valor.trim();
  if (limpio === '') return 'loopback';
  return /^\d+$/.test(limpio) ? Number(limpio) : limpio;
}
