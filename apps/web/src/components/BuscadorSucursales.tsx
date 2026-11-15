import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Search, SearchX, X } from 'lucide-react';
import { nombreBarrio, type BarrioConSucursales, type ResultadoBusqueda } from '@pgim/shared';
import { useRecurso } from '../lib/useRecurso';
import { Aviso, Boton, EstadoCarga, Vacio } from './ui';

const ESPERA_BUSQUEDA_MS = 300;

// Buscador de la landing: texto libre y barrio. El resultado se actualiza solo,
// poco después de que el visitante deja de escribir.
export function BuscadorSucursales() {
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
    'min-h-11 w-full rounded border border-linea-clasica bg-transparent px-3.5 font-titulo text-lg font-semibold text-tinta-clasica hover:border-dorado focus-visible:border-dorado';

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="font-lora text-[13px] leading-none tracking-[0.08em] text-dorado-700 uppercase">
          Restaurantes
        </span>
        <h2 className="m-0 font-titulo text-[30px] leading-[1.1] font-normal md:text-[38px]">
          Buscá dónde comer
        </h2>
        <p className="m-0 text-[15.5px] leading-7 text-tinta-clasica/80">
          Un restaurante, un barrio o un plato: mirá la carta y reservá tu mesa.
        </p>
      </div>
      <section className="mt-5 rounded border border-linea-clasica bg-papel p-3.5">
        <div className="grid gap-2.5 md:grid-cols-[1fr_260px]">
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
              className={`${claseCampo} pl-10 text-base font-normal placeholder:text-tinta-clasica/55 [&::-webkit-search-cancel-button]:appearance-none ${texto ? 'pr-11' : ''}`}
            />
            {texto && (
              <button
                type="button"
                aria-label="Borrar búsqueda"
                onClick={() => setTexto('')}
                className="absolute top-0 right-0 inline-flex size-11 items-center justify-center rounded text-tinta-clasica/70 hover:text-tinta-clasica"
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
            <Aviso tono="bad">No pudimos cargar las sucursales.</Aviso>
            <Boton variante="secundario" densidad="comensal" onClick={recargar}>
              Reintentar
            </Boton>
          </div>
        ) : (
          <>
            <EstadoCarga cargando={cargando && !datos} error={null} />
            <p aria-live="polite" className="mb-3 text-[13px] leading-5 text-tinta-clasica/70">
              {resumen}
            </p>
            {datos?.length === 0 && (
              <Vacio
                icono={SearchX}
                titulo="No encontramos sucursales con esa búsqueda"
                texto="Probá con otro plato o elegí Todos los barrios."
                accion={
                  <Boton variante="secundario" densidad="comensal" onClick={limpiar}>
                    Limpiar búsqueda
                  </Boton>
                }
              />
            )}
            {datos && datos.length > 0 && (
              <ul className="grid gap-5 md:grid-cols-3">
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
  return (
    <li className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <p className="m-0 font-titulo text-2xl leading-[1.1] font-semibold">{restaurante.nombre}</p>
        <p className="m-0 text-[13px] leading-5 text-tinta-clasica/70">
          {mismoTexto(sucursal.nombre, nombreBarrio(sucursal.barrio))
            ? sucursal.nombre
            : `${sucursal.nombre} · ${nombreBarrio(sucursal.barrio)}`}
          {' · '}
          {sucursal.direccion}
        </p>
        {platosCoincidentes.length > 0 && (
          <p className="m-0 text-[13px] leading-5">
            <span className="text-dorado-700">Coincide:</span> {platosCoincidentes.join(', ')}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        <Link
          to={`/s/${sucursal.id}/reservar`}
          className="inline-flex min-h-11 items-center justify-center rounded-cuadrado bg-dorado-700 px-5 font-titulo text-base font-semibold text-white hover:bg-dorado-800"
        >
          Reservar mesa
        </Link>
        <Link
          to={`/s/${sucursal.id}/menu`}
          className="inline-flex min-h-11 items-center justify-center rounded-cuadrado bg-papel-hondo px-5 font-titulo text-base font-semibold text-dorado-700 hover:bg-tinta-clasica/10"
        >
          Ver carta →
        </Link>
      </div>
    </li>
  );
}
