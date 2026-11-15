import type { ModelViewerElement } from '@google/model-viewer';
import { useEffect, useRef, useState } from 'react';
import { useModelViewer } from '../lib/useModelViewer';

type EstadoSesion = 'buscando' | 'apuntando' | 'colocado';

// Ficha de la landing: el modelo 3D que se gira con el dedo y el botón que abre
// "Ver en mi mesa". En Android con WebXR abre la RA propia (lib/ra-webxr), la
// misma del comensal; si no, la RA de model-viewer. Es una muestra, sin pedido
// ni mesa; el visor completo del plato es VisorRA.
const INSTRUCCIONES: Record<EstadoSesion, string> = {
  buscando: 'Mové el celular despacio, apuntando a la mesa.',
  apuntando: 'Apuntá el anillo a un lugar de la mesa y tocá la pantalla.',
  colocado: 'Tocá otro punto para moverlo.',
};

// Los botones de la capa sobre la cámara no cuentan como toques para ubicar el plato.
const frenarSeleccion = (e: Event) => e.preventDefault();

export function VisorModeloLanding({ src, nombre }: { src: string; nombre: string }) {
  const listo = useModelViewer();
  const visor = useRef<ModelViewerElement>(null);
  const [cargado, setCargado] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [conRa, setConRa] = useState(false);
  const [webXR, setWebXR] = useState<boolean | null>(null);
  const [sesion, setSesion] = useState<EstadoSesion | 'abriendo' | null>(null);
  const capa = useRef<HTMLDivElement>(null);
  const salir = useRef<(() => void) | null>(null);
  // En el celular, el arrastre sobre el modelo lo giraría y no deslizaría el carrusel:
  // el giro con el dedo se activa recién al tocar la ficha. Con mouse, siempre.
  const [girar, setGirar] = useState(false);
  const [sinMovimiento] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    void import('../lib/ra-webxr').then(({ soportaRaWebXR }) => soportaRaWebXR().then(setWebXR));
    return () => salir.current?.();
  }, []);

  async function abrirRa() {
    if (!capa.current) return;
    setSesion('abriendo');
    try {
      const { iniciarRa } = await import('../lib/ra-webxr');
      salir.current = await iniciarRa({
        urlModelo: src,
        escalaReal: 1,
        overlay: capa.current,
        onEstado: setSesion,
        onFin: () => {
          salir.current = null;
          setSesion(null);
        },
      });
    } catch {
      setSesion(null);
    }
  }

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
        ar={webXR === false}
        ar-modes="scene-viewer quick-look"
        camera-controls={girar}
        auto-rotate={!sinMovimiento}
        touch-action="pan-y"
        shadow-intensity="1"
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <button slot="ar-button" hidden />
      </model-viewer>
      {cargado && (webXR || conRa) && (
        <button
          type="button"
          disabled={sesion !== null}
          onClick={(e) => {
            e.stopPropagation();
            if (webXR) void abrirRa();
            else void visor.current?.activateAR();
          }}
          className="absolute bottom-3 left-3 inline-flex min-h-11 items-center rounded-cuadrado bg-dorado-700 px-5 font-titulo text-base font-semibold text-white hover:bg-dorado-800 disabled:opacity-70"
        >
          {sesion === 'abriendo' ? 'Abriendo…' : 'Ver en mi mesa'}
        </button>
      )}
      {/* Capa sobre la cámara durante la RA propia (dom-overlay de WebXR). */}
      <div ref={capa} className={sesion ? 'fixed inset-0 z-50' : 'hidden'}>
        <div className="absolute inset-x-4 top-4 rounded-cuadrado bg-black/60 px-4 py-3 text-center text-white">
          <p className="m-0 font-semibold">{nombre}</p>
          <p className="m-0 text-sm">
            {sesion && (sesion === 'abriendo' ? 'Abriendo la cámara…' : INSTRUCCIONES[sesion])}
          </p>
        </div>
        <div className="absolute inset-x-4 bottom-8 flex justify-center">
          <button
            type="button"
            ref={(b) => {
              b?.addEventListener('beforexrselect', frenarSeleccion);
            }}
            onClick={() => salir.current?.()}
            className="min-h-12 rounded-cuadrado bg-white px-6 font-titulo text-base font-semibold text-tinta-clasica"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
