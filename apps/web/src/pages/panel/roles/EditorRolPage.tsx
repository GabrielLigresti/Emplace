import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Plus } from 'lucide-react';
import type { Rol } from '@pgim/shared';
import { useSesion } from '../../../auth/SesionProvider';
import { useConfirmar } from '../../../components/Confirmacion';
import { Aviso, Boton, EstadoCarga } from '../../../components/ui';
import { colorArquetipo } from '../../../lib/catalogo-permisos';
import { useGuardar } from '../../../lib/useGuardar';
import { useRecurso } from '../../../lib/useRecurso';
import { PestanaEmpleados } from './PestanaEmpleados';
import { PestanaGeneral } from './PestanaGeneral';
import { PestanaPermisos } from './PestanaPermisos';
import { aRolInput, useBorradorRol } from './useBorradorRol';

const PESTANAS = ['general', 'permisos', 'empleados'] as const;
type Pestana = (typeof PESTANAS)[number];

const claseTab = 'inline-flex min-h-11 items-center border-b-2 px-3 text-sm sm:min-h-10';

// CU-02: editor de un rol (o alta, en la ruta roles/nuevo). General y Permisos
// comparten un borrador que se guarda de una vez; Empleados guarda por su cuenta.
export function EditorRolPage() {
  const { id, pestana } = useParams();
  const location = useLocation();
  const [busqueda] = useSearchParams();
  const roles = useRecurso<Rol[]>('/roles');

  if (id && !PESTANAS.includes(pestana as Pestana)) {
    return <Navigate to={`/panel/roles/${id}/permisos`} replace />;
  }

  const rol = id ? (roles.datos?.find((r) => r.id === id) ?? null) : null;
  // Recién creado: la lista todavía no lo trae, se está recargando.
  const esperandoLista =
    !!id && !rol && (roles.cargando || (location.state as { creado?: boolean } | null)?.creado);

  if (id && !rol) {
    return (
      <section className="mx-auto max-w-5xl">
        <EstadoCarga cargando={!!esperandoLista} error={roles.error} />
        {!esperandoLista && !roles.error && roles.datos && (
          <div className="space-y-3">
            <Aviso>No se encontró el rol.</Aviso>
            <Link to="/panel/roles" className="text-sm text-accent-ink underline">
              Volver a Roles
            </Link>
          </div>
        )}
      </section>
    );
  }

  return (
    <Editor
      key={id ?? 'nuevo'}
      rol={rol}
      roles={roles.datos ?? []}
      pestana={
        id ? (pestana as Pestana) : busqueda.get('pestana') === 'permisos' ? 'permisos' : 'general'
      }
      recargarRoles={roles.recargar}
    />
  );
}

function Editor({
  rol,
  roles,
  pestana,
  recargarRoles,
}: {
  rol: Rol | null;
  roles: Rol[];
  pestana: Pestana;
  recargarRoles(): void;
}) {
  const { sesion, recargarSesion } = useSesion();
  const confirmar = useConfirmar();
  const navegar = useNavigate();
  const accion = useGuardar();
  const { borrador, hayCambios, cambiar, descartar, marcarGuardado } = useBorradorRol(rol);

  const nuevo = rol === null;
  const base = rol ? `/panel/roles/${rol.id}` : null;
  const titulo = nuevo ? 'Crear rol' : `Editar rol: ${rol.nombre}`;
  const esRolPropio = !!rol && sesion?.rol?.id === rol.id;
  const sinPermisos = borrador.permisos.length === 0;
  const sinNombre = borrador.nombre.trim() === '';

  // Mientras haya cambios, el navegador avisa antes de cerrar o recargar la pestaña.
  useEffect(() => {
    if (!hayCambios) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [hayCambios]);

  // Los links que sacan del editor piden confirmación si hay cambios sin guardar.
  async function salir(e: MouseEvent, destino: string) {
    if (!hayCambios) return;
    e.preventDefault();
    const ok = await confirmar({
      mensaje: 'Tenés cambios sin guardar',
      detalle: 'Si salís ahora, se pierden.',
      accion: 'Salir sin guardar',
    });
    if (ok) {
      descartar();
      navegar(destino);
    }
  }

  async function guardar() {
    const datos = aRolInput(borrador);
    if (rol) {
      const respuesta = await accion.enviar<Rol>(`/roles/${rol.id}`, 'PUT', datos);
      if (!respuesta) return;
      marcarGuardado(borrador);
      recargarRoles();
      await recargarSesion();
    } else {
      const respuesta = await accion.enviar<Rol>('/roles', 'POST', datos);
      if (!respuesta) return;
      marcarGuardado(borrador);
      recargarRoles();
      await recargarSesion();
      navegar(`/panel/roles/${respuesta.datos.id}/permisos`, { state: { creado: true } });
    }
  }

  function tab(valor: Pestana, texto: ReactNode) {
    const activa = pestana === valor;
    const clase = `${claseTab} ${activa ? 'border-accent font-semibold text-ink' : 'border-transparent text-meta hover:text-text'}`;
    if (valor === 'empleados' && !base) {
      return (
        <span aria-disabled="true" className={`${claseTab} border-transparent text-meta/50`}>
          {texto}
        </span>
      );
    }
    // Modo nuevo: no hay id, así que la sección va en el parámetro ?pestana.
    const destino = base ? `${base}/${valor}` : `/panel/roles/nuevo?pestana=${valor}`;
    return (
      <Link to={destino} aria-current={activa ? 'page' : undefined} className={clase}>
        {texto}
      </Link>
    );
  }

  return (
    <section className="mx-auto max-w-6xl lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
      <aside className="mb-4 min-w-0 lg:mb-0">
        <Link
          to="/panel/roles"
          onClick={(e) => void salir(e, '/panel/roles')}
          className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-meta hover:text-text sm:min-h-9"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Roles
        </Link>
        <div className="flex items-start gap-2 lg:flex-col lg:items-stretch">
          <nav
            aria-label="Roles"
            className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0"
          >
            {roles.map((r) => {
              const actual = r.id === rol?.id;
              return (
                <Link
                  key={r.id}
                  to={`/panel/roles/${r.id}/${pestana === 'empleados' ? 'empleados' : 'permisos'}`}
                  onClick={(e) => void salir(e, `/panel/roles/${r.id}/permisos`)}
                  aria-current={actual ? 'page' : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-sm sm:min-h-9 lg:rounded-control lg:border-transparent ${
                    actual
                      ? 'border-accent/20 bg-accent-soft font-semibold text-accent-ink'
                      : 'border-line-strong text-text hover:bg-panel'
                  } ${r.activo ? '' : 'opacity-60'}`}
                >
                  <span
                    aria-hidden
                    className={`size-2.5 shrink-0 rounded-full ${colorArquetipo(r.arquetipo)}`}
                  />
                  {r.nombre}
                </Link>
              );
            })}
          </nav>
          <Link
            to="/panel/roles/nuevo"
            onClick={(e) => void salir(e, '/panel/roles/nuevo')}
            aria-label="Crear rol"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-cuadrado bg-panel text-ink hover:bg-line lg:order-first lg:self-start"
          >
            <Plus aria-hidden className="size-[18px]" />
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-3">
          <nav aria-label="Ruta" className="text-sm text-meta">
            Roles y permisos / <span aria-current="page">{rol?.nombre ?? 'Nuevo rol'}</span>
          </nav>
          <h1 className="text-xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">
            {titulo}
          </h1>
        </div>

        <nav
          aria-label="Secciones del rol"
          className="mb-4 flex gap-1 overflow-x-auto border-b border-line"
        >
          {tab('general', 'General')}
          {tab('permisos', 'Permisos')}
          {tab('empleados', `Empleados (${rol?.cantidadEmpleados ?? 0})`)}
        </nav>

        {pestana === 'general' && <PestanaGeneral borrador={borrador} onCambiar={cambiar} />}
        {pestana === 'permisos' && (
          <PestanaPermisos
            permisos={borrador.permisos}
            esRolPropio={esRolPropio}
            onCambiar={(permisos) => cambiar({ permisos })}
          />
        )}
        {pestana === 'empleados' && rol && (
          <PestanaEmpleados
            rol={rol}
            roles={roles}
            onCambio={async () => {
              recargarRoles();
              await recargarSesion();
            }}
          />
        )}

        {accion.error && (
          <div className="mt-4">
            <Aviso>{accion.error}</Aviso>
          </div>
        )}
        {hayCambios && (
          <div
            role="status"
            className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 shadow-flotante"
          >
            <p className="text-sm font-medium text-ink">Tenés cambios sin guardar</p>
            <div className="flex gap-2">
              <Boton variante="secundario" onClick={descartar} disabled={accion.enviando}>
                Descartar
              </Boton>
              <Boton
                onClick={() => void guardar()}
                disabled={accion.enviando || sinPermisos || sinNombre}
              >
                {nuevo ? 'Crear rol' : 'Guardar cambios'}
              </Boton>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
