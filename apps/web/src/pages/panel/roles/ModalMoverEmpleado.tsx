import { useState } from 'react';
import { gestionaRoles, type EmpleadoDeRol, type Rol } from '@pgim/shared';
import { useSesion } from '../../../auth/SesionProvider';
import { Aviso, Boton, Campo, Modal, claseInput } from '../../../components/ui';
import { useGuardar } from '../../../lib/useGuardar';

// Cada empleado tiene un rol: "quitar" el rol es pasarlo a otro.
export function ModalMoverEmpleado({
  empleado,
  rolesDestino,
  onCerrar,
  onMovido,
}: {
  empleado: EmpleadoDeRol;
  // Solo roles activos, sin el actual.
  rolesDestino: Rol[];
  onCerrar(): void;
  onMovido(): void | Promise<void>;
}) {
  const { sesion } = useSesion();
  const guardar = useGuardar();
  const [destinoId, setDestinoId] = useState('');
  const destino = rolesDestino.find((r) => r.id === destinoId);
  const esUnoMismo = sesion?.usuario.id === empleado.id;
  const perderiaAcceso = esUnoMismo && destino !== undefined && !gestionaRoles(destino.permisos);

  async function confirmar() {
    const respuesta = await guardar.enviar(`/roles/${destinoId}/empleados`, 'PUT', {
      empleadoIds: [empleado.id],
    });
    if (!respuesta) return;
    await onMovido();
    onCerrar();
  }

  return (
    <Modal titulo={`Quitar el rol a ${empleado.nombreCompleto}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm text-text">
          Cada empleado tiene un rol. Elegí a qué rol pasa {empleado.nombreCompleto}.
        </p>
        <Campo etiqueta="Nuevo rol">
          <select
            value={destinoId}
            onChange={(e) => setDestinoId(e.target.value)}
            className={claseInput}
          >
            <option value="">Elegí un rol</option>
            {rolesDestino.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </Campo>
        {perderiaAcceso && (
          <Aviso>Ese rol no permite gestionar roles: perderías el acceso a esta pantalla.</Aviso>
        )}
        <Aviso>{guardar.error}</Aviso>
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={() => void confirmar()} disabled={!destinoId || guardar.enviando}>
            Pasar a este rol
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
