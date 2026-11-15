import { useRef, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { rutaInicio, useSesion } from '../auth/SesionProvider';
import { BuscadorSucursales } from '../components/BuscadorSucursales';
import { Cargando } from '../components/Cargando';
import { VisorModeloLanding } from '../components/VisorModeloLanding';

const claseBotonPrincipal =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-cuadrado bg-dorado-700 px-6 font-titulo text-base font-semibold text-white hover:bg-dorado-800';
const claseBotonSecundario =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-cuadrado bg-papel-hondo px-5 font-titulo text-base font-semibold text-dorado-700 hover:bg-tinta-clasica/10';

// Los modelos 3D de la demo se cargan después: sin `src`, la ficha queda vacía y
// sin botón. Para sumar uno, completar `nombre` y `src` (un .glb libre).
const MODELOS: { nombre: string; src: string }[] = [
  { nombre: '', src: '' },
  { nombre: '', src: '' },
  { nombre: '', src: '' },
];

const hayModelos = MODELOS.some((m) => m.src);

function Etiqueta({ children }: { children: ReactNode }) {
  return (
    <span className="font-lora text-[13px] leading-none tracking-[0.08em] text-dorado-700 uppercase">
      {children}
    </span>
  );
}

// Entrada pública: cualquiera busca una sucursal y mira su carta sin sesión.
export function LandingPage() {
  const { sesion, cargando } = useSesion();
  const tipo = sesion?.usuario.tipo;
  const { pathname } = useLocation();
  // Para que el login vuelva a esta pantalla.
  const alLogin = { desde: pathname, tipo: 'COMENSAL' };
  const slider = useRef<HTMLDivElement>(null);
  const mover = (dx: number) => slider.current?.scrollBy({ left: dx });

  // La landing es para quien no tiene sesión o acaba de cerrarla.
  if (cargando) return <Cargando />;
  if (tipo === 'COMENSAL') return <Navigate to={rutaInicio(sesion!)} replace />;

  return (
    <div className="landing-clasica min-h-screen bg-papel font-lora text-tinta-clasica">
      <div className="mx-auto max-w-[1240px] border-linea-clasica bg-papel min-[1241px]:border-x">
        <header className="flex items-center justify-between gap-4 border-b border-linea-clasica px-5 py-4 md:px-14 md:py-[18px]">
          <span className="font-titulo text-[28px] leading-none font-semibold tracking-tight">
            PGIM
          </span>
          <nav aria-label="Secciones" className="hidden items-center gap-8 text-sm md:flex">
            <a href="#restaurantes" className="py-3 text-dorado-700 hover:text-dorado-800">
              Restaurantes
            </a>
            <a href="#ver-en-mi-mesa" className="py-3 hover:text-dorado-700">
              Ver en mi mesa
            </a>
          </nav>
          <nav aria-label="Cuenta" className="flex items-center gap-1 md:gap-3">
            {!cargando && !sesion && (
              <>
                <Link
                  to="/login"
                  state={alLogin}
                  className="inline-flex min-h-11 items-center rounded-control px-4 text-sm font-semibold hover:bg-papel-hondo"
                >
                  Ingresar
                </Link>
                {/* En el celular el héroe ya tiene el botón: acá sobra. */}
                <a
                  href="#restaurantes"
                  className={`${claseBotonPrincipal} hidden !px-[22px] md:inline-flex`}
                >
                  Reservar mesa
                </a>
              </>
            )}
            {sesion && tipo === 'EMPLEADO' && (
              <Link to={rutaInicio(sesion)} className={claseBotonPrincipal}>
                Ir al panel
              </Link>
            )}
          </nav>
        </header>

        <main>
          {/* Héroe: en el celular la foto va de fondo con texto blanco; en escritorio, a la derecha. */}
          <section className="relative grid min-h-[560px] content-end items-center gap-6 px-5 py-10 md:min-h-0 md:grid-cols-2 md:content-center md:gap-14 md:py-14 md:pr-0 md:pl-14">
            <div className="relative z-[1] flex flex-col gap-6 text-white md:text-tinta-clasica">
              <h1 className="m-0 font-titulo text-[52px] leading-[1.06] font-normal tracking-[-0.01em] md:text-[84px]">
                <span className="block">Una mesa</span>
                <span className="block">te espera</span>
              </h1>
              <p className="m-0 max-w-[46ch] text-[17px] leading-7 text-white md:text-tinta-clasica/80">
                Encontrá tu restaurante, mirá cómo son los platos desde tu celular y reservá en un
                minuto. Pedí desde tu mesa, sin esperar al mozo.
              </p>
              <div className="flex flex-wrap items-center gap-3.5">
                <a href="#restaurantes" className={`${claseBotonPrincipal} !py-3 !px-[26px]`}>
                  Explorar restaurantes
                </a>
                <a href="#ver-en-mi-mesa" className={claseBotonSecundario}>
                  Ver en mi mesa →
                </a>
              </div>
            </div>
            {/* El fondo oscuro asegura el contraste del texto blanco si la foto no carga. */}
            <figure className="absolute inset-0 m-0 overflow-hidden bg-tinta-clasica md:relative md:min-h-[500px] md:rounded-l-hero md:bg-papel-hondo">
              <img
                src="/fotos-portada/mesa-puesta.jpg"
                alt="Mesa puesta en una terraza"
                className="absolute inset-0 size-full object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-[rgb(20_16_10/0.55)] md:bg-transparent"
              />
            </figure>
          </section>

          {/* Ver en mi mesa */}
          <section id="ver-en-mi-mesa" className="scroll-mt-4 bg-white pt-7 pb-5 md:pt-9 md:pb-14">
            <div className="mx-5 flex flex-wrap items-center justify-between gap-5 border-y border-linea-clasica py-7 md:mx-14 md:py-9">
              <div className="flex flex-1 basis-[280px] flex-col gap-2">
                <Etiqueta>Ver en mi mesa</Etiqueta>
                <h2 className="m-0 font-titulo text-[30px] leading-[1.1] font-normal tracking-[-0.01em] md:text-[38px]">
                  Mirá el plato en tu mesa antes de pedirlo
                </h2>
                <p className="m-0 text-[15.5px] leading-7 text-tinta-clasica/80">
                  A tamaño real, desde el navegador. Sin instalar nada.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 px-5 pt-5 md:px-14 md:pt-14">
              {hayModelos && (
                <div className="flex items-end justify-between gap-3">
                  <p className="m-0 max-w-[52ch] text-[15.5px] leading-7 text-tinta-clasica/80">
                    Tocá <strong className="font-semibold">Ver en mi mesa</strong> desde tu celular
                    para verlos sobre tu mesa. Arrastrá para girarlos.
                  </p>
                  {/* Las flechas solo en escritorio: en el celular el carrusel se desliza con el dedo. */}
                  <div className="hidden gap-2 md:flex">
                    <button
                      type="button"
                      aria-label="Plato anterior"
                      onClick={() => mover(-360)}
                      className="inline-flex size-11 items-center justify-center rounded-cuadrado bg-papel-hondo hover:bg-tinta-clasica/10"
                    >
                      <ChevronLeft aria-hidden className="size-[18px]" strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      aria-label="Plato siguiente"
                      onClick={() => mover(360)}
                      className="inline-flex size-11 items-center justify-center rounded-cuadrado bg-papel-hondo hover:bg-tinta-clasica/10"
                    >
                      <ChevronRight aria-hidden className="size-[18px]" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              )}
              <div
                ref={slider}
                role="group"
                aria-label="Platos en 3D"
                tabIndex={0}
                className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {MODELOS.map((m, i) => (
                  <div
                    key={i}
                    className="flex w-[82%] flex-none snap-start flex-col gap-2.5 md:w-[340px]"
                  >
                    <div className="h-[300px] overflow-hidden rounded-clasico border border-linea-clasica bg-papel-hondo">
                      {m.src && <VisorModeloLanding src={m.src} nombre={m.nombre} />}
                    </div>
                    {m.nombre && (
                      <p className="m-0 font-titulo text-2xl leading-[1.1] font-semibold">
                        {m.nombre}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="restaurantes" className="scroll-mt-4 px-5 pt-5 pb-5 md:px-14 md:pt-14">
            <BuscadorSucursales />
          </section>
        </main>

        <footer className="mx-5 flex flex-wrap justify-between gap-3 border-t border-linea-clasica pt-5 pb-7 text-[13px] leading-5 text-tinta-clasica/70 md:mx-14">
          <span>PGIM · Gestión de restaurantes</span>
          <span>
            ¿Tenés un restaurante?{' '}
            <Link
              to="/registrar-restaurante"
              className="inline-flex min-h-11 items-center text-dorado-700 underline underline-offset-[3px] hover:text-dorado-800"
            >
              Registralo en PGIM
            </Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
