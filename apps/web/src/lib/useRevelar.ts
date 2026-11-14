import { useEffect, useLayoutEffect, useRef } from 'react';

// Devuelve un ref para un contenedor: al entrar en pantalla (una sola vez) le pone
// `data-visto`, y el CSS hace aparecer a sus hijos. Sin JS o con movimiento reducido,
// todo se ve desde el principio.
export function useRevelar<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    document.documentElement.dataset.revelar = 'listo';
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.dataset.visto = '';
      return;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          el.dataset.visto = '';
          observador.disconnect();
        }
      },
      { threshold: 0, rootMargin: '0px' },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return ref;
}
