import { useState } from 'react';
import { Search } from 'lucide-react';
import type { EmpleadoDeRol, Rol } from '@pgim/shared';
import { Aviso, Boton, Casilla, Modal, claseInput } from '../../../components/ui';
import { useGuardar } from '../../../lib/useGuardar';

function sinAcentos(texto: string) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function ModalAgregarEmpleados({
  rol,
  candidatos,
  onCerrar,
  onAgregados,
}: {
  rol: Rol;
  // Empleados que hoy tienen otro rol.
  candidatos: EmpleadoDeRol[];
  onCerrar(): void;
  onAgregados(): void | Promise<void>;
}) {
  const guardar = useGuardar();
  const [busqueda, setBusqueda] = useState('');
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());

  const filtro = sinAcentos(busqueda.trim());
  const visibles = candidatos.filter((e) => sinAcentos(e.nombreCompleto).includes(filtro));

  function alternar(id: string, marcado: boolean) {
    setElegidos((previos) => {
      const nuevos = new Set(previos);
      if (marcado) nuevos.add(id);
      else nuevos.delete(id);
      return nuevos;
    });
  }

  async function agregar() {
    const respuesta = await guardar.enviar(`/roles/${rol.id}/empleados`, 'PUT', {
      empleadoIds: [...elegidos],
    });
    if (!respuesta) return;
    await onAgregados();
    onCerrar();
  }

  return (
    <Modal titulo="Agregar empleados" onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm text-text">
          Los empleados seleccionados pasan a tener el rol {rol.nombre} y dejan su rol anterior.
        </p>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-meta"
          />
          <input
            type="search"
            aria-label="Buscar por nombre"
            placeholder="Buscar por nombre"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={`${claseInput} pl-10`}
          />
        </div>
        <div className="max-h-72 overflow-y-auto rounded-panel border border-line">
          {visibles.length === 0 ? (
            <p className="px-4 py-5 text-sm text-meta">
              {candidatos.length === 0
                ? 'Todos los empleados ya tienen este rol.'
                : 'No hay empleados que coincidan con la búsqueda.'}
            </p>
          ) : (
            <ul>
              {visibles.map((e) => (
                <li key={e.id} className="border-b border-line px-4 py-2 last:border-b-0">
                  <Casilla
                    etiqueta={e.nombreCompleto}
                    checked={elegidos.has(e.id)}
                    onChange={(v) => alternar(e.id, v)}
                  />
                  <p className="pl-6 text-xs text-meta">
                    Rol actual: {e.rol.nombre}
                    {e.sucursales.length > 0 &&
                      ` · ${e.sucursales.map((s) => s.nombre).join(', ')}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Aviso>{guardar.error}</Aviso>
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={() => void agregar()} disabled={elegidos.size === 0 || guardar.enviando}>
            {elegidos.size > 0 ? `Agregar (${elegidos.size})` : 'Agregar'}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
