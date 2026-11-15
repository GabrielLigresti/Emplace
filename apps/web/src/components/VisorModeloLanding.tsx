import type { ModelViewerElement } from '@google/model-viewer';
import { useRef } from 'react';
import { useModelViewer } from '../lib/useModelViewer';

// Ficha de la landing: el modelo 3D que se gira con el dedo y el botón que abre
// "Ver en mi mesa" (la RA nativa del dispositivo). Es una muestra, sin pedido
// ni mesa; el visor completo del plato es VisorRA.
export function VisorModeloLanding({ src, nombre }: { src: string; nombre: string }) {
  const listo = useModelViewer();
  const visor = useRef<ModelViewerElement>(null);

  if (!listo) return null;
  return (
    <div className="relative size-full">
      <model-viewer
        ref={visor}
        src={src}
        alt={nombre || 'Modelo 3D de un plato'}
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        auto-rotate
        shadow-intensity="1"
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <button slot="ar-button" hidden />
      </model-viewer>
      <button
        type="button"
        onClick={() => void visor.current?.activateAR()}
        className="absolute bottom-3 left-3 inline-flex min-h-11 items-center rounded-cuadrado bg-dorado-700 px-5 font-titulo text-base font-semibold text-white hover:bg-dorado-800"
      >
        Ver en mi mesa
      </button>
    </div>
  );
}
