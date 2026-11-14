import { useEffect, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { PlatoEnVivo } from './PlatoEnVivo';

type Slide = { titulo: string; texto: string; foto?: string; alt?: string; posicion?: string };

const SLIDES: Slide[] = [
  {
    titulo: 'Ver en mi mesa',
    texto: 'El plato aparece sobre tu mesa a tamaño real, antes de pedirlo.',
    foto: '/fotos-portada/bife-con-esparragos.jpg',
    alt: 'Bife con salsa, espárragos y tomate relleno en un plato blanco',
  },
  {
    titulo: 'Así se ve un plato en 3D',
    texto:
      'El restaurante carga el plato en 3D y vos lo ves con todo su detalle, desde cualquier lado. Esta torta es un ejemplo.',
  },
  {
    titulo: 'Sin instalar nada',
    texto: 'Se abre en el navegador de tu celular. Apuntás la cámara a la mesa y listo.',
    foto: '/fotos-portada/carne-a-la-plancha.jpg',
    alt: 'Carne a la plancha sobre una tabla, con papas fritas y salsa',
  },
  {
    titulo: 'La carta, sin crear cuenta',
    texto:
      'Buscás el restaurante y abrís la carta. Los platos que están en 3D traen el botón Ver en mi mesa.',
    foto: '/fotos-portada/mesa-compartida.jpg',
    alt: 'Mesa de azulejos vista desde arriba, con platos para compartir',
  },
  {
    titulo: 'Reservá por una hora',
    texto: 'Elegís el día y el horario, y la mesa te espera. Recién ahí te pedimos una cuenta.',
    foto: '/fotos-portada/mesa-puesta.jpg',
    alt: 'Mesa de restaurante lista, con copas y sillas',
  },
  {
    titulo: 'Pedí desde tu mesa',
    texto: 'Pedís desde el celular, pagás con Mercado Pago y sumás puntos en ese restaurante.',
    foto: '/fotos-portada/platos-al-pase.jpg',
    alt: 'Platos terminados saliendo de la cocina',
    posicion: '50% 70%',
  },
];

const claseControl =
  'inline-flex size-11 items-center justify-center rounded-control bg-accent-soft text-accent-ink transition hover:bg-accent/15 active:scale-[0.98]';

// Portada: la mesa del comensal, donde los platos se van sirviendo uno tras otro.
// `pedido` lleva el carrusel a un slide cuando la página muestra otra sección.
export function CarruselMesa({ pedido }: { pedido?: number }) {
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

  useEffect(() => {
    // No le cambia el slide a quien lo pausó o lo está usando con el teclado.
    if (pedido !== undefined && !pausado && !conFoco) setActual(pedido);
  }, [pedido]);

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
    if (!destino.closest('[data-controles]')) return;
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
      <div className="min-h-0 bg-surface p-4 md:min-h-[204px] md:p-6">
        <div aria-live={avanza ? 'off' : 'polite'}>
          <div key={actual} className="mesa-entra">
            <h2 className="text-balance text-[22px] font-semibold leading-7 tracking-[-0.025em] text-ink md:text-[clamp(26px,2.2vw,32px)] md:leading-[1.15]">
              {slide.titulo}
            </h2>
            <p className="mt-2 hidden max-w-[46ch] md:block text-[17px] leading-[26px] text-text">
              {slide.texto}
            </p>
          </div>
        </div>
        <div data-controles className="mt-3 flex items-center gap-2">
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
