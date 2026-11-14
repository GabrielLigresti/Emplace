import { useEffect, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { PlatoEnVivo } from './PlatoEnVivo';

type Slide = { titulo: string; texto: string; foto?: string; alt?: string; posicion?: string };

const SLIDES: Slide[] = [
  {
    titulo: 'Ver en mi mesa',
    texto:
      'El plato aparece sobre tu mesa a tamaño real, con su porción: 400 g de bife, 120 g de flan.',
    foto: '/fotos-demo/grandes/bife-de-chorizo-con-papas.jpg',
    alt: 'Bife de chorizo con papas, de la carta de La Parrilla Demo',
  },
  {
    titulo: 'Giralo con el dedo',
    texto: 'Este es el plato en 3D. Desde el celular, tocá Ver en mi mesa y aparece sobre tu mesa.',
  },
  {
    titulo: 'Sin instalar nada',
    texto: 'Se abre en el navegador de tu celular. Apuntás la cámara a la mesa y listo.',
    foto: '/fotos-demo/grandes/flan-casero.jpg',
    alt: 'Flan casero con dulce de leche y crema, de la carta de La Parrilla Demo',
    posicion: '72% 62%',
  },
  {
    titulo: 'La carta, sin crear cuenta',
    texto:
      'Buscás el restaurante y abrís la carta. Los platos que están en 3D traen el botón Ver en mi mesa.',
    foto: '/fotos-demo/grandes/provoleta.jpg',
    alt: 'Provoleta, de la carta de La Parrilla Demo',
  },
  {
    titulo: 'Reservá por una hora',
    texto: 'Elegís el día y el horario, y la mesa te espera. Recién ahí te pedimos una cuenta.',
    foto: '/fotos-demo/grandes/empanada-de-carne.jpg',
    alt: 'Empanadas de carne, de la carta de La Parrilla Demo',
  },
  {
    titulo: 'Pedí desde tu mesa',
    texto: 'Pedís desde el celular, pagás con Mercado Pago y sumás puntos en ese restaurante.',
    foto: '/fotos-demo/grandes/milanesa-con-pure.jpg',
    alt: 'Milanesa con puré, de la carta de La Parrilla Demo',
  },
];

const claseControl =
  'inline-flex size-11 items-center justify-center rounded-control bg-accent-soft text-accent-ink transition hover:bg-accent/15 active:scale-[0.98]';

// Portada: la mesa del comensal, donde los platos se van sirviendo uno tras otro.
export function CarruselMesa() {
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [encima, setEncima] = useState(false);
  const [conFoco, setConFoco] = useState(false);
  const [oculta, setOculta] = useState(document.hidden);

  useEffect(() => {
    const alCambiar = () => setOculta(document.hidden);
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, []);

  const avanza = !pausado && !encima && !conFoco && !oculta;

  useEffect(() => {
    if (!avanza) return;
    const t = setTimeout(
      () => setActual((i) => (i + 1) % SLIDES.length),
      actual === 1 ? 12000 : 6000,
    );
    return () => clearTimeout(t);
  }, [avanza, actual]);

  const ir = (delta: number) => setActual((i) => (i + delta + SLIDES.length) % SLIDES.length);

  function alTeclear(e: KeyboardEvent<HTMLElement>) {
    const destino = e.target as HTMLElement;
    if (destino.closest('model-viewer') || !destino.closest('[data-controles]')) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      ir(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      ir(1);
    }
  }

  const slide = SLIDES[actual]!;

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Ver en mi mesa"
      className="flex h-full flex-col overflow-hidden rounded-panel bg-panel"
      onPointerEnter={() => setEncima(true)}
      onPointerLeave={() => setEncima(false)}
      onFocus={() => setConFoco(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setConFoco(false);
      }}
      onKeyDown={alTeclear}
    >
      <div className="relative min-h-0 flex-1">
        {SLIDES.map((s, i) => {
          const activo = i === actual;
          return (
            <div
              key={s.titulo}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${SLIDES.length}`}
              aria-hidden={activo ? undefined : true}
              inert={!activo}
              className={`absolute inset-0 transition-opacity duration-[1600ms] ease-in-out ${
                activo ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {s.foto ? (
                <img
                  src={s.foto}
                  alt={s.alt}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  style={s.posicion ? { objectPosition: s.posicion } : undefined}
                  className={`size-full object-cover ${activo ? 'mesa-deriva' : ''}`}
                />
              ) : (
                <PlatoEnVivo />
              )}
            </div>
          );
        })}
      </div>
      <div className="min-h-[196px] bg-surface p-4 md:min-h-[204px] md:p-6">
        <div aria-live={pausado ? 'polite' : 'off'}>
          <div key={actual} className="mesa-entra">
            <h2 className="text-balance text-[22px] font-semibold leading-7 tracking-[-0.025em] text-ink md:text-[clamp(26px,2.2vw,32px)] md:leading-[1.15]">
              {slide.titulo}
            </h2>
            <p className="mt-2 max-w-[46ch] text-[17px] leading-[26px] text-text">{slide.texto}</p>
          </div>
        </div>
        <div data-controles className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPausado((p) => !p)}
            aria-label={pausado ? 'Reanudar el carrusel' : 'Pausar el carrusel'}
            className={claseControl}
          >
            {pausado ? (
              <Play aria-hidden className="size-5" />
            ) : (
              <Pause aria-hidden className="size-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => ir(-1)}
            aria-label="Plato anterior"
            className={claseControl}
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => ir(1)}
            aria-label="Plato siguiente"
            className={claseControl}
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
          <span aria-hidden className="text-[14px] leading-5 text-text">
            {actual + 1} de {SLIDES.length}
          </span>
        </div>
      </div>
    </section>
  );
}
