import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import type { MiMesa } from '@pgim/shared';
import {
  CalendarDays,
  ChevronLeft,
  House,
  LogOut,
  Receipt,
  ShoppingBasket,
  Star,
  UserRound,
} from 'lucide-react';
import { rutaInicio, useSesion } from '../auth/SesionProvider';
import { useSalir } from '../auth/useSalir';
import { useCarrito } from '../lib/carrito';
import { useMiMesa } from '../lib/miMesa';
import { useTemaStaff } from '../lib/useTemaStaff';

const PESTANIAS = [
  { a: '/inicio', texto: 'Inicio', icono: House },
  { a: '/reservas', texto: 'Reservas', icono: CalendarDays },
  { a: '/puntos', texto: 'Mis puntos', icono: Star },
];

const CUENTA = { a: '/cuenta', texto: 'Mi cuenta', icono: UserRound };

// Acción principal fija de la carta y la ficha (botón de 56 px del diseño).
export const claseAccionClasica =
  'inline-flex min-h-14 flex-1 items-center justify-center rounded-[12px] bg-dorado-700 px-4 font-titulo text-[18px] leading-[1.2] font-normal text-white hover:bg-dorado-800';

// Título de las pantallas del comensal.
export function TituloComensal({ children }: { children: ReactNode }) {
  return (
    <h1 className="font-display text-2xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">
      {children}
    </h1>
  );
}

// Marco de las pantallas del comensal: pensado primero para el celular. La
// acción principal de la pantalla queda fija abajo, al alcance del pulgar.
export function LayoutComensal({
  volver,
  accionFija,
  mesaActiva,
  clasico = false,
  children,
}: {
  volver?: { a: string; texto: string };
  accionFija?: ReactNode;
  // La pantalla que ya consultó la mesa la pasa, para no pedirla dos veces.
  mesaActiva?: MiMesa | null;
  // Carta y ficha: registro Clásico a sangre, sin márgenes. El tab bar no cambia.
  clasico?: boolean;
  children: ReactNode;
}) {
  useTemaStaff();
  const { sesion } = useSesion();
  const salir = useSalir();
  const { pathname } = useLocation();
  // "Mi mesa" aparece solo mientras el comensal tiene una mesa activa.
  // Sin sesión de comensal no la consulta: sería un 401 (o 403) en la consola.
  const esComensal = sesion?.usuario.tipo === 'COMENSAL';
  const consultada = useMiMesa(null, mesaActiva === undefined && esComensal).datos;
  const mesa = mesaActiva === undefined ? consultada : mesaActiva;
  // "Mi cuenta" va siempre última, a la derecha de la barra.
  const pestanias = [
    ...PESTANIAS,
    ...(mesa ? [{ a: '/mesa', texto: 'Mi mesa', icono: Receipt }] : []),
    CUENTA,
  ];
  // Con platos en el carrito, el acceso al pedido flota en todas las pantallas
  // del comensal, salvo en la del pedido.
  const carrito = useCarrito(mesa?.cuentaMesaId ?? null);
  const rutaPedido = mesa ? `/s/${mesa.sucursal.id}/pedido` : null;
  const conCarrito = Boolean(
    esComensal && rutaPedido && carrito.unidades > 0 && pathname !== rutaPedido,
  );

  return (
    <div className={`min-h-screen ${clasico ? 'bg-papel' : 'bg-bg'}`}>
      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[480px] items-center justify-between gap-2 px-4 py-1">
          {volver ? (
            <Link
              to={volver.a}
              className="-ml-2 inline-flex min-h-11 min-w-0 items-center gap-1 rounded-control px-2 text-sm font-medium text-text hover:bg-panel"
            >
              <ChevronLeft aria-hidden className="size-5 shrink-0" />
              <span className="truncate">{volver.texto}</span>
            </Link>
          ) : sesion ? (
            <span className="truncate text-sm font-medium text-text">
              Hola, {sesion.usuario.nombre}
            </span>
          ) : (
            <img
              src="/marca/emplace-logo.png"
              alt="Emplace"
              width={320}
              height={256}
              className="h-11 w-auto"
            />
          )}
          {!sesion ? (
            <Link
              to="/login"
              state={{ desde: pathname, tipo: 'COMENSAL' }}
              className="inline-flex min-h-11 shrink-0 items-center rounded-control px-3 text-sm font-semibold text-meta hover:bg-panel hover:text-text"
            >
              Ingresar
            </Link>
          ) : esComensal ? (
            <button
              type="button"
              onClick={salir}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-2 text-sm text-meta hover:bg-panel hover:text-text"
            >
              <LogOut aria-hidden className="size-4" />
              Salir
            </button>
          ) : (
            <Link
              to={rutaInicio(sesion)}
              className="inline-flex min-h-11 shrink-0 items-center rounded-control border border-accent/20 bg-accent-soft px-3 text-sm font-semibold text-accent-ink hover:bg-accent/15"
            >
              Ir al panel
            </Link>
          )}
        </div>
      </header>

      <main
        className={
          clasico
            ? 'mx-auto max-w-[480px] bg-bg font-sans'
            : `mx-auto max-w-[480px] px-4 pt-5 ${esComensal ? (accionFija ? 'pb-40' : 'pb-24') : accionFija ? 'pb-24' : 'pb-8'}`
        }
      >
        {children}
        {/* Espacio para que el carrito flotante no tape el final de la pantalla. */}
        {conCarrito && <div aria-hidden className="h-[68px]" />}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10">
        {conCarrito && rutaPedido && (
          <div className="pointer-events-none mx-auto flex max-w-[480px] justify-end px-4 pb-3">
            <Link
              to={rutaPedido}
              aria-label={`Ver pedido, ${carrito.unidades} ${carrito.unidades === 1 ? 'plato' : 'platos'}`}
              className="pointer-events-auto relative flex size-14 items-center justify-center rounded-[12px] border border-dorado bg-bg text-dorado-700 shadow-flotante hover:bg-papel-hondo"
            >
              <ShoppingBasket aria-hidden className="size-6" strokeWidth={1.5} />
              <span className="absolute -top-[7px] -right-[7px] box-border h-5 min-w-5 rounded-[10px] bg-dorado-700 px-[5px] text-center text-xs leading-5 font-semibold text-white">
                {carrito.unidades}
              </span>
            </Link>
          </div>
        )}
        {accionFija && (
          <div className="border-t border-line bg-bg">
            <div
              className={`mx-auto flex max-w-[480px] flex-wrap gap-2 ${clasico ? 'px-5 py-3' : 'px-4 py-2'}`}
            >
              {accionFija}
            </div>
          </div>
        )}
        {esComensal && (
          <nav
            aria-label="Secciones"
            className="border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
          >
            <div
              className={`mx-auto grid h-14 max-w-[480px] ${mesa ? 'grid-cols-5' : 'grid-cols-4'}`}
            >
              {pestanias.map(({ a, texto, icono: Icono }) => (
                <NavLink
                  key={a}
                  to={a}
                  end
                  className={({ isActive }) =>
                    `grid min-w-0 content-center justify-items-center gap-0.5 px-0.5 text-xs ${
                      isActive ? 'font-semibold text-accent-ink' : 'text-meta'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex h-7 w-12 items-center justify-center rounded-full ${
                          isActive ? 'bg-accent/20' : ''
                        }`}
                      >
                        <Icono aria-hidden className="size-5" />
                      </span>
                      <span className="whitespace-nowrap">{texto}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
