import type { ModelViewerElement } from '@google/model-viewer';
import { useEffect, useRef, useState } from 'react';
import { useModelViewer } from '../lib/useModelViewer';

// Ficha de la landing: el modelo 3D que se gira con el dedo y el botón que abre
// "Ver en mi mesa" (la RA nativa del dispositivo). Es una muestra, sin pedido
// ni mesa; el visor completo del plato es VisorRA.
export function VisorModeloLanding({ src, nombre }: { src: string; nombre: string }) {
  const listo = useModelViewer();
  const visor = useRef<ModelViewerElement>(null);
  const [cargado, setCargado] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [conRa, setConRa] = useState(false);
  // En el celular, el arrastre sobre el modelo lo giraría y no deslizaría el carrusel:
  // el giro con el dedo se activa recién al tocar la ficha. Con mouse, siempre.
  const [girar, setGirar] = useState(false);
  const [sinMovimiento] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const el = visor.current;
    if (!el) return;
    const alCargar = () => {
      setCargado(true);
      setConRa(el.canActivateAR);
    };
    const alFallar = () => setFallo(true);
    el.addEventListener('load', alCargar);
    el.addEventListener('error', alFallar);
    return () => {
      el.removeEventListener('load', alCargar);
      el.removeEventListener('error', alFallar);
    };
  }, [listo]);

  if (!listo) return null;
  if (fallo) return null;
  return (
    <div
      className="relative size-full"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setGirar(true)}
      onPointerLeave={() => setGirar(false)}
      onClick={() => setGirar(true)}
    >
      <model-viewer
        ref={visor}
        src={src}
        alt={nombre || 'Modelo 3D de un plato'}
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls={girar}
        auto-rotate={!sinMovimiento}
        touch-action="pan-y"
        shadow-intensity="1"
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <button slot="ar-button" hidden />
      </model-viewer>
      {cargado && conRa && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void visor.current?.activateAR();
          }}
          className="absolute bottom-3 left-3 inline-flex min-h-11 items-center rounded-cuadrado bg-dorado-700 px-5 font-titulo text-base font-semibold text-white hover:bg-dorado-800"
        >
          Ver en mi mesa
        </button>
      )}
    </div>
  );
}
