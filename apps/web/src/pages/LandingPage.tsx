import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { CalendarDays, LogOut, Receipt, Star, UserRound } from 'lucide-react';
import { rutaInicio, useSesion } from '../auth/SesionProvider';
import { BuscadorSucursales } from '../components/BuscadorSucursales';
import { Comanda } from '../components/landing/Comanda';
import { Evidencia } from '../components/landing/Evidencia';
import { CarruselMesa } from '../components/landing/CarruselMesa';
import { useMiMesa } from '../lib/miMesa';
import { useRevelar } from '../lib/useRevelar';

// En el celular, ícono con el texto chico debajo (como las pestañas); desde md, en fila.
const claseEnlace =
  'inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-control px-1.5 text-text transition hover:bg-surface active:scale-[0.98] md:flex-row md:gap-1.5 md:px-2 md:text-[14px] md:leading-5 md:font-medium';

function Texto({ corto, largo }: { corto: string; largo?: ReactNode }) {
  return (
    <>
      <span className="text-[11px] leading-none md:hidden">{corto}</span>
      <span className="hidden md:inline">{largo ?? corto}</span>
    </>
  );
}

// Lleva el foco al campo de búsqueda, dejándolo a la vista.
function irAlBuscador() {
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const campo = document.getElementById('buscar');
  campo?.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'center' });
  campo?.focus({ preventScroll: true });
}

// Slide que pide la sección que está a la vista; solo desde lg, donde el escenario es fijo.
const SECCIONES: Record<string, number> = { inicio: 0, restaurantes: 3, recorrido: 4 };

function useSeccionALaVista(): number | undefined {
  const [slide, setSlide] = useState<number>();
  useEffect(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) setSlide(SECCIONES[e.target.id]);
        }
      },
      { rootMargin: '-40% 0px -50% 0px' },
    );
    for (const id of Object.keys(SECCIONES)) {
      const el = document.getElementById(id);
      if (el) observador.observe(el);
    }
    return () => observador.disconnect();
  }, []);
  return slide;
}

// Entrada pública: cualquiera busca una sucursal y mira su carta sin sesión.
export function LandingPage() {
  const { sesion, cargando, logout } = useSesion();
  const tipo = sesion?.usuario.tipo;
  const { pathname } = useLocation();
  // Para que el login vuelva a esta pantalla.
  const alLogin = { desde: pathname, tipo: 'COMENSAL' };
  // "Mi mesa" aparece solo con una mesa activa; sin sesión de comensal no se consulta.
  const mesa = useMiMesa(null, tipo === 'COMENSAL').datos;

  const pedido = useSeccionALaVista();
  const refCierre = useRevelar<HTMLElement>();
  const refPie = useRevelar<HTMLElement>();

  return (
    <div className="relative min-h-screen bg-bg">
      <a
        href="#buscar"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-20 focus:rounded-control focus:bg-accent focus:px-4 focus:py-3 focus:text-[14px] focus:leading-5 focus:font-semibold focus:text-white"
      >
        Ir al buscador
      </a>
      <div className="mx-auto grid max-w-[1600px] gap-3 p-3 lg:grid-cols-2">
        <div
          aria-hidden
          className="hidden rounded-panel bg-hoja lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:block"
        />
        <header className="relative lg:col-start-1 lg:row-start-1">
          <div className="flex h-14 items-center justify-between gap-2 px-4 md:px-8 lg:h-16 lg:px-14">
            <span className="text-[22px] leading-7 font-semibold tracking-tight text-ink">
              PGIM
            </span>
            <nav aria-label="Cuenta" className="flex items-center gap-1">
              {!cargando && !sesion && (
                <>
                  <Link
                    to="/login"
                    state={alLogin}
                    className="inline-flex min-h-11 items-center rounded-control px-4 text-[14px] leading-5 font-semibold text-text transition hover:bg-surface active:scale-[0.98]"
                  >
                    Ingresar
                  </Link>
                  <Link
                    to="/registro"
                    state={alLogin}
                    className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 text-[14px] leading-5 font-semibold text-text transition hover:bg-panel active:scale-[0.98]"
                  >
                    Crear cuenta
                  </Link>
                </>
              )}
              {tipo === 'COMENSAL' && (
                <>
                  {mesa && (
                    <Link to="/mesa" aria-label="Mi mesa" className={claseEnlace}>
                      <Receipt aria-hidden className="size-5" />
                      <Texto corto="Mi mesa" />
                    </Link>
                  )}
                  <Link to="/reservas" aria-label="Mis reservas" className={claseEnlace}>
                    <CalendarDays aria-hidden className="size-5" />
                    <Texto corto="Reservas" largo="Mis reservas" />
                  </Link>
                  <Link to="/puntos" aria-label="Mis puntos" className={claseEnlace}>
                    <Star aria-hidden className="size-5" />
                    <Texto corto="Puntos" largo="Mis puntos" />
                  </Link>
                  <Link to="/cuenta" aria-label="Mi cuenta" className={claseEnlace}>
                    <UserRound aria-hidden className="size-5" />
                    <Texto corto="Cuenta" largo="Mi cuenta" />
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    aria-label="Salir"
                    className={`${claseEnlace} text-meta`}
                  >
                    <LogOut aria-hidden className="size-5 md:size-4" />
                    <Texto corto="Salir" />
                  </button>
                </>
              )}
              {sesion && tipo === 'EMPLEADO' && (
                <Link
                  to={rutaInicio(sesion)}
                  className="inline-flex min-h-11 items-center rounded-control bg-accent-soft px-4 text-[14px] leading-5 font-semibold text-accent-ink transition hover:bg-accent/15 active:scale-[0.98]"
                >
                  Ir al panel
                </Link>
              )}
            </nav>
          </div>
        </header>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="h-[40svh] min-h-[340px] lg:sticky lg:top-3 lg:h-[calc(100svh-24px)] lg:min-h-[400px]">
            <CarruselMesa pedido={pedido} />
          </div>
        </div>

        <main
          id="contenido"
          className="relative rounded-panel bg-hoja px-4 pb-16 md:px-8 lg:col-start-1 lg:row-start-2 lg:rounded-none lg:bg-transparent lg:px-14 lg:pb-24"
        >
          <BuscadorSucursales />
          <Comanda />
        </main>
      </div>

      <div className="mx-auto max-w-[1600px] px-3">
        <Evidencia />

        <section
          ref={refCierre}
          aria-label="Empezar"
          className="revelar grid gap-12 px-4 py-28 md:grid-cols-2 md:items-start md:gap-12 md:px-8 lg:px-14 lg:py-40"
        >
          <div>
            <p className="max-w-[26ch] text-[clamp(26px,2.2vw,32px)] leading-[1.15] font-medium tracking-[-0.02em] text-ink">
              ¿Ya sabés qué querés comer? Buscá el plato y miralo sobre tu mesa antes de pedirlo.
            </p>
            <button
              type="button"
              onClick={irAlBuscador}
              className="mt-6 min-h-12 rounded-control bg-accent px-6 text-[14px] leading-5 font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98]"
            >
              Buscar restaurantes
            </button>
          </div>
          <div>
            <h2 className="text-[clamp(26px,2.2vw,32px)] leading-[1.15] font-semibold tracking-[-0.025em] text-ink">
              ¿Tenés un restaurante?
            </h2>
            <p className="mt-3 max-w-[40ch] text-[17px] leading-[26px] text-text">
              Cargá tu carta y recibí reservas y pedidos en la mesa.
            </p>
            <Link
              to="/registrar-restaurante"
              className="mt-6 inline-flex min-h-12 items-center rounded-control bg-accent-soft px-6 text-[14px] leading-5 font-semibold text-accent-ink transition hover:bg-accent/15 active:scale-[0.98]"
            >
              Registralo en PGIM
            </Link>
          </div>
        </section>

        <footer
          ref={refPie}
          className="revelar grid gap-2 px-4 pb-8 text-[14px] leading-5 text-text md:px-8 lg:grid-cols-[1fr_auto_1fr] lg:items-baseline lg:gap-6 lg:px-14"
        >
          <p>
            PGIM, restaurantes de Buenos Aires. Sitio de demostración: La Parrilla Demo es un
            restaurante ficticio.
          </p>
          <p className="flex justify-start lg:justify-center">
            <a
              href="/fotos-portada/LICENCIA.md"
              className="inline-flex min-h-11 items-center font-medium text-accent-ink underline"
            >
              Créditos de fotos y modelos
            </a>
          </p>
          <p className="lg:text-right">
            Fotos de Snapwire, Leeroy, Matt Bango, Jakub Kapusnak y rawpixel, en dominio público
            (CC0). Modelo 3D de Kuutti Siitonen, en Poly Haven (CC0). 2026.
          </p>
        </footer>
      </div>
    </div>
  );
}
