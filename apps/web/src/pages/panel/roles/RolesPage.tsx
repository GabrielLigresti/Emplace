import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Copy, Pencil, Plus, Power, Search, Trash2, User } from 'lucide-react';
import type { Rol, RolInput } from '@pgim/shared';
import { useSesion } from '../../../auth/SesionProvider';
import { useConfirmar } from '../../../components/Confirmacion';
import { Aviso, EstadoCarga, Etiqueta, claseInput } from '../../../components/ui';
import { colorArquetipo, descripcionRol } from '../../../lib/catalogo-permisos';
import { useGuardar } from '../../../lib/useGuardar';
import { useRecurso } from '../../../lib/useRecurso';
import { MenuAcciones, type AccionMenu } from './MenuAcciones';

// "Copia de X", y si ya existe, "Copia de X (2)", "(3)"…
function nombreDeCopia(nombre: string, existentes: string[]): string {
  const usados = new Set(existentes.map((n) => n.toLowerCase()));
  const base = `Copia de ${nombre}`;
  if (!usados.has(base.toLowerCase())) return base;
  let n = 2;
  while (usados.has(`${base} (${n})`.toLowerCase())) n++;
  return `${base} (${n})`;
}

function sinAcentos(texto: string) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// CU-02: lista de roles. Edición, alta, baja y eliminación según los permisos.
export function RolesPage() {
  const { tienePermiso, recargarSesion } = useSesion();
  const roles = useRecurso<Rol[]>('/roles');
  const accion = useGuardar();
  const confirmar = useConfirmar();
  const navegar = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  const puedeCrear = tienePermiso('rol.crear');
  const puedeEditar = tienePermiso('rol.editar');
  const puedeEliminar = tienePermiso('rol.eliminar');

  const filtro = sinAcentos(busqueda.trim());
  const visibles = (roles.datos ?? []).filter((r) => sinAcentos(r.nombre).includes(filtro));

  async function terminada() {
    roles.recargar();
    // Si se tocó el rol propio, los permisos de la sesión cambian.
    await recargarSesion();
  }

  // Corre una acción y muestra su error arriba de la tabla.
  async function ejecutar(ruta: string, method: string, body?: unknown): Promise<boolean> {
    setAviso(null);
    const respuesta = await accion.enviar(ruta, method, body);
    if (respuesta) await terminada();
    return respuesta !== null;
  }

  async function alternarActivo(rol: Rol) {
    if (
      rol.activo &&
      !(await confirmar({
        mensaje: `¿Desactivar el rol ${rol.nombre}?`,
        detalle: 'Deja de poder asignarse a empleados. Su historial se conserva.',
        accion: 'Desactivar',
      }))
    )
      return;
    const datos: RolInput = {
      nombre: rol.nombre,
      arquetipo: rol.arquetipo,
      permisos: rol.permisos,
      activo: !rol.activo,
    };
    await ejecutar(`/roles/${rol.id}`, 'PUT', datos);
  }

  async function duplicar(rol: Rol) {
    const datos: RolInput = {
      nombre: nombreDeCopia(
        rol.nombre,
        (roles.datos ?? []).map((r) => r.nombre),
      ),
      arquetipo: rol.arquetipo,
      permisos: rol.permisos,
    };
    setAviso(null);
    const respuesta = await accion.enviar<Rol>('/roles', 'POST', datos);
    if (!respuesta) return;
    await recargarSesion();
    navegar(`/panel/roles/${respuesta.datos.id}/permisos`);
  }

  async function eliminar(rol: Rol) {
    if (rol.cantidadEmpleados > 0) {
      setAviso(
        `No se puede eliminar ${rol.nombre}: tiene ${rol.cantidadEmpleados} empleado(s) asignado(s). Pasalos a otro rol antes.`,
      );
      return;
    }
    if (
      !(await confirmar({
        mensaje: `¿Eliminar el rol ${rol.nombre}?`,
        detalle: 'Se borra para siempre. Si preferís conservarlo, desactivalo.',
        accion: 'Eliminar',
      }))
    )
      return;
    await ejecutar(`/roles/${rol.id}/definitivo`, 'DELETE');
  }

  function accionesDe(rol: Rol): AccionMenu[] {
    const lista: AccionMenu[] = [];
    if (puedeCrear)
      lista.push({ texto: 'Duplicar rol', icono: Copy, onSeleccionar: () => void duplicar(rol) });
    if (puedeEditar)
      lista.push({
        texto: rol.activo ? 'Desactivar' : 'Activar',
        icono: Power,
        onSeleccionar: () => void alternarActivo(rol),
      });
    if (puedeEliminar)
      lista.push({
        texto: 'Eliminar rol',
        icono: Trash2,
        peligro: true,
        onSeleccionar: () => void eliminar(rol),
      });
    return lista;
  }

  const error = aviso ?? accion.error;

  return (
    <section className="mx-auto max-w-5xl">
      <div className="mb-4">
        <nav aria-label="Ruta" className="text-sm text-meta">
          Configuración / <span aria-current="page">Roles y permisos</span>
        </nav>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Roles</h1>
        <p className="text-sm text-meta">
          Agrupá a tu personal y definí qué puede hacer cada uno en el sistema.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-72">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-meta"
          />
          <input
            type="search"
            aria-label="Buscar roles"
            placeholder="Buscar roles"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={`${claseInput} pl-10`}
          />
        </div>
        {puedeCrear && (
          <Link
            to="/panel/roles/nuevo"
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-control border border-accent bg-accent px-4 text-sm font-medium text-white hover:border-accent-hover hover:bg-accent-hover sm:min-h-9 sm:w-auto"
          >
            <Plus aria-hidden className="size-4" />
            Crear rol
          </Link>
        )}
      </div>

      <EstadoCarga cargando={roles.cargando && !roles.datos} error={roles.error} />
      {error && (
        <div className="mb-3">
          <Aviso>{error}</Aviso>
        </div>
      )}

      {roles.datos && (
        <div className="overflow-x-auto rounded-panel border border-line bg-surface">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[minmax(0,1fr)_112px_112px] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-meta">
              <span>Roles — {visibles.length}</span>
              <span>Empleados</span>
              <span className="text-right">Acciones</span>
            </div>
            {visibles.length === 0 && (
              <p className="px-5 py-6 text-sm text-meta">
                No hay roles que coincidan con la búsqueda.
              </p>
            )}
            <ul>
              {visibles.map((rol) => (
                <li
                  key={rol.id}
                  className={`grid grid-cols-[minmax(0,1fr)_112px_112px] items-center gap-4 border-b border-line px-5 py-3 last:border-b-0 ${rol.activo ? '' : 'opacity-60'}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className={`size-3 shrink-0 rounded-full ${colorArquetipo(rol.arquetipo)}`}
                    />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                        {rol.nombre}
                        {!rol.activo && <Etiqueta>Desactivado</Etiqueta>}
                      </p>
                      <p className="text-sm text-meta">{descripcionRol(rol)}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 text-sm text-text">
                    <User aria-hidden className="size-4 text-meta" />
                    {rol.cantidadEmpleados}
                  </span>
                  <div className="flex justify-end gap-2">
                    {puedeEditar && (
                      <Link
                        to={`/panel/roles/${rol.id}/permisos`}
                        aria-label={`Editar rol ${rol.nombre}`}
                        className="inline-flex size-11 items-center justify-center rounded-cuadrado bg-panel text-ink hover:bg-line"
                      >
                        <Pencil aria-hidden className="size-[18px]" />
                      </Link>
                    )}
                    {puedeEditar && (
                      <MenuAcciones
                        etiqueta={`Más acciones para ${rol.nombre}`}
                        acciones={accionesDe(rol)}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
