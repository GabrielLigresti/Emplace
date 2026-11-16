import { useCallback, useState } from 'react';

const MAXIMO = 5;

function leer(clave: string): string[] {
  try {
    const guardado = JSON.parse(localStorage.getItem(clave) ?? '[]');
    return Array.isArray(guardado) ? guardado.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// Últimos platos que el comensal abrió en una sucursal, del más nuevo al más viejo.
// Vive solo en este navegador: no hay nada que sincronizar con la API.
export function useVistosRecientemente(sucursalId: string | undefined) {
  const clave = `pgim:vistos:${sucursalId ?? ''}`;
  const [ids, setIds] = useState(() => leer(clave));

  const registrar = useCallback(
    (id: string) => {
      const nuevos = [id, ...leer(clave).filter((v) => v !== id)].slice(0, MAXIMO);
      try {
        localStorage.setItem(clave, JSON.stringify(nuevos));
      } catch {
        // Sin almacenamiento (modo privado): la lista de esta visita no se guarda.
      }
      setIds(nuevos);
    },
    [clave],
  );

  return { ids, registrar };
}
