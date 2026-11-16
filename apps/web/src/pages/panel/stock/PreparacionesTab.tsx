import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import {
  ETIQUETA_UNIDAD,
  convertirUnidad,
  type ResumenRecetas,
  type UnidadBase,
} from '@pgim/shared';
import { useSesion } from '../../../auth/SesionProvider';
import { useConfirmar } from '../../../components/Confirmacion';
import { Lista } from '../../../components/Lista';
import { Aviso, EstadoCarga, Etiqueta } from '../../../components/ui';
import { NOMBRE_UNIDAD, formatoPesos } from '../../../lib/formato';
import { useGuardar } from '../../../lib/useGuardar';
import { useRecurso } from '../../../lib/useRecurso';

// Costo por kg o por l cuando la base es g o ml, que es como se compra y se lee.
function textoCosto(costoUnitario: number, base: UnidadBase) {
  if (base === 'UNIDAD') return `${formatoPesos(costoUnitario)} por unidad`;
  const grande = base === 'GRAMO' ? 'KILOGRAMO' : 'LITRO';
  return `${formatoPesos(costoUnitario * convertirUnidad(1, grande, base))} por ${ETIQUETA_UNIDAD[grande]}`;
}

const claseLink =
  'inline-block rounded-control border border-line-strong bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-panel';

// Preparaciones que se usan en otras recetas: listado, costo y alta/baja.
export function PreparacionesTab({
  accionesEncabezado,
}: {
  accionesEncabezado: HTMLElement | null;
}) {
  const { tienePermiso } = useSesion();
  const { datos, cargando, error, recargar } = useRecurso<ResumenRecetas>('/recetas');
  const baja = useGuardar();
  const confirmar = useConfirmar();

  async function darDeBaja(id: string, nombre: string) {
    if (
      !(await confirmar({
        mensaje: `¿Dar de baja la preparación ${nombre}?`,
        detalle: 'Deja de estar disponible para nuevas recetas. Su historial se conserva.',
        accion: 'Dar de baja',
      }))
    )
      return;
    if (await baja.enviar(`/recetas/intermedio/${id}`, 'DELETE')) recargar();
  }

  return (
    <div className="space-y-3">
      {accionesEncabezado &&
        tienePermiso('receta.crear') &&
        createPortal(
          <Link
            to="/panel/recetas/intermedio/nuevo"
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover max-sm:w-full sm:min-h-9"
          >
            Nueva preparación
          </Link>,
          accionesEncabezado,
        )}
      <p className="text-sm text-meta">
        Preparaciones que se usan en otras recetas, como una salsa base. Si llevan stock, se
        producen por tandas en Producción.
      </p>
      <Aviso>{baja.error}</Aviso>
      <EstadoCarga cargando={cargando && !datos} error={error} />
      {datos && (
        <Lista
          filas={datos.intermedios}
          clave={(i) => i.id}
          inactiva={(i) => !i.activo}
          vacio="Todavía no hay preparaciones."
          columnas={[
            {
              titulo: 'Preparación',
              valor: (i) => (
                <span>
                  {i.nombre} {!i.activo && <Etiqueta>Dado de baja</Etiqueta>}
                </span>
              ),
            },
            { titulo: 'Unidad', valor: (i) => NOMBRE_UNIDAD[i.unidadBase] },
            {
              titulo: 'Costo',
              valor: (i) => textoCosto(i.costoUnitario, i.unidadBase),
              className: 'tabular-nums',
            },
          ]}
          acciones={(i) => (
            <span className="inline-flex flex-wrap justify-end gap-x-6 gap-y-2">
              <Link to={`/panel/recetas/intermedio/${i.id}`} className={claseLink}>
                Ver receta
              </Link>
              {tienePermiso('receta.eliminar') && i.activo && (
                <button
                  type="button"
                  onClick={() => darDeBaja(i.id, i.nombre)}
                  className="rounded-control border border-bad/30 bg-surface px-3 py-2 text-sm font-medium text-bad hover:bg-bad-soft"
                >
                  Dar de baja
                </button>
              )}
            </span>
          )}
        />
      )}
    </div>
  );
}
