import { ARQUETIPOS } from '@pgim/shared';
import { Campo, Casilla, claseInput } from '../../../components/ui';
import { NOMBRE_ARQUETIPO } from '../../../lib/catalogo-permisos';
import type { BorradorRol } from './useBorradorRol';

export function PestanaGeneral({
  borrador,
  onCambiar,
}: {
  borrador: BorradorRol;
  onCambiar(parcial: Partial<BorradorRol>): void;
}) {
  return (
    <div className="max-w-xl space-y-5 rounded-panel border border-line bg-surface p-5">
      <Campo etiqueta="Nombre">
        <input
          className={claseInput}
          value={borrador.nombre}
          maxLength={100}
          onChange={(e) => onCambiar({ nombre: e.target.value })}
        />
      </Campo>
      <Campo etiqueta="Tipo de puesto" ayuda="Lo usa el optimizador de turnos">
        <select
          className={claseInput}
          value={borrador.arquetipo}
          onChange={(e) => onCambiar({ arquetipo: e.target.value as BorradorRol['arquetipo'] })}
        >
          {ARQUETIPOS.map((a) => (
            <option key={a} value={a}>
              {NOMBRE_ARQUETIPO[a]}
            </option>
          ))}
        </select>
      </Campo>
      <div className="space-y-1">
        <Casilla
          etiqueta="Rol activo"
          checked={borrador.activo}
          onChange={(activo) => onCambiar({ activo })}
        />
        <p className="text-xs text-meta">
          Un rol desactivado no se puede asignar. Para desactivarlo no tiene que tener empleados.
        </p>
      </div>
    </div>
  );
}
