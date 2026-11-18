import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { EmpleadoDeRol, Rol } from '@pgim/shared';
import { Boton, EstadoCarga, Etiqueta, claseInput } from '../../../components/ui';
import { useRecurso } from '../../../lib/useRecurso';
import { ModalAgregarEmpleados } from './ModalAgregarEmpleados';
import { ModalMoverEmpleado } from './ModalMoverEmpleado';

export interface PropsPestanaEmpleados {
  rol: Rol;
  // Todos los roles, para elegir a cuál pasa un empleado.
  roles: Rol[];
  // Recarga la lista de roles (contadores) y la sesión; la pestaña lo llama tras cada cambio.
  onCambio(): void | Promise<void>;
}

function sinAcentos(texto: string) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function PestanaEmpleados({ rol, roles, onCambio }: PropsPestanaEmpleados) {
  const empleados = useRecurso<EmpleadoDeRol[]>('/roles/empleados');
  const [busqueda, setBusqueda] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [quitando, setQuitando] = useState<EmpleadoDeRol | null>(null);

  const todos = empleados.datos ?? [];
  const delRol = todos.filter((e) => e.rol.id === rol.id);
  const filtro = sinAcentos(busqueda.trim());
  const visibles = delRol.filter(
    (e) => sinAcentos(e.nombreCompleto).includes(filtro) || sinAcentos(e.email).includes(filtro),
  );

  async function cambioHecho() {
    empleados.recargar();
    await onCambio();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-72">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-meta"
          />
          <input
            type="search"
            aria-label="Buscar empleados con este rol"
            placeholder="Buscar empleados con este rol"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={`${claseInput} pl-10`}
          />
        </div>
        <Boton
          className="w-full sm:w-auto"
          onClick={() => setAgregando(true)}
          disabled={!rol.activo || !empleados.datos}
        >
          <Plus aria-hidden className="size-4" />
          Agregar empleados
        </Boton>
      </div>
      {!rol.activo && <p className="text-sm text-meta">Activá el rol para asignarle empleados.</p>}

      <EstadoCarga cargando={empleados.cargando && !empleados.datos} error={empleados.error} />

      {empleados.datos && (
        <div className="overflow-x-auto rounded-panel border border-line bg-surface">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_112px] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-meta">
              <span>Empleado</span>
              <span>Sucursales</span>
              <span className="text-right">Acción</span>
            </div>
            {visibles.length === 0 && (
              <p className="px-5 py-6 text-sm text-meta">
                {delRol.length === 0
                  ? 'Este rol todavía no tiene empleados.'
                  : 'No hay empleados que coincidan con la búsqueda.'}
              </p>
            )}
            <ul>
              {visibles.map((e) => (
                <li
                  key={e.id}
                  className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_112px] items-center gap-4 border-b border-line px-5 py-3 last:border-b-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-panel text-sm font-semibold text-ink"
                    >
                      {iniciales(e.nombreCompleto)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{e.nombreCompleto}</p>
                      <p className="truncate text-sm text-meta">{e.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {e.sucursales.map((s) => (
                      <Etiqueta key={s.id}>{s.nombre}</Etiqueta>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Boton
                      variante="secundario"
                      aria-label={`Quitar el rol a ${e.nombreCompleto}`}
                      onClick={() => setQuitando(e)}
                    >
                      Quitar
                    </Boton>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {empleados.datos && (
        <p className="text-sm text-meta">
          Mostrando {visibles.length} de {delRol.length} empleados
        </p>
      )}

      {agregando && (
        <ModalAgregarEmpleados
          rol={rol}
          candidatos={todos.filter((e) => e.rol.id !== rol.id)}
          onCerrar={() => setAgregando(false)}
          onAgregados={cambioHecho}
        />
      )}
      {quitando && (
        <ModalMoverEmpleado
          empleado={quitando}
          rolesDestino={roles.filter((r) => r.activo && r.id !== rol.id)}
          onCerrar={() => setQuitando(null)}
          onMovido={cambioHecho}
        />
      )}
    </div>
  );
}
