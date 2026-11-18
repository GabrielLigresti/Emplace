import { useState } from 'react';
import { Search, TriangleAlert } from 'lucide-react';
import type { CodigoPermiso } from '@pgim/shared';
import { Boton, Etiqueta, claseInput } from '../../../components/ui';
import { CATALOGO_PERMISOS, GRUPOS_PERMISOS, infoPermiso } from '../../../lib/catalogo-permisos';

function sinAcentos(texto: string) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// Interruptor de encendido y apagado: pista de 44×24, perilla blanca.
function Interruptor({
  activo,
  nombre,
  disabled,
  onCambiar,
}: {
  activo: boolean;
  nombre: string;
  disabled?: boolean;
  onCambiar(valor: boolean): void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={nombre}
      disabled={disabled}
      onClick={() => onCambiar(!activo)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${activo ? 'bg-accent' : 'bg-line-strong'}`}
    >
      <span
        aria-hidden
        className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${activo ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}

const PROTEGIDOS: readonly CodigoPermiso[] = ['rol.ver', 'rol.editar'];

export function PestanaPermisos({
  permisos,
  esRolPropio,
  onCambiar,
}: {
  permisos: CodigoPermiso[];
  // El rol editado es el del usuario de la sesión.
  esRolPropio: boolean;
  onCambiar(permisos: CodigoPermiso[]): void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const filtro = sinAcentos(busqueda.trim());
  const total = Object.keys(CATALOGO_PERMISOS).length;

  function alternar(codigo: CodigoPermiso, valor: boolean) {
    onCambiar(valor ? [...permisos, codigo] : permisos.filter((p) => p !== codigo));
  }

  const grupos = GRUPOS_PERMISOS.map((g) => ({
    nombre: g.nombre,
    permisos: g.permisos.filter((codigo) => {
      const info = infoPermiso(codigo);
      return sinAcentos(`${info.nombre} ${info.descripcion}`).includes(filtro);
    }),
  })).filter((g) => g.permisos.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-64">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-meta"
          />
          <input
            type="search"
            aria-label="Buscar permisos"
            placeholder="Buscar permisos"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={`${claseInput} pl-10`}
          />
        </div>
        <p className="text-sm text-meta tabular-nums">
          {permisos.length} de {total} habilitados
        </p>
        <Boton variante="fantasma" onClick={() => onCambiar([])} disabled={permisos.length === 0}>
          Restablecer permisos
        </Boton>
      </div>
      {permisos.length === 0 && (
        <p className="text-sm font-medium text-bad">Elegí al menos un permiso</p>
      )}

      {grupos.length === 0 && (
        <p className="text-sm text-meta">No hay permisos que coincidan con la búsqueda.</p>
      )}
      {grupos.map((grupo) => (
        <section key={grupo.nombre} className="space-y-1.5">
          <h2 className="text-[13px] font-semibold text-meta">{grupo.nombre}</h2>
          <ul className="rounded-panel border border-line bg-surface">
            {grupo.permisos.map((codigo) => {
              const info = infoPermiso(codigo);
              const bloqueado = esRolPropio && PROTEGIDOS.includes(codigo);
              return (
                <li
                  key={codigo}
                  className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      {info.nombre}
                      {'sensible' in info && (
                        <Etiqueta tono="warn">
                          <TriangleAlert aria-hidden className="size-3.5" />
                          Sensible
                        </Etiqueta>
                      )}
                    </p>
                    <p className="text-sm text-meta">{info.descripcion}</p>
                    {bloqueado && (
                      <p className="text-xs text-meta">
                        Es tu rol: no podés quitarte este permiso.
                      </p>
                    )}
                  </div>
                  <Interruptor
                    activo={permisos.includes(codigo)}
                    nombre={info.nombre}
                    disabled={bloqueado}
                    onCambiar={(v) => alternar(codigo, v)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
