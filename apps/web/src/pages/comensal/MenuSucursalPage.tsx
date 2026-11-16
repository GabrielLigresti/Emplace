import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Clock, Search, ShoppingBasket, Utensils } from 'lucide-react';
import type { MenuSucursal } from '@pgim/shared';
import { LayoutComensal, claseAccionClasica } from '../../components/LayoutComensal';
import { useSesion } from '../../auth/SesionProvider';
import { EstadoCarga } from '../../components/ui';
import { useCarrito } from '../../lib/carrito';
import { formatoMinutos, formatoPrecioCarta } from '../../lib/formato';
import { useMiMesa } from '../../lib/miMesa';
import { useRecurso } from '../../lib/useRecurso';

// Destino del QR de la sucursal: el menú activo. La carta sigue el diseño de
// Claude Design al pie de la letra (registro Clásico); el tab bar no cambia.
export function MenuSucursalPage() {
  const { sucursalId } = useParams();
  const { datos, cargando, error } = useRecurso<MenuSucursal>(
    `/publico/sucursales/${sucursalId}/menu`,
  );
  // null = todas las categorías.
  const [categoria, setCategoria] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  // Con la mesa activa en esta sucursal, el comensal pide desde la ficha del plato.
  const { sesion } = useSesion();
  const mesa = useMiMesa(sucursalId ?? null, sesion?.usuario.tipo === 'COMENSAL').datos;
  const carrito = useCarrito(mesa?.cuentaMesaId ?? null);

  // Sin mesa, la acción es reservar; con mesa, el pedido está en el botón de la cabecera.
  const accion =
    datos && !mesa ? (
      <Link to={`/s/${datos.sucursal.id}/reservar`} className={claseAccionClasica}>
        Reservar mesa
      </Link>
    ) : null;

  const categorias = datos?.menu?.categorias ?? [];
  const termino = busqueda.trim().toLowerCase();
  const platos = categorias
    .filter((c) => categoria === null || c.id === categoria)
    .flatMap((c) => c.platos)
    .filter((p) => !termino || p.nombre.toLowerCase().includes(termino));

  return (
    <LayoutComensal
      clasico
      volver={{
        a: sesion?.usuario.tipo === 'COMENSAL' ? '/inicio' : '/',
        texto: sesion?.usuario.tipo === 'COMENSAL' ? 'Sucursales' : 'Buscar',
      }}
      accionFija={accion || undefined}
    >
      <div className="px-5 empty:hidden [&:not(:empty)]:pt-5">
        <EstadoCarga cargando={cargando && !datos} error={error} />
      </div>
      {datos && (
        <div className="text-tinta-clasica">
          <div className="flex flex-col gap-3.5 px-5 pt-[22px] pb-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-titulo text-[34px] leading-none font-semibold tracking-[-0.01em]">
                  Carta
                </h1>
                <p className="mt-1 text-[13px] leading-[18px] text-tinta-clasica/70">
                  {datos.sucursal.restaurante.nombre} · {datos.sucursal.nombre}
                </p>
              </div>
              {mesa && (
                <Link
                  to={`/s/${datos.sucursal.id}/pedido`}
                  aria-label={
                    carrito.unidades > 0
                      ? `Ver pedido, ${carrito.unidades} ${carrito.unidades === 1 ? 'plato' : 'platos'}`
                      : 'Ver pedido'
                  }
                  className="relative flex size-11 items-center justify-center rounded-[12px] border border-dorado text-dorado-700 hover:bg-dorado/12"
                >
                  <ShoppingBasket aria-hidden className="size-5" strokeWidth={1.5} />
                  {carrito.unidades > 0 && (
                    <span className="absolute -top-[7px] -right-[7px] box-border h-5 min-w-5 rounded-[10px] bg-dorado-700 px-[5px] text-center text-xs leading-5 font-semibold text-white">
                      {carrito.unidades}
                    </span>
                  )}
                </Link>
              )}
            </div>
            {datos.menu && (
              <label className="flex items-center gap-2.5 border-b border-linea-clasica focus-within:border-dorado-700 pt-1.5 pb-2.5 text-tinta-clasica/60">
                <Search aria-hidden className="size-[18px]" strokeWidth={1.5} />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setCategoria(null);
                  }}
                  placeholder="Buscar en la carta"
                  aria-label="Buscar en la carta"
                  className="min-w-0 flex-1 border-0 bg-transparent font-lora text-[16px] leading-6 text-tinta-clasica outline-none placeholder:text-tinta-clasica/65 [&::-webkit-search-cancel-button]:appearance-none"
                />
              </label>
            )}
          </div>

          {!datos.menu ? (
            <p className="px-5 py-6 text-base leading-[26px]">
              Esta sucursal no tiene un menú disponible en este momento.
            </p>
          ) : (
            <div className="min-h-[60vh] rounded-t-[36px] border-t border-linea-clasica bg-dorado-100 pb-40">
              {categorias.length > 1 && (
                <div
                  role="group"
                  aria-label="Categorías"
                  className="flex items-baseline gap-[22px] overflow-x-auto px-5 pt-[22px] pb-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {[{ id: null, nombre: 'Todo' }, ...categorias].map((c) => {
                    const activa = categoria === c.id;
                    return (
                      <button
                        key={c.id ?? 'todo'}
                        type="button"
                        aria-pressed={activa}
                        onClick={(e) => {
                          setCategoria(c.id);
                          setBusqueda('');
                          e.currentTarget.scrollIntoView({
                            inline: 'center',
                            block: 'nearest',
                            behavior: 'smooth',
                          });
                        }}
                        className={`-mt-[18px] shrink-0 border-b-2 bg-transparent pt-[18px] pb-1 ${
                          activa
                            ? 'border-dorado font-titulo text-[28px] leading-none font-semibold text-tinta-clasica'
                            : 'border-transparent font-lora text-[16px] leading-[1.2] text-tinta-clasica/75'
                        }`}
                      >
                        {c.nombre}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="px-5 pt-1 pb-5">
                <ul className="grid grid-cols-2 gap-3.5">
                  {platos.map((p) => (
                    <li key={p.id} className="flex">
                      <Link
                        to={`/s/${sucursalId}/platos/${p.id}`}
                        className="flex w-full flex-col overflow-hidden rounded-[18px] border border-linea-clasica bg-white text-left text-tinta-clasica hover:shadow-[0_3px_10px_color-mix(in_srgb,#2d2b2b_16%,transparent)]"
                      >
                        {p.fotoUrl ? (
                          <img
                            src={p.fotoUrl}
                            alt=""
                            className={`block h-[104px] w-full object-cover ${p.hayStock ? '' : 'opacity-50'}`}
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="grid h-[104px] w-full place-items-center bg-papel-hondo text-tinta-clasica/55"
                          >
                            <Utensils className="size-7" strokeWidth={1.5} />
                          </span>
                        )}
                        <span className="flex flex-1 flex-col gap-1.5 px-3 pt-2.5 pb-3">
                          <span className="font-titulo text-[17px] leading-[1.15] font-semibold">
                            {p.nombre}
                          </span>
                          {(!p.hayStock || p.tiempoPromedioMin !== null) && (
                            <span className="flex gap-2.5 text-xs leading-4 text-tinta-clasica/75">
                              {p.hayStock && p.tiempoPromedioMin !== null ? (
                                <span className="inline-flex items-center gap-[3px]">
                                  <Clock
                                    aria-hidden
                                    className="size-3 text-dorado-700"
                                    strokeWidth={1.75}
                                  />
                                  <span className="sr-only">Espera promedio: </span>
                                  {formatoMinutos(p.tiempoPromedioMin)}
                                </span>
                              ) : (
                                !p.hayStock && <span>Sin stock</span>
                              )}
                            </span>
                          )}
                          <span className="text-[18px] leading-none font-semibold [font-feature-settings:'tnum']">
                            {formatoPrecioCarta(p.precio)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {platos.length === 0 && (
                  <div className="px-1 py-6 text-base leading-[26px]">
                    {categorias.length === 0
                      ? 'El menú no tiene platos disponibles.'
                      : 'No hay platos para esa búsqueda.'}
                    {termino && (
                      <button
                        type="button"
                        onClick={() => setBusqueda('')}
                        className="mt-1 block min-h-11 text-sm font-semibold text-dorado-700 hover:underline"
                      >
                        Borrar búsqueda
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </LayoutComensal>
  );
}
