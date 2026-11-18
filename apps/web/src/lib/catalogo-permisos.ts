import type { Arquetipo, CodigoPermiso, Rol } from '@pgim/shared';

// Cómo se muestran los permisos en pantalla: nombre y descripción en lenguaje
// simple, agrupados por tema. Los códigos (rol.ver…) nunca se muestran.

export const GRUPOS = [
  'Personal',
  'Reservas',
  'Pedidos de salón',
  'Facturación',
  'Inventario y recetas',
  'Simulador de apertura',
  'Menú con realidad aumentada',
  'Sucursales',
  'Fidelización',
] as const;

export type GrupoPermiso = (typeof GRUPOS)[number];

export interface InfoPermiso {
  nombre: string;
  descripcion: string;
  grupo: GrupoPermiso;
  // Permiso delicado: la pantalla de edición lo marca con un aviso.
  sensible?: true;
}

export const CATALOGO_PERMISOS = {
  'personal.ver': {
    nombre: 'Ver el personal',
    descripcion: 'Permite ver la lista de empleados y sus datos.',
    grupo: 'Personal',
  },
  'personal.crear': {
    nombre: 'Dar de alta empleados',
    descripcion: 'Permite sumar empleados nuevos al restaurante.',
    grupo: 'Personal',
  },
  'personal.editar': {
    nombre: 'Editar empleados',
    descripcion: 'Permite cambiar los datos, el rol y las sucursales de un empleado.',
    grupo: 'Personal',
    sensible: true,
  },
  'personal.eliminar': {
    nombre: 'Dar de baja empleados',
    descripcion: 'Permite dar de baja a un empleado para que deje de usar el sistema.',
    grupo: 'Personal',
    sensible: true,
  },
  'turno.ver': {
    nombre: 'Ver turnos',
    descripcion: 'Permite ver los turnos asignados.',
    grupo: 'Personal',
  },
  'turno.planificar': {
    nombre: 'Planificar turnos',
    descripcion: 'Permite armar y publicar la planificación de turnos del personal.',
    grupo: 'Personal',
  },
  'rol.ver': {
    nombre: 'Ver roles',
    descripcion: 'Permite ver los roles y lo que habilita cada uno.',
    grupo: 'Personal',
  },
  'rol.crear': {
    nombre: 'Crear roles',
    descripcion: 'Permite crear roles nuevos y duplicar los existentes.',
    grupo: 'Personal',
  },
  'rol.editar': {
    nombre: 'Gestionar roles',
    descripcion: 'Permite cambiar los permisos de los roles y asignarlos a empleados.',
    grupo: 'Personal',
    sensible: true,
  },
  'rol.eliminar': {
    nombre: 'Dar de baja roles',
    descripcion: 'Permite desactivar o eliminar roles.',
    grupo: 'Personal',
    sensible: true,
  },
  'reserva.ver': {
    nombre: 'Ver reservas',
    descripcion: 'Permite ver las reservas y el estado del salón.',
    grupo: 'Reservas',
  },
  'reserva.activar': {
    nombre: 'Activar reservas',
    descripcion: 'Permite activar la reserva de quien llega y marcar la inasistencia.',
    grupo: 'Reservas',
  },
  'pedido.ver': {
    nombre: 'Ver pedidos',
    descripcion: 'Permite ver los pedidos del salón y de la cocina.',
    grupo: 'Pedidos de salón',
  },
  'pedido.gestionar_cola': {
    nombre: 'Gestionar la cola de pedidos',
    descripcion: 'Permite ordenar y cancelar los pedidos de la cocina.',
    grupo: 'Pedidos de salón',
  },
  'pedido.avanzar': {
    nombre: 'Entregar pedidos',
    descripcion: 'Permite marcar los pedidos como listos y entregados.',
    grupo: 'Pedidos de salón',
  },
  'mesa.cerrar': {
    nombre: 'Cerrar mesas',
    descripcion: 'Permite cerrar la cuenta de una mesa y liberarla.',
    grupo: 'Pedidos de salón',
    sensible: true,
  },
  'pago.ver': {
    nombre: 'Ver pagos',
    descripcion: 'Permite ver los pagos y la facturación del día.',
    grupo: 'Facturación',
  },
  'metrica.ver': {
    nombre: 'Ver métricas',
    descripcion: 'Permite ver las métricas de ventas y de funcionamiento del restaurante.',
    grupo: 'Facturación',
  },
  'insumo.ver': {
    nombre: 'Ver insumos',
    descripcion: 'Permite ver los insumos y su stock.',
    grupo: 'Inventario y recetas',
  },
  'insumo.crear': {
    nombre: 'Crear insumos',
    descripcion: 'Permite dar de alta insumos nuevos.',
    grupo: 'Inventario y recetas',
  },
  'insumo.editar': {
    nombre: 'Editar insumos',
    descripcion: 'Permite cambiar los datos de los insumos.',
    grupo: 'Inventario y recetas',
  },
  'insumo.eliminar': {
    nombre: 'Dar de baja insumos',
    descripcion: 'Permite dar de baja insumos que ya no se usan.',
    grupo: 'Inventario y recetas',
  },
  'receta.ver': {
    nombre: 'Ver recetas',
    descripcion: 'Permite ver las recetas de los platos.',
    grupo: 'Inventario y recetas',
  },
  'receta.crear': {
    nombre: 'Crear recetas',
    descripcion: 'Permite armar recetas nuevas.',
    grupo: 'Inventario y recetas',
  },
  'receta.editar': {
    nombre: 'Editar recetas',
    descripcion: 'Permite cambiar los ingredientes y cantidades de las recetas.',
    grupo: 'Inventario y recetas',
  },
  'receta.eliminar': {
    nombre: 'Dar de baja recetas',
    descripcion: 'Permite dar de baja recetas que ya no se usan.',
    grupo: 'Inventario y recetas',
  },
  'stock.registrar': {
    nombre: 'Registrar movimientos de stock',
    descripcion: 'Permite cargar compras, ajustes y mermas, que cambian el stock.',
    grupo: 'Inventario y recetas',
    sensible: true,
  },
  'apertura.consultar': {
    nombre: 'Consultar el simulador de apertura',
    descripcion: 'Permite ver la demanda proyectada y las alertas de stock, personal y mesas.',
    grupo: 'Simulador de apertura',
  },
  'menu.ver': {
    nombre: 'Ver el menú',
    descripcion: 'Permite ver los menús, los platos y sus modelos de realidad aumentada.',
    grupo: 'Menú con realidad aumentada',
  },
  'menu.crear': {
    nombre: 'Crear platos y menús',
    descripcion: 'Permite sumar platos y menús nuevos.',
    grupo: 'Menú con realidad aumentada',
  },
  'menu.editar': {
    nombre: 'Editar platos y menús',
    descripcion: 'Permite cambiar platos, precios, fotos y modelos de realidad aumentada.',
    grupo: 'Menú con realidad aumentada',
  },
  'menu.eliminar': {
    nombre: 'Dar de baja platos y menús',
    descripcion: 'Permite sacar platos y menús de la carta.',
    grupo: 'Menú con realidad aumentada',
  },
  'sucursal.ver': {
    nombre: 'Ver sucursales',
    descripcion: 'Permite ver las sucursales y sus datos.',
    grupo: 'Sucursales',
  },
  'sucursal.crear': {
    nombre: 'Crear sucursales',
    descripcion: 'Permite abrir sucursales nuevas en el sistema.',
    grupo: 'Sucursales',
  },
  'sucursal.editar': {
    nombre: 'Editar sucursales',
    descripcion: 'Permite cambiar los datos, el horario y las mesas de una sucursal.',
    grupo: 'Sucursales',
  },
  'sucursal.eliminar': {
    nombre: 'Dar de baja sucursales',
    descripcion: 'Permite dar de baja una sucursal.',
    grupo: 'Sucursales',
    sensible: true,
  },
  'beneficio.ver': {
    nombre: 'Ver beneficios',
    descripcion: 'Permite ver los beneficios y el programa de puntos.',
    grupo: 'Fidelización',
  },
  'beneficio.crear': {
    nombre: 'Crear beneficios',
    descripcion: 'Permite sumar beneficios nuevos al programa de puntos.',
    grupo: 'Fidelización',
  },
  'beneficio.editar': {
    nombre: 'Editar beneficios',
    descripcion: 'Permite cambiar los beneficios y las reglas de puntos.',
    grupo: 'Fidelización',
  },
  'beneficio.eliminar': {
    nombre: 'Dar de baja beneficios',
    descripcion: 'Permite dar de baja beneficios del programa de puntos.',
    grupo: 'Fidelización',
  },
} as const satisfies Record<CodigoPermiso, InfoPermiso>;

export function infoPermiso(codigo: CodigoPermiso): InfoPermiso {
  return CATALOGO_PERMISOS[codigo];
}

export interface GrupoDePermisos {
  nombre: GrupoPermiso;
  permisos: CodigoPermiso[];
}

// Grupos en el orden de GRUPOS, con sus permisos en el orden del catálogo.
export const GRUPOS_PERMISOS: readonly GrupoDePermisos[] = GRUPOS.map((nombre) => ({
  nombre,
  permisos: (Object.keys(CATALOGO_PERMISOS) as CodigoPermiso[]).filter(
    (codigo) => CATALOGO_PERMISOS[codigo].grupo === nombre,
  ),
}));

export const NOMBRE_ARQUETIPO: Record<Arquetipo, string> = {
  MOZO: 'Mozo',
  COCINERO: 'Cocinero',
  OTRO: 'Otro',
};

// Clase del punto de color del rol (tokens --color-rol-* de index.css).
export function colorArquetipo(arquetipo: Arquetipo): string {
  return {
    MOZO: 'bg-rol-mozo',
    COCINERO: 'bg-rol-cocinero',
    OTRO: 'bg-rol-otro',
  }[arquetipo];
}

// "Tipo de puesto: Mozo · 8 permisos"
export function descripcionRol(rol: Pick<Rol, 'arquetipo' | 'permisos'>): string {
  const n = rol.permisos.length;
  return `Tipo de puesto: ${NOMBRE_ARQUETIPO[rol.arquetipo]} · ${n} ${n === 1 ? 'permiso' : 'permisos'}`;
}
