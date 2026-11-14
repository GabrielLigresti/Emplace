import type { ModelViewerElement } from '@google/model-viewer';
import { useEffect, useRef, useState } from 'react';
import { useModelViewer } from '../../lib/useModelViewer';

const PLATOS = [
  {
    id: 'bife',
    chip: 'Bife de chorizo, 400 g',
    nombre: 'bife de chorizo',
    modelo: '/modelos-demo/bife.glb',
    foto: '/fotos-demo/grandes/bife-de-chorizo-con-papas.jpg',
    alt: 'Bife de chorizo con papas, de la carta de La Parrilla Demo',
  },
  {
    id: 'flan',
    chip: 'Flan casero, 120 g',
    nombre: 'flan casero',
    modelo: '/modelos-demo/flan.glb',
    foto: '/fotos-demo/grandes/flan-casero.jpg',
    alt: 'Flan casero con dulce de leche y crema, de la carta de La Parrilla Demo',
  },
] as const;

const claseChip =
  'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition active:scale-[0.98]';

// Primer slide del carrusel: el plato en 3D, que se gira con el dedo y se abre en la mesa.
export function PlatoEnVivo() {
  const listo = useModelViewer();
  const visor = useRef<ModelViewerElement>(null);
  const [elegido, setElegido] = useState<(typeof PLATOS)[number]['id']>('bife');
  const [fallo, setFallo] = useState(false);
  const plato = PLATOS.find((p) => p.id === elegido) ?? PLATOS[0];
  const reducir =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Un modelo nuevo se vuelve a intentar: el error es del archivo, no del visor.
  useEffect(() => {
    setFallo(false);
  }, [elegido]);

  useEffect(() => {
    const el = visor.current;
    if (!el) return;
    const alFallar = () => setFallo(true);
    el.addEventListener('error', alFallar);
    return () => el.removeEventListener('error', alFallar);
  }, [listo, fallo]);

  return (
    <div className="relative size-full bg-panel">
      {fallo ? (
        <img src={plato.foto} alt={plato.alt} className="size-full object-cover" />
      ) : listo ? (
        <model-viewer
          ref={visor}
          src={plato.modelo}
          alt={`Modelo 3D de ${plato.nombre}`}
          camera-controls
          touch-action="pan-y"
          auto-rotate={reducir ? undefined : true}
          rotation-per-second="18deg"
          interaction-prompt="none"
          shadow-intensity="0"
          ar
          ar-modes="webxr scene-viewer quick-look"
          ar-scale="fixed"
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        >
          <button
            slot="ar-button"
            type="button"
            className="absolute bottom-4 right-4 min-h-11 rounded-control bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98]"
          >
            Ver en mi mesa
          </button>
        </model-viewer>
      ) : (
        <p className="absolute inset-0 flex items-center justify-center text-meta">
          Cargando el plato…
        </p>
      )}
      <div className="absolute left-4 top-4 flex flex-wrap gap-2">
        {PLATOS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === elegido}
            onClick={() => setElegido(p.id)}
            className={`${claseChip} ${p.id === elegido ? 'bg-accent text-white' : 'bg-surface text-text'}`}
          >
            {p.chip}
          </button>
        ))}
      </div>
    </div>
  );
}
