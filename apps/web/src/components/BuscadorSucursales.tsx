import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Search, X } from 'lucide-react';
import { nombreBarrio, type BarrioConSucursales, type ResultadoBusqueda } from '@pgim/shared';
import { useRecurso } from '../lib/useRecurso';

const ESPERA_BUSQUEDA_MS = 300;

const claseBotonClasico =
  'inline-flex min-h-11 items-center justify-center rounded-cuadrado bg-papel-hondo px-5 font-titulo text-[18px] font-normal text-dorado-700 hover:bg-tinta-clasica/10';

// Buscador de sucursales (landing e inicio del comensal): texto libre y barrio.
// `compacto`: una sola columna, para el ancho de celular de LayoutComensal; además
// el título pasa a ser el h1 de la pantalla. El resultado se actualiza solo,
// poco después de que el visitante deja de escribir.
export function BuscadorSucursales({ compacto = false }: { compacto?: boolean }) {
  const [texto, setTexto] = useState('');
  // '' = todos los barrios.
  const [barrio, setBarrio] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const espera = setTimeout(() => setQ(texto.trim()), ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(espera);
  }, [texto]);

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (barrio) params.set('barrio', barrio);
  const consulta = params.toString();

  const barrios = useRecurso<BarrioConSucursales[]>('/publico/barrios').datos;
  const { datos, cargando, error, recargar } = useRecurso<ResultadoBusqueda[]>(
    `/publico/buscar${consulta ? `?${consulta}` : ''}`,
  );

  function limpiar() {
    setTexto('');
    setQ('');
    setBarrio('');
  }

  const resumen =
    datos && datos.length > 0
      ? `${datos.length === 1 ? '1 sucursal' : `${datos.length} sucursales`}${
          barrio ? ` en ${nombreBarrio(barrio as BarrioConSucursales['valor'])}` : ''
        }`
      : '';

  const claseCampo =
    'min-h-11 w-full rounded-clasico border border-linea-clasica bg-transparent px-3.5 font-sans text-[16px] text-tinta-clasica hover:border-dorado focus-visible:border-dorado';

  const Titulo = compacto ? 'h1' : 'h2';

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="font-sans text-[12px] leading-none font-semibold tracking-[0.12em] text-dorado-700 uppercase">
          Restaurantes
        </span>
        <Titulo className="m-0 font-titulo text-[30px] leading-[1.1] font-normal md:text-[38px]">
          Buscá dónde comer
        </Titulo>
        <p className="m-0 text-[16px] leading-7 text-tinta-clasica/80">
          Un restaurante, un barrio o un plato: mirá la carta y reservá tu mesa.
        </p>
      </div>
      <section className="mt-5 rounded-clasico border border-linea-clasica bg-papel p-3.5">
        <div className={`grid gap-2.5 ${compacto ? '' : 'md:grid-cols-[1fr_260px]'}`}>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-tinta-clasica/70"
            />
            <input
              type="search"
              aria-label="Buscar"
              placeholder="Restaurante, plato o dirección"
              value={texto}
              maxLength={100}
              onChange={(e) => setTexto(e.target.value)}
              className={`${claseCampo} pl-10 text-[16px] font-normal placeholder:text-tinta-clasica/70 [&::-webkit-search-cancel-button]:appearance-none ${texto ? 'pr-11' : ''}`}
            />
            {texto && (
              <button
                type="button"
                aria-label="Borrar búsqueda"
                onClick={() => setTexto('')}
                className="absolute top-0 right-0 inline-flex size-11 items-center justify-center rounded-clasico text-tinta-clasica/70 hover:text-tinta-clasica"
              >
                <X aria-hidden className="size-5" />
              </button>
            )}
          </div>
          <select
            aria-label="Barrio"
            value={barrio}
            onChange={(e) => setBarrio(e.target.value)}
            className={claseCampo}
          >
            <option value="">Todos los barrios</option>
            {barrios?.map((b) => (
              <option key={b.valor} value={b.valor}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="mt-5">
        {error ? (
          <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className="m-0 text-[16px] leading-7">
              No pudimos cargar las sucursales.
            </p>
            <button type="button" onClick={recargar} className={claseBotonClasico}>
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {cargando && !datos && (
              <p className="m-0 text-[13px] leading-5 text-tinta-clasica/70">Cargando…</p>
            )}
            <p aria-live="polite" className="mb-3 text-[13px] leading-5 text-tinta-clasica/70">
              {resumen}
            </p>
            {datos?.length === 0 && (
              <div className="flex flex-col items-start gap-3 border-y border-linea-clasica py-7">
                <p className="m-0 font-titulo text-2xl leading-[1.1] font-normal">
                  No encontramos sucursales con esa búsqueda
                </p>
                <p className="m-0 text-[16px] leading-7 text-tinta-clasica/80">
                  Probá con otro plato o elegí Todos los barrios.
                </p>
                <button type="button" onClick={limpiar} className={claseBotonClasico}>
                  Limpiar búsqueda
                </button>
              </div>
            )}
            {datos && datos.length > 0 && (
              <ul className={`grid gap-x-5 gap-y-9 ${compacto ? '' : 'md:grid-cols-3'}`}>
                {datos.map((r) => (
                  <TarjetaResultado key={r.sucursal.id} r={r} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}

// Compara sin tildes ni mayúsculas.
const mismoTexto = (a: string, b: string) =>
  a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0;

function TarjetaResultado({ r }: { r: ResultadoBusqueda }) {
  const { sucursal, restaurante, platosCoincidentes } = r;
  // La foto que no carga se trata como si no hubiera: queda solo el texto.
  const [fotoRota, setFotoRota] = useState<string | null>(null);
  const foto = sucursal.fotoUrl !== fotoRota ? sucursal.fotoUrl : null;
  return (
    <li className="flex flex-col gap-3.5">
      {foto && (
        <img
          src={foto}
          alt=""
          loading="lazy"
          onError={() => setFotoRota(foto)}
          className="block aspect-video w-full rounded-clasico bg-papel-hondo object-cover"
        />
      )}
      <div className="flex flex-col gap-1">
        <p className="m-0 font-titulo text-2xl leading-[1.1] font-normal">{restaurante.nombre}</p>
        <p className="m-0 text-[13px] leading-5 text-tinta-clasica/70">
          {mismoTexto(sucursal.nombre, nombreBarrio(sucursal.barrio))
            ? sucursal.nombre
            : `${sucursal.nombre} · ${nombreBarrio(sucursal.barrio)}`}
          {' · '}
          {sucursal.direccion}
        </p>
        {platosCoincidentes.length > 0 && (
          <p className="m-0 text-[13px] leading-5">
            <span className="font-semibold">Coincide:</span> {platosCoincidentes.join(', ')}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          to={`/s/${sucursal.id}/reservar`}
          className="inline-flex min-h-11 items-center justify-center rounded-cuadrado bg-dorado-700 px-5 font-titulo text-[18px] font-normal text-white hover:bg-dorado-800"
        >
          Reservar mesa
        </Link>
        <Link
          to={`/s/${sucursal.id}/menu`}
          className="inline-flex min-h-11 items-center justify-center rounded-cuadrado bg-papel-hondo px-5 font-titulo text-[18px] font-normal text-dorado-700 hover:bg-tinta-clasica/10"
        >
          Ver carta →
        </Link>
      </div>
    </li>
  );
}
