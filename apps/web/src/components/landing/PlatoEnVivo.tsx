import { useState } from 'react';

const VISTAS = [
  { id: 'textura', chip: 'Color', alt: 'con color', archivo: 'torta-3d-textura.webp' },
  { id: 'malla', chip: 'Sin color', alt: 'sin color', archivo: 'torta-3d-malla.webp' },
  { id: 'arriba', chip: 'Arriba', alt: 'vista de arriba', archivo: 'torta-3d-arriba.webp' },
  { id: 'frente', chip: 'Frente', alt: 'vista de frente', archivo: 'torta-3d-frente.webp' },
] as const;

const claseChip =
  'inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-[14px] md:px-4 leading-5 font-semibold transition active:scale-[0.98]';

// Segundo slide del carrusel: las vistas de un plato escaneado en 3D.
export function PlatoEnVivo() {
  const [elegida, setElegida] = useState<(typeof VISTAS)[number]['id']>('textura');

  return (
    <div className="relative size-full bg-hoja">
      {VISTAS.map((v) => {
        const activa = v.id === elegida;
        return (
          <img
            key={v.id}
            src={`/fotos-portada/${v.archivo}`}
            alt={`Torta de chocolate y frutillas escaneada en 3D, ${v.alt}`}
            aria-hidden={activa ? undefined : true}
            className={`absolute inset-0 size-full object-contain p-3 pb-16 transition-opacity duration-500 md:p-12 md:pb-24 ${
              activa ? 'mesa-flota opacity-100' : 'opacity-0'
            }`}
          />
        );
      })}
      <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-2">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={v.id === elegida}
            onClick={() => setElegida(v.id)}
            className={`${claseChip} ${v.id === elegida ? 'bg-accent text-white' : 'bg-surface text-text'}`}
          >
            {v.chip}
          </button>
        ))}
      </div>
    </div>
  );
}
