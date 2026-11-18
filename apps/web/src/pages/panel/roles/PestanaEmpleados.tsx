import type { Rol } from '@pgim/shared';

export interface PropsPestanaEmpleados {
  rol: Rol;
  // Todos los roles, para elegir a cuál pasa un empleado.
  roles: Rol[];
  // Recarga la lista de roles (contadores) y la sesión; la pestaña lo llama tras cada cambio.
  onCambio(): void | Promise<void>;
}

// Provisorio: la pestaña Empleados se completa en la tarea 4.
export function PestanaEmpleados({ rol }: PropsPestanaEmpleados) {
  return (
    <p className="text-sm text-meta">
      Empleados con el rol {rol.nombre}: {rol.cantidadEmpleados}.
    </p>
  );
}
