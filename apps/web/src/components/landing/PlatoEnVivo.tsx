import { useState } from 'react';

const VISTAS = [
  { id: 'textura', chip: 'Con textura', alt: 'con textura', archivo: 'torta-3d-textura.webp' },
  { id: 'malla', chip: 'Malla', alt: 'en malla', archivo: 'torta-3d-malla.webp' },
  { id: 'arriba', chip: 'De arriba', alt: 'vista de arriba', archivo: 'torta-3d-arriba.webp' },
  { id: 'frente', chip: 'De frente', alt: 'vista de frente', archivo: 'torta-3d-frente.webp' },
] as const;

const claseChip =
  'inline-flex min-h-11 items-center rounded-full px-4 text-[14px] leading-5 font-semibold transition active:scale-[0.98]';

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
            className={`absolute inset-0 size-full object-contain p-8 pt-20 transition-opacity duration-500 md:p-14 md:pt-24 ${
              activa ? 'mesa-flota opacity-100' : 'opacity-0'
            }`}
          />
        );
      })}
      <div className="absolute left-4 top-4 right-4 flex flex-wrap gap-2">
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
