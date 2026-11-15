import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Box, Clock, Plus, Search, Utensils } from 'lucide-react';
import type { MenuSucursal, PlatoMenu } from '@pgim/shared';
import { LayoutComensal, TituloComensal } from '../../components/LayoutComensal';
import { useSesion } from '../../auth/SesionProvider';
import { EstadoCarga, Etiqueta } from '../../components/ui';
import { useCarrito } from '../../lib/carrito';
import { formatoMinutos, formatoPesos } from '../../lib/formato';
import { useMiMesa } from '../../lib/miMesa';
import { useRecurso } from '../../lib/useRecurso';

// Destino del QR de la sucursal: el menú activo, por categoría.
export function MenuSucursalPage() {
  const { sucursalId } = useParams();
  const { datos, cargando, error } = useRecurso<MenuSucursal>(
    `/publico/sucursales/${sucursalId}/menu`,
  );
  // null = todas las categorías.
  const [categoria, setCategoria] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  // Con la mesa activa en esta sucursal, el comensal pide desde el menú.
  const { sesion } = useSesion();
  const mesa = useMiMesa(sucursalId ?? null, sesion?.usuario.tipo === 'COMENSAL').datos;
  const carrito = useCarrito(mesa?.cuentaMesaId ?? null);

  const claseAccion =
    'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover';
  const accion = !datos ? null : mesa ? (
    carrito.unidades > 0 && (
      <Link to={`/s/${datos.sucursal.id}/pedido`} className={claseAccion}>
        Ver pedido · {carrito.unidades} · {formatoPesos(carrito.total)}
      </Link>
    )
  ) : (
    <Link to={`/s/${datos.sucursal.id}/reservar`} className={claseAccion}>
      Reservar mesa
    </Link>
  );

  function agregar(p: PlatoMenu) {
    carrito.agregar(
      { id: p.id, nombre: p.nombre, precio: p.precio, admiteObservaciones: p.admiteObservaciones },
      1,
    );
  }

  const categorias = datos?.menu?.categorias ?? [];
  const termino = busqueda.trim().toLowerCase();
  const platos = categorias
    .filter((c) => categoria === null || c.id === categoria)
    .flatMap((c) => c.platos)
    .filter((p) => !termino || p.nombre.toLowerCase().includes(termino));

  return (
    <LayoutComensal
      volver={{
        a: sesion?.usuario.tipo === 'COMENSAL' ? '/inicio' : '/',
        texto: sesion?.usuario.tipo === 'COMENSAL' ? 'Sucursales' : 'Buscar',
      }}
      accionFija={accion || undefined}
    >
      <EstadoCarga cargando={cargando && !datos} error={error} />
      {datos && (
        <>
          <p className="text-sm text-meta">{datos.sucursal.restaurante.nombre}</p>
          <TituloComensal>{datos.sucursal.nombre}</TituloComensal>
          <p className="mb-5 text-sm text-meta">{datos.sucursal.direccion}</p>

          {!datos.menu ? (
            <p className="rounded-panel border border-line bg-surface p-4 text-sm text-meta">
              Esta sucursal no tiene un menú disponible en este momento.
            </p>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-ink">{datos.menu.nombre}</h2>
              {datos.menu.descripcion && (
                <p className="text-sm text-meta">{datos.menu.descripcion}</p>
              )}
              <label className="mt-3 flex min-h-11 items-center gap-2.5 border-b border-line-strong text-meta focus-within:border-accent">
                <Search aria-hidden className="size-[18px] shrink-0" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar en la carta"
                  aria-label="Buscar en la carta"
                  className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-meta"
                />
              </label>

              {/* Hoja tintada a sangre: las pestañas de categoría y la grilla de tarjetas. */}
              <div className="-mx-4 mt-4 rounded-t-[32px] bg-hoja px-4 pt-5 pb-6">
                {categorias.length > 1 && (
                  <div
                    role="group"
                    aria-label="Categorías"
                    className="-mx-4 flex items-baseline gap-5 overflow-x-auto px-4 pb-3"
                  >
                    {[{ id: null, nombre: 'Todo' }, ...categorias].map((c) => (
                      <button
                        key={c.id ?? 'todo'}
                        type="button"
                        aria-pressed={categoria === c.id}
                        onClick={() => setCategoria(c.id)}
                        className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 px-0.5 ${
                          categoria === c.id
                            ? 'border-accent font-display text-xl font-semibold text-ink'
                            : 'border-transparent text-base text-meta hover:text-ink'
                        }`}
                      >
                        {c.nombre}
                      </button>
                    ))}
                  </div>
                )}
                <ul className="grid grid-cols-2 gap-3">
                  {platos.map((p) => (
                    <li key={p.id} className="relative">
                      <Link
                        to={`/s/${sucursalId}/platos/${p.id}`}
                        className={`flex h-full flex-col overflow-hidden rounded-panel border border-line bg-surface hover:border-accent ${
                          p.hayStock ? '' : 'opacity-60'
                        }`}
                      >
                        {p.fotoUrl ? (
                          <img src={p.fotoUrl} alt="" className="h-28 w-full object-cover" />
                        ) : (
                          <span
                            aria-hidden
                            className="grid h-28 w-full place-items-center bg-panel text-meta"
                          >
                            <Utensils className="size-7" strokeWidth={1.6} />
                          </span>
                        )}
                        <span className="flex flex-1 flex-col gap-1.5 p-3">
                          <span className="font-display text-lg leading-tight font-semibold text-ink">
                            {p.nombre}
                          </span>
                          {p.tiempoPromedioMin !== null && (
                            <span className="flex items-center gap-1 text-xs text-meta">
                              <Clock aria-hidden className="size-3 text-accent-ink" />
                              <span className="sr-only">Espera promedio: </span>
                              {formatoMinutos(p.tiempoPromedioMin)}
                            </span>
                          )}
                          <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="text-lg leading-none font-semibold text-ink">
                              {formatoPesos(p.precio)}
                            </span>
                            {!p.hayStock && <Etiqueta>Sin stock</Etiqueta>}
                            {p.modeloRa && (
                              <Etiqueta tono="acento">
                                <Box aria-hidden className="size-3.5" />
                                RA
                              </Etiqueta>
                            )}
                          </span>
                        </span>
                      </Link>
                      {mesa && p.hayStock && (
                        <BotonAgregar
                          nombre={p.nombre}
                          cantidad={carrito.cantidadDe(p.id)}
                          onClick={() => agregar(p)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
                {platos.length === 0 && (
                  <p className="py-6 text-base text-ink">
                    {termino
                      ? 'No hay platos para esa búsqueda.'
                      : 'El menú no tiene platos disponibles.'}
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </LayoutComensal>
  );
}

// Sobre la foto: agrega una unidad y, si ya hay, muestra cuántas van en el pedido.
function BotonAgregar({
  nombre,
  cantidad,
  onClick,
}: {
  nombre: string;
  cantidad: number;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        cantidad > 0 ? `${nombre}: ${cantidad} en el pedido. Agregar otro` : `Agregar ${nombre}`
      }
      className={`absolute right-2 bottom-2 grid size-11 place-items-center rounded-full font-semibold tabular-nums ${
        cantidad > 0
          ? 'bg-accent text-white hover:bg-accent-hover'
          : 'border border-line-strong bg-surface text-accent-ink hover:bg-panel'
      }`}
    >
      {cantidad > 0 ? cantidad : <Plus aria-hidden className="size-5" />}
    </button>
  );
}
