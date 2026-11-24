import type { ModelViewerElement } from '@google/model-viewer';
import { useEffect, useRef, useState } from 'react';
import type { ModeloRa } from '@pgim/shared';
import { formatoCantidad } from '../lib/formato';
import { useModelViewer } from '../lib/useModelViewer';
import { useSesionRa } from '../lib/useSesionRa';
import { CapaRa } from './CapaRa';

type Estado = 'cargando' | 'listo' | 'sin-ra' | 'fallo-ra' | 'error';

const MENSAJES: Partial<Record<Estado, string>> = {
  'sin-ra': 'Este dispositivo no permite ver el plato en realidad aumentada.',
  'fallo-ra': 'No se pudo abrir la realidad aumentada (¿se negó el permiso de la cámara?).',
  error: 'No se pudo cargar el modelo 3D del plato.',
};

// Visor de CU-10: el plato en 3D y el botón "Ver en RA" a escala real. En
// Android con WebXR, la RA es propia (ver lib/ra-webxr): el comensal apunta al
// plato y el modelo aparece apoyado ahí. Si no hay WebXR, model-viewer abre
// Quick Look (iOS, con el .usdz o el que genera) o Scene Viewer. E2: sin RA o
// si falla, se muestra la foto del plato con la porción.
export function VisorRA({
  modelo,
  nombre,
  fotoUrl,
  alAgregar,
  cantidadEnPedido = 0,
}: {
  modelo: ModeloRa;
  nombre: string;
  fotoUrl: string | null;
  // Con la mesa activa: "Agregar al pedido" dentro de la RA (flujo A de CU-10).
  alAgregar?: () => void;
  cantidadEnPedido?: number;
}) {
  const listo = useModelViewer();
  const visor = useRef<ModelViewerElement>(null);
  const [estado, setEstado] = useState<Estado>('cargando');
  const { webXR, sesion, diagnostico, capa, abrir, salir } = useSesionRa();

  useEffect(() => {
    const el = visor.current;
    if (!el || webXR === null) return;
    const alCargar = () => setEstado(webXR || el.canActivateAR ? 'listo' : 'sin-ra');
    const alFallar = () => setEstado('error');
    const alCambiarRA = (e: Event) => {
      if ((e as CustomEvent<{ status: string }>).detail.status === 'failed') setEstado('fallo-ra');
    };
    if (el.loaded) alCargar();
    el.addEventListener('load', alCargar);
    el.addEventListener('error', alFallar);
    el.addEventListener('ar-status', alCambiarRA);
    return () => {
      el.removeEventListener('load', alCargar);
      el.removeEventListener('error', alFallar);
      el.removeEventListener('ar-status', alCambiarRA);
    };
  }, [listo, webXR]);

  async function abrirRa() {
    if (!(await abrir(modelo))) setEstado('fallo-ra');
  }

  const escala = `${modelo.escalaReal} ${modelo.escalaReal} ${modelo.escalaReal}`;
  const porcion = formatoCantidad(modelo.porcionGramos, 'GRAMO');
  const mensaje = MENSAJES[estado];
  // Sin WebXR, la RA la abre model-viewer (Quick Look o Scene Viewer).
  const arDeModelViewer = webXR === false;

  return (
    <div className="space-y-3">
      {estado !== 'error' && listo && webXR !== null && (
        <div className="relative">
          <model-viewer
            ref={visor}
            src={modelo.urlModelo}
            ios-src={modelo.urlModeloIos ?? undefined}
            alt={`Modelo 3D de ${nombre}`}
            ar={arDeModelViewer}
            ar-modes="quick-look scene-viewer"
            ar-scale="fixed"
            camera-controls
            touch-action="pan-y"
            scale={escala}
            style={{
              width: '100%',
              height: '18rem',
              background: 'var(--color-surface)',
              borderRadius: 8,
            }}
          >
            {arDeModelViewer && (
              <button slot="ar-button" type="button" className={claseBotonRa}>
                Ver en mi mesa
              </button>
            )}
          </model-viewer>
          {webXR && (estado === 'listo' || estado === 'fallo-ra') && (
            <button
              type="button"
              onClick={abrirRa}
              disabled={sesion !== null}
              className={claseBotonRa}
            >
              {sesion === 'abriendo' ? 'Abriendo…' : 'Ver en mi mesa'}
            </button>
          )}
        </div>
      )}
      {estado === 'cargando' && <p className="text-sm text-meta">Cargando el modelo 3D…</p>}
      {estado === 'listo' && (
        <p className="text-sm text-meta">
          Tocá “Ver en mi mesa” y apuntá al centro del plato: aparece a tamaño real ({porcion}).
        </p>
      )}
      {mensaje && (
        <div className="space-y-2 rounded-panel border border-line bg-surface p-3">
          <p className="text-sm text-meta">{mensaje}</p>
          {fotoUrl && (
            <img
              src={fotoUrl}
              alt={nombre}
              className="aspect-video w-full rounded-control object-cover"
            />
          )}
          <p className="text-sm text-meta">Porción: {porcion}</p>
        </div>
      )}

      <CapaRa
        capa={capa}
        sesion={sesion}
        nombre={nombre}
        porcion={porcion}
        diagnostico={diagnostico}
        alSalir={salir}
        alAgregar={alAgregar}
        cantidadEnPedido={cantidadEnPedido}
      />
    </div>
  );
}

const claseBotonRa =
  'absolute bottom-3 left-1/2 min-h-11 -translate-x-1/2 rounded-full bg-accent px-5 font-semibold text-white shadow-flotante hover:bg-accent-hover disabled:opacity-70';
