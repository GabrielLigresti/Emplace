import type { RefObject } from 'react';
import type { EstadoSesion } from '../lib/useSesionRa';

const INSTRUCCIONES: Record<EstadoSesion, string> = {
  abriendo: 'Abriendo la cámara…',
  buscando: 'Mové el celular despacio, apuntando a la mesa.',
  apuntando: 'Apuntá el anillo al centro del plato y tocá la pantalla.',
  colocado: 'Tocá otro punto para moverlo.',
};

// Los botones de la capa sobre la cámara no cuentan como toques para ubicar el plato.
const frenarSeleccion = (e: Event) => e.preventDefault();

// Capa sobre la cámara durante la RA propia (dom-overlay de WebXR): instrucciones
// y botones. Se renderiza siempre; oculta mientras no hay sesión.
export function CapaRa({
  capa,
  sesion,
  nombre,
  porcion,
  diagnostico,
  alSalir,
  alAgregar,
  cantidadEnPedido = 0,
}: {
  capa: RefObject<HTMLDivElement | null>;
  sesion: EstadoSesion | null;
  nombre: string;
  porcion?: string;
  diagnostico?: string | null;
  alSalir: () => void;
  alAgregar?: () => void;
  cantidadEnPedido?: number;
}) {
  return (
    <div ref={capa} className={sesion ? 'fixed inset-0 z-50' : 'hidden'}>
      <div className="absolute inset-x-4 top-4 rounded-panel bg-black/60 px-4 py-3 text-center text-white">
        <p className="font-medium">{nombre}</p>
        <p className="text-sm">{sesion && INSTRUCCIONES[sesion]}</p>
        {porcion && <p className="text-xs opacity-80">Porción: {porcion}</p>}
        {diagnostico && <p className="mt-1 font-mono text-xs opacity-90">{diagnostico}</p>}
      </div>
      <div className="absolute inset-x-4 bottom-8 flex justify-center gap-3">
        <button
          type="button"
          ref={(b) => {
            b?.addEventListener('beforexrselect', frenarSeleccion);
          }}
          onClick={alSalir}
          className="min-h-12 rounded-full bg-surface px-6 font-semibold text-ink shadow-flotante"
        >
          Salir
        </button>
        {alAgregar && (
          <button
            type="button"
            ref={(b) => {
              b?.addEventListener('beforexrselect', frenarSeleccion);
            }}
            onClick={alAgregar}
            className="min-h-12 rounded-full bg-accent px-6 font-semibold text-white shadow-flotante"
          >
            {cantidadEnPedido > 0
              ? `Agregar otro (${cantidadEnPedido} en el pedido)`
              : 'Agregar al pedido'}
          </button>
        )}
      </div>
    </div>
  );
}
