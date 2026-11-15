import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Clock, Utensils } from 'lucide-react';
import type { DetallePlato, MenuSucursal } from '@pgim/shared';
import { useSesion } from '../../auth/SesionProvider';
import { useAvisos } from '../../components/AvisoEmergente';
import { LayoutComensal } from '../../components/LayoutComensal';
import { SelectorCantidad } from '../../components/SelectorCantidad';
import { VisorRA } from '../../components/VisorRA';
import { Aviso, Campo, EstadoCarga, claseInput } from '../../components/ui';
import { useCarrito } from '../../lib/carrito';
import { formatoCantidad, formatoMinutos, formatoPrecioCarta } from '../../lib/formato';
import { useMiMesa } from '../../lib/miMesa';
import { useRecurso } from '../../lib/useRecurso';
import { useVistosRecientemente } from '../../lib/vistosRecientemente';

// Detalle del plato (CU-10). "Ver en mi mesa" (RA) aparece solo si el plato tiene modelo (E1).
// Con la mesa activa, el plato se agrega al pedido desde acá o desde la RA (flujo A).
export function PlatoPage() {
  const { sucursalId, id } = useParams();
  const { datos, cargando, error } = useRecurso<DetallePlato>(
    `/publico/sucursales/${sucursalId}/platos/${id}`,
  );
  const plato = datos?.plato;
  // La carta da nombre y foto de los platos vistos antes.
  const menu = useRecurso<MenuSucursal>(`/publico/sucursales/${sucursalId}/menu`);
  const { ids, registrar: registrarVisto } = useVistosRecientemente(sucursalId);
  const vistos = { ids };
  const { sesion } = useSesion();
  const miMesa = useMiMesa(sucursalId ?? null, sesion?.usuario.tipo === 'COMENSAL');
  const mesa = miMesa.datos;
  const carrito = useCarrito(mesa?.cuentaMesaId ?? null);
  const { avisar } = useAvisos();
  const [cantidad, setCantidad] = useState(1);
  const [observaciones, setObservaciones] = useState('');

  const puedePedir = Boolean(mesa && plato?.hayStock);

  function agregar(unidades: number, nota: string) {
    if (!plato) return;
    carrito.agregar(
      {
        id: plato.id,
        nombre: plato.nombre,
        precio: plato.precio,
        admiteObservaciones: plato.admiteObservaciones,
      },
      unidades,
      plato.admiteObservaciones ? nota : '',
    );
  }

  function agregarDesdeFicha() {
    agregar(cantidad, observaciones);
    avisar(`${plato!.nombre}: ${cantidad} agregado al pedido`);
    setCantidad(1);
    setObservaciones('');
  }

  // Sin sesión de comensal no hay mesa: la acción es reservar, como en la carta.
  // Mientras se consulta la mesa no se ofrece nada, para que no parpadee.
  const claseAccion =
    'inline-flex min-h-14 flex-1 items-center justify-center rounded-[12px] bg-dorado-700 px-4 font-titulo text-[18px] leading-[1.2] font-semibold text-white hover:bg-dorado-800';
  const accion = !plato ? null : puedePedir ? (
    <button type="button" className={claseAccion} onClick={agregarDesdeFicha}>
      Agregar al pedido
    </button>
  ) : !mesa && !miMesa.cargando ? (
    <Link to={`/s/${sucursalId}/reservar`} className={claseAccion}>
      Reservar mesa
    </Link>
  ) : null;

  const platoId = plato?.id;
  useEffect(() => {
    if (platoId) registrarVisto(platoId);
    setCantidad(1);
    setObservaciones('');
  }, [platoId, registrarVisto]);

  const recientes = vistos.ids
    .filter((v) => v !== platoId)
    .flatMap((v) => {
      const p = menu.datos?.menu?.categorias.flatMap((c) => c.platos).find((x) => x.id === v);
      return p ? [p] : [];
    });

  return (
    <LayoutComensal
      clasico
      volver={{ a: `/s/${sucursalId}/menu`, texto: 'Menú' }}
      accionFija={accion ?? undefined}
    >
      <EstadoCarga cargando={cargando && !datos} error={error} />
      {plato && (
        <article className="text-tinta-clasica">
          <div className="relative h-[280px]">
            {plato.fotoUrl ? (
              <img
                src={plato.fotoUrl}
                alt={plato.nombre}
                className="block size-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="grid size-full place-items-center bg-papel-hondo text-tinta-clasica/55"
              >
                <Utensils className="size-12" strokeWidth={1.5} />
              </span>
            )}
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(32,31,29,.35),rgba(32,31,29,0)_40%)]" />
          </div>
          <div className="relative -mt-6 flex flex-col gap-4 rounded-t-3xl bg-bg px-5 pt-6 pb-40">
            <div className="flex flex-col gap-2">
              <span className="text-[11px] leading-none tracking-widest text-dorado-700 uppercase">
                {plato.categoria.nombre}
              </span>
              <div className="flex items-start justify-between gap-3">
                <h1 className="font-titulo text-[30px] leading-[1.05] font-semibold tracking-[-0.015em] [overflow-wrap:anywhere]">
                  {plato.nombre}
                </h1>
                {plato.hayStock && plato.tiempoPromedioMin !== null && (
                  <span className="inline-flex flex-none items-center gap-1 pt-1.5 text-[13px] leading-5">
                    <Clock aria-hidden className="size-3.5 text-dorado-700" strokeWidth={1.75} />
                    <span className="sr-only">Espera promedio: </span>
                    {formatoMinutos(plato.tiempoPromedioMin)}
                  </span>
                )}
              </div>
              <div className="text-[22px] leading-none font-semibold [font-feature-settings:'tnum']">
                {formatoPrecioCarta(plato.precio)}
              </div>
            </div>
            <div className="border-t border-linea-clasica" />
            {plato.descripcion && (
              <p className="m-0 text-justify text-[16px] leading-[26px] [hyphens:auto]" lang="es">
                {plato.descripcion}
              </p>
            )}
            {plato.modeloRa && (
              <p className="m-0 text-sm text-tinta-clasica/75">
                Porción: {formatoCantidad(plato.modeloRa.porcionGramos, 'GRAMO')}
              </p>
            )}
            {!plato.hayStock && <Aviso>Hoy no hay stock de este plato.</Aviso>}
            {plato.modeloRa && (
              <VisorRA
                modelo={plato.modeloRa}
                nombre={plato.nombre}
                fotoUrl={plato.fotoUrl}
                {...(puedePedir && {
                  alAgregar: () => agregar(1, ''),
                  cantidadEnPedido: carrito.cantidadDe(plato.id),
                })}
              />
            )}
            {puedePedir && (
              <section className="space-y-3 rounded-[18px] border border-linea-clasica bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Cantidad</span>
                  <SelectorCantidad valor={cantidad} onChange={setCantidad} nombre={plato.nombre} />
                </div>
                {plato.admiteObservaciones && (
                  <Campo etiqueta="Observaciones" ayuda="Por ejemplo: sin cebolla, bien cocida.">
                    <input
                      value={observaciones}
                      maxLength={200}
                      onChange={(e) => setObservaciones(e.target.value)}
                      className={`${claseInput} text-base`}
                    />
                  </Campo>
                )}
              </section>
            )}
            {recientes.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="m-0 font-titulo text-[22px] leading-[1.1] font-semibold tracking-[-0.015em]">
                  Vistos recientemente
                </h2>
                <div className="-mx-5 flex gap-3 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {recientes.map((r) => (
                    <Link
                      key={r.id}
                      to={`/s/${sucursalId}/platos/${r.id}`}
                      aria-label={r.nombre}
                      className="block size-28 flex-none overflow-hidden rounded-[18px] border border-linea-clasica bg-white hover:border-dorado"
                    >
                      {r.fotoUrl ? (
                        <img src={r.fotoUrl} alt="" className="block size-full object-cover" />
                      ) : (
                        <span
                          aria-hidden
                          className="grid size-full place-items-center bg-papel-hondo text-tinta-clasica/55"
                        >
                          <Utensils className="size-7" strokeWidth={1.5} />
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      )}
    </LayoutComensal>
  );
}
