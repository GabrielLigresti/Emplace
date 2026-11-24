import { useLayoutEffect } from 'react';

// Activa la paleta Clásica (staff y comensal; clase `tema-staff` en <html>) mientras la pantalla está montada.
export function useTemaStaff() {
  useLayoutEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.add('tema-staff');
    return () => raiz.classList.remove('tema-staff');
  }, []);
}
