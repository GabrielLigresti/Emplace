import { useLayoutEffect } from 'react';

// Activa la paleta del staff (clase `tema-staff` en <html>) mientras la pantalla está montada.
export function useTemaStaff() {
  useLayoutEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.add('tema-staff');
    return () => raiz.classList.remove('tema-staff');
  }, []);
}
