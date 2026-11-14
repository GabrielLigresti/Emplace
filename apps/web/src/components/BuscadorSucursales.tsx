import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Search, SearchX, X } from 'lucide-react';
import { nombreBarrio, type BarrioConSucursales, type ResultadoBusqueda } from '@pgim/shared';
import { useRecurso } from '../lib/useRecurso';
import { useRevelar } from '../lib/useRevelar';
import { Aviso, Boton, EstadoCarga, Vacio, claseInput } from './ui';

const ESPERA_BUSQUEDA_MS = 300;

// Buscador de la landing: texto libre y barrio. El resultado se actualiza solo,
// poco después de que el visitante deja de escribir.
export function BuscadorSucursales() {
  const [texto, setTexto] = useState('');
  // '' = todos los barrios.
  const [barrio, setBarrio] = useState('');
  const [q, setQ] = useState('');
  const refHeroe = useRevelar();
  const refResultados = useRevelar<HTMLElement>();

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

  return (
    <>
      <div ref={refHeroe} className="revelar max-w-[560px] pt-8 lg:pt-[14svh]">
        <h1 className="max-w-[14ch] text-[clamp(38px,3.6vw,56px)] leading-[1.02] font-semibold tracking-[-0.03em] text-balance text-ink">
          Mirá el plato antes de pedirlo
        </h1>
        <p className="mt-9 max-w-[42ch] text-[17px] leading-[26px] text-text">
          Buscá restaurantes de Buenos Aires por nombre, plato o barrio, abrí la carta sin cuenta y
          mirá el plato a tamaño real sobre tu mesa.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_200px]">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-meta"
            />
            <input
              id="buscar"
              type="search"
              aria-label="Buscar"
              placeholder="Restaurante, plato o dirección"
              value={texto}
              maxLength={100}
              onChange={(e) => setTexto(e.target.value)}
              className={`${claseInput} min-h-12 pl-10 sm:min-h-12 sm:text-[16px] [&::-webkit-search-cancel-button]:appearance-none ${texto ? 'pr-11' : ''}`}
            />
            {texto && (
              <button
                type="button"
                aria-label="Borrar búsqueda"
                onClick={() => setTexto('')}
                className="absolute top-0.5 right-0 inline-flex size-11 items-center justify-center rounded-control text-meta hover:text-text"
              >
                <X aria-hidden className="size-5" />
              </button>
            )}
          </div>
          <select
            aria-label="Barrio"
            value={barrio}
            onChange={(e) => setBarrio(e.target.value)}
            className={`${claseInput} min-h-12 sm:min-h-12 sm:text-[16px]`}
          >
            <option value="">Todos los barrios</option>
            {barrios?.map((b) => (
              <option key={b.valor} value={b.valor}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section
        ref={refResultados}
        aria-labelledby="titulo-restaurantes"
        className="revelar mt-16 max-w-[560px]"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="titulo-restaurantes"
            className="text-[clamp(26px,2.2vw,32px)] leading-[1.1] font-semibold tracking-[-0.025em] text-ink"
          >
            Dónde comer
          </h2>
          <p aria-live="polite" className="text-[14px] leading-5 text-text">
            {resumen}
          </p>
        </div>
        <div className="mt-5">
          {error ? (
            <div className="grid justify-items-start gap-3">
              <Aviso tono="bad">No pudimos cargar las sucursales.</Aviso>
              <Boton variante="secundario" densidad="comensal" onClick={recargar}>
                Reintentar
              </Boton>
            </div>
          ) : (
            <>
              <EstadoCarga cargando={cargando && !datos} error={null} />
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
                <ul className="grid gap-3">
                  {datos.map((r) => (
                    <TarjetaResultado key={r.sucursal.id} r={r} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}

// Compara sin tildes ni mayúsculas.
const mismoTexto = (a: string, b: string) =>
  a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0;

function TarjetaResultado({ r }: { r: ResultadoBusqueda }) {
  const { sucursal, restaurante, platosCoincidentes } = r;
  return (
    <li className="flex flex-col gap-1 rounded-panel bg-surface p-5">
      <p className="text-[22px] leading-7 font-semibold text-ink">{restaurante.nombre}</p>
      <p className="text-[17px] leading-[26px] font-medium text-ink">
        {mismoTexto(sucursal.nombre, nombreBarrio(sucursal.barrio))
          ? sucursal.nombre
          : `${sucursal.nombre} · ${nombreBarrio(sucursal.barrio)}`}
      </p>
      <p className="text-[15px] text-meta">{sucursal.direccion}</p>
      {platosCoincidentes.length > 0 && (
        <p className="text-[17px] leading-[26px] text-text">
          <span className="font-medium text-accent-ink">Coincide:</span>{' '}
          {platosCoincidentes.join(', ')}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Link
          to={`/s/${sucursal.id}/menu`}
          className="inline-flex min-h-11 items-center justify-center rounded-control bg-panel px-4 text-sm font-semibold text-text transition hover:bg-line active:scale-[0.98]"
        >
          Ver carta
        </Link>
        <Link
          to={`/s/${sucursal.id}/reservar`}
          className="inline-flex min-h-11 items-center justify-center rounded-control bg-accent-soft px-4 text-sm font-semibold text-accent-ink transition hover:bg-accent/15 active:scale-[0.98]"
        >
          Reservar
        </Link>
      </div>
    </li>
  );
}
