// Funciones comunes de las seeds (seed.ts y seed-deploy.ts). Este archivo no corre
// nada al importarse: lo que cambia entre una seed y otra llega por parámetro.
import {
  PERMISOS,
  type CodigoPermiso,
  type RolPredeterminado,
  type Franja,
  type UnidadBase,
  type UnidadMedida,
} from '@pgim/shared';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CARPETA_MODELOS, borrarModelo, guardarModelo } from '../src/lib/archivos-modelo';
import { prisma } from '../src/lib/prisma';
import { aHora } from '../src/lib/hora';
import { generarReservasHistorial, SEMILLA_HISTORIAL } from '../src/lib/historial-ventas';
import type { Prisma } from '../src/generated/prisma/client';
import {
  costoTeorico,
  costoUnitario,
  insumosNecesarios,
  type Componente,
} from '../src/domain/receta';
import { iniciosDelDia, sumarDias } from '../src/domain/franjas';
import { semanaSiguiente } from '../src/domain/pronostico';
import { produccionService } from '../src/services/produccion.service';
import { recetaRepository } from '../src/repositories/receta.repository';
import { stockRepository } from '../src/repositories/stock.repository';

// Nombre de sucursal -> id.
export type NombreSucursal = string;

// Salón de cada sucursal (CU-14): capacidades en orden de número de mesa,
// ubicadas en una grilla sobre el lienzo de 100 × 60.
export interface SalonSeed {
  capacidades: number[];
  columnas: number;
  x0: number;
  pasoX: number;
}

// Las columnas time se guardan como DateTime; Prisma ignora la fecha.
export function hora(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

export type LineaSeed = [
  componente: string,
  cantidad: number,
  unidad: UnidadMedida,
  merma?: number,
];

export interface InsumoSeed {
  nombre: string;
  unidadBase: UnidadBase;
  costo: number;
  stock: number;
}

export interface MenuSeed {
  nombre: string;
  descripcion: string;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
}

export interface ModeloRaSeed {
  plato: string;
  archivo: string;
  porcionGramos: number;
}

export interface RecetaSeed {
  rendimiento: number;
  instrucciones: string;
  lineas: LineaSeed[];
}

// Roles de staff que crearía el Administrador; solo existen en el seed.
export const ROLES_STAFF: RolPredeterminado[] = [
  {
    nombre: 'Mozo',
    arquetipo: 'MOZO',
    permisos: [
      'reserva.ver',
      'reserva.activar',
      'mesa.cerrar',
      'pedido.ver',
      'pedido.avanzar',
      'pago.ver',
      'menu.ver',
      'turno.ver',
    ],
  },
  {
    nombre: 'Cocinero',
    arquetipo: 'COCINERO',
    permisos: ['stock.registrar', 'pedido.ver', 'pedido.gestionar_cola', 'turno.ver'],
  },
];

export const redondearCosto = (valor: number) => Math.round(valor * 10000) / 10000;
export const haceDias = (dias: number, hora = 11) => {
  const f = new Date();
  f.setDate(f.getDate() - dias);
  f.setHours(hora, 0, 0, 0);
  return f;
};

export async function seedPermisos(
  tx: Prisma.TransactionClient,
): Promise<Map<CodigoPermiso, string>> {
  const ids = new Map<CodigoPermiso, string>();
  for (const { codigo, modulo, accion } of PERMISOS) {
    const permiso = await tx.permiso.upsert({
      where: { codigo },
      update: { modulo, accion },
      create: { codigo, modulo, accion },
    });
    ids.set(codigo, permiso.id);
  }
  return ids;
}

export async function seedSalon(
  tx: Prisma.TransactionClient,
  sucursalId: string,
  { capacidades, columnas, x0, pasoX }: SalonSeed,
): Promise<void> {
  for (const [i, capacidad] of capacidades.entries()) {
    const numero = i + 1;
    const posicion = {
      capacidad,
      posX: x0 + (i % columnas) * pasoX,
      posY: 15 + Math.floor(i / columnas) * 30,
      activa: true,
    };
    await tx.mesa.upsert({
      where: { sucursalId_numero: { sucursalId, numero } },
      update: posicion,
      create: { sucursalId, numero, ...posicion },
    });
  }
}

// Reemplaza la receta del dueño (plato o intermedio) por la del seed.
export async function seedReceta(
  tx: Prisma.TransactionClient,
  dueno: { itemMenuId: string } | { productoIntermedioId: string },
  receta: RecetaSeed,
  componentes: Map<string, string>,
): Promise<void> {
  const datos = { rendimiento: receta.rendimiento, instrucciones: receta.instrucciones };
  const { id } = await tx.receta.upsert({
    where: dueno,
    update: datos,
    create: { ...dueno, ...datos },
  });
  await tx.lineaReceta.deleteMany({ where: { recetaId: id } });
  await tx.lineaReceta.createMany({
    data: receta.lineas.map(([componente, cantidad, unidad, merma = 0]) => ({
      recetaId: id,
      componenteId: componentes.get(componente)!,
      cantidad,
      unidad,
      porcentajeMerma: merma,
    })),
  });
}

export async function seedComponente(
  tx: Prisma.TransactionClient,
  restauranteId: string,
  datos: {
    nombre: string;
    tipo: 'INSUMO' | 'INTERMEDIO';
    unidadBase: UnidadBase;
    costoCompraVigente: number | null;
    llevaStock?: boolean;
  },
): Promise<string> {
  const existente = await tx.componenteInventario.findFirst({
    where: { restauranteId, nombre: datos.nombre },
  });
  // El costo vigente lo mueven los ingresos y las tandas: al volver a correr
  // el seed no se pisa.
  const { costoCompraVigente: _costo, ...sinCosto } = datos;
  const componente = existente
    ? await tx.componenteInventario.update({
        where: { id: existente.id },
        data: { ...sinCosto, activo: true },
      })
    : await tx.componenteInventario.create({ data: { restauranteId, ...datos } });
  return componente.id;
}

// Costo teórico por unidad base de una receta del seed, con los costos de compra del
// catálogo de insumos que recibe: es el costo vigente inicial de un intermedio que lleva stock.
export function costoTeoricoDeSeed(
  nombre: string,
  unidadBase: UnidadBase,
  receta: RecetaSeed,
  insumos: InsumoSeed[],
): number {
  const insumo = (n: string): Componente => {
    const datos = insumos.find((i) => i.nombre === n)!;
    return {
      id: n,
      nombre: n,
      tipo: 'INSUMO',
      unidadBase: datos.unidadBase,
      activo: true,
      costoCompraVigente: datos.costo,
      llevaStock: false,
      receta: null,
    };
  };
  return costoTeorico({
    id: nombre,
    nombre,
    tipo: 'INTERMEDIO',
    unidadBase,
    activo: true,
    costoCompraVigente: null,
    llevaStock: true,
    receta: {
      rendimiento: receta.rendimiento,
      instrucciones: receta.instrucciones,
      lineas: receta.lineas.map(([componente, cantidad, unidad, merma = 0]) => ({
        componente: insumo(componente),
        cantidad,
        unidad,
        porcentajeMerma: merma,
      })),
    },
  });
}

export async function seedMenus(
  tx: Prisma.TransactionClient,
  restauranteId: string,
  platoIds: string[],
  menus: readonly MenuSeed[],
): Promise<string> {
  const ids: string[] = [];
  for (const menu of menus) {
    const datos = {
      descripcion: menu.descripcion,
      vigenciaDesde: new Date(`${menu.vigenciaDesde}T00:00:00.000Z`),
      vigenciaHasta: menu.vigenciaHasta && new Date(`${menu.vigenciaHasta}T00:00:00.000Z`),
    };
    const existente = await tx.menu.findFirst({ where: { restauranteId, nombre: menu.nombre } });
    const fila = existente
      ? await tx.menu.update({ where: { id: existente.id }, data: datos })
      : await tx.menu.create({ data: { restauranteId, nombre: menu.nombre, ...datos } });
    await tx.menuItem.deleteMany({ where: { menuId: fila.id } });
    await tx.menuItem.createMany({
      data: platoIds.map((itemMenuId) => ({ menuId: fila.id, itemMenuId })),
    });
    ids.push(fila.id);
  }
  return ids[0]!;
}

// Programa de puntos ($1 = 0,01 punto) y un beneficio de cada tipo, vigentes
// por 60 días desde que corre el seed. Si un beneficio ya existe, no se toca:
// así un seed repetido no repone su stock ni le cambia la vigencia.
export async function seedFidelizacion(
  tx: Prisma.TransactionClient,
  restauranteId: string,
  cartaId: string,
): Promise<void> {
  await tx.programaFidelidad.upsert({
    where: { restauranteId },
    update: {},
    create: { restauranteId, puntosPorUnidad: 0.01 },
  });
  const grupo =
    (await tx.grupoBeneficios.findFirst({ where: { restauranteId, nombre: 'Bienvenida' } })) ??
    (await tx.grupoBeneficios.create({ data: { restauranteId, nombre: 'Bienvenida' } }));

  const vigenciaDesde = new Date();
  const vigenciaHasta = new Date(vigenciaDesde.getTime() + 60 * 24 * 60 * 60 * 1000);
  const beneficios = [
    {
      nombre: '2x1 de los martes',
      clase: 'PROMOCION',
      menuId: cartaId,
      tipoDescuento: 'PORCENTAJE',
      valor: 50,
      stockInicial: 20,
      stockDisponible: 20,
    },
    {
      nombre: 'Postre de regalo',
      clase: 'RECOMPENSA',
      criterioTipo: 'VISITAS',
      criterioValor: 3,
      tipoDescuento: 'MONTO_FIJO',
      valor: 3000,
    },
    {
      nombre: 'Canje de 500 puntos',
      clase: 'RECOMPENSA',
      criterioTipo: 'PUNTOS',
      criterioValor: 500,
      tipoDescuento: 'PORCENTAJE',
      valor: 15,
    },
    {
      nombre: 'Bienvenida',
      clase: 'RECOMPENSA',
      criterioTipo: 'NUEVO_CLIENTE',
      criterioValor: 1, // el DER lo exige en toda recompensa; este criterio no lo usa
      tipoDescuento: 'PORCENTAJE',
      valor: 10,
      grupoId: grupo.id,
    },
  ] as const satisfies Omit<
    Prisma.BeneficioUncheckedCreateInput,
    'restauranteId' | 'vigenciaDesde' | 'vigenciaHasta'
  >[];
  for (const beneficio of beneficios) {
    const existe = await tx.beneficio.findFirst({
      where: { restauranteId, nombre: beneficio.nombre },
    });
    if (!existe) {
      await tx.beneficio.create({
        data: { ...beneficio, restauranteId, vigenciaDesde, vigenciaHasta },
      });
    }
  }
}

// Fuera de la transacción porque escribe archivos. Si el plato ya tiene su
// modelo y el archivo existe, lo deja como está.
export async function seedModelosRa(
  restauranteId: string,
  modelos: readonly ModeloRaSeed[],
): Promise<void> {
  for (const modelo of modelos) {
    const plato = await prisma.itemMenu.findFirstOrThrow({
      where: { restauranteId, nombre: modelo.plato },
      include: { modeloRa: true },
    });
    const actual = plato.modeloRa?.urlModelo;
    if (actual && existsSync(path.join(CARPETA_MODELOS, path.basename(actual)))) continue;

    const archivo = await readFile(path.join(__dirname, 'modelos-demo', modelo.archivo));
    const datos = {
      urlModelo: await guardarModelo(archivo, 'glb'),
      urlModeloIos: null,
      escalaReal: 1,
      porcionGramos: modelo.porcionGramos,
    };
    await prisma.modeloRA.upsert({
      where: { itemMenuId: plato.id },
      update: datos,
      create: { itemMenuId: plato.id, ...datos },
    });
    await borrarModelo(actual);
  }
}

// Tandas, ingresos, mermas y un conteo de la demo, con fechas de los últimos 7
// días. Va fuera de la transacción del seed porque usa el servicio y el
// repositorio reales (cada uno abre la suya), y las filas que necesita ya
// están confirmadas. Si la salsa ya tiene tandas en la sucursal, no se vuelve
// a cargar nada. cocinaDe da el email del empleado de cocina de cada sucursal.
export async function seedProduccionDemo(
  restauranteId: string,
  sucursalIds: Map<NombreSucursal, string>,
  cocinaDe: Record<NombreSucursal, string>,
): Promise<void> {
  const filas = await prisma.componenteInventario.findMany({
    where: {
      restauranteId,
      nombre: { in: ['Salsa criolla', 'Tomate', 'Papa', 'Huevo', 'Cebolla'] },
    },
    select: { id: true, nombre: true },
  });
  const id = (nombre: string) => filas.find((f) => f.nombre === nombre)!.id;
  const salsaId = id('Salsa criolla');

  // El repositorio estampa la hora actual: se corrige con la fecha de la demo.
  const fecharUltimoMovimiento = async (sucursalId: string, componenteId: string, fecha: Date) => {
    const mov = await prisma.movimientoStock.findFirstOrThrow({
      where: { existencia: { sucursalId, componenteId } },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    await prisma.movimientoStock.update({ where: { id: mov.id }, data: { fecha } });
  };

  for (const [nombreSucursal, sucursalId] of sucursalIds) {
    const yaCargada = await prisma.tandaProduccion.count({
      where: { sucursalId, intermedioId: salsaId },
    });
    if (yaCargada > 0) continue;

    const empleado = await prisma.usuario.findUniqueOrThrow({
      where: { email: cocinaDe[nombreSucursal] },
    });
    const ctx = { restauranteId, sucursalId, empleadoId: empleado.id };

    // Dos compras de tomate a precio creciente: la segunda deja el costo vigente.
    for (const [dias, costo] of [
      [6, 2.7],
      [2, 3.1],
    ] as const) {
      await stockRepository.registrarMovimiento(ctx, {
        tipo: 'INGRESO',
        componenteId: id('Tomate'),
        cantidad: 2000,
        costoUnitario: costo,
        observacion: null,
      });
      await fecharUltimoMovimiento(sucursalId, id('Tomate'), haceDias(dias, 9));
    }

    // Tres tandas de 2 kg: dos normales y una que rinde menos con 10 % más de tomate.
    const tandas = [
      { dias: 6, obtenida: 1980, extraTomate: 1, observacion: undefined },
      { dias: 4, obtenida: 2000, extraTomate: 1, observacion: undefined },
      { dias: 2, obtenida: 1640, extraTomate: 1.1, observacion: 'Se pasó de cocción' },
    ];
    for (const t of tandas) {
      const catalogo = await recetaRepository.cargarCatalogo(restauranteId);
      const salsa = catalogo.get(salsaId)!;
      const teoricas = insumosNecesarios(salsa.receta!, 2000);
      const tanda = await produccionService.registrar(ctx, {
        intermedioId: salsaId,
        cantidadPlaneada: 2000,
        unidad: 'GRAMO',
        cantidadObtenida: t.obtenida,
        consumos: [...teoricas].map(([componenteId, teorica]) => ({
          componenteId,
          cantidad: teorica * (componenteId === id('Tomate') ? t.extraTomate : 1),
          // Los consumos van en la unidad base de cada componente.
          unidad: catalogo.get(componenteId)!.unidadBase,
        })),
        observacion: t.observacion,
      });
      await prisma.tandaProduccion.update({
        where: { id: tanda.id },
        data: { fecha: haceDias(t.dias) },
      });
      await prisma.movimientoStock.updateMany({
        where: { tandaId: tanda.id },
        data: { fecha: haceDias(t.dias) },
      });
    }

    // Mermas con motivos distintos; el costo es el vigente de cada componente.
    const catalogo = await recetaRepository.cargarCatalogo(restauranteId);
    const costoDe = (nombre: string) => redondearCosto(costoUnitario(catalogo.get(id(nombre))!));
    const mermas = [
      { nombre: 'Salsa criolla', cantidad: 150, motivoMerma: 'VENCIMIENTO', dias: 1 },
      { nombre: 'Papa', cantidad: 800, motivoMerma: 'DETERIORO', dias: 3 },
      { nombre: 'Huevo', cantidad: 6, motivoMerma: 'ERROR', dias: 5 },
      { nombre: 'Tomate', cantidad: 300, motivoMerma: 'PREPARACION', dias: 4 },
    ] as const;
    for (const m of mermas) {
      await stockRepository.registrarMovimiento(ctx, {
        tipo: 'MERMA',
        componenteId: id(m.nombre),
        cantidad: m.cantidad,
        costoUnitario: costoDe(m.nombre),
        motivoMerma: m.motivoMerma,
        observacion: null,
      });
      await fecharUltimoMovimiento(sucursalId, id(m.nombre), haceDias(m.dias, 17));
    }

    // Conteo de cebolla 250 g por debajo de lo que dice el sistema.
    const cebolla = await prisma.existencia.findUniqueOrThrow({
      where: { sucursalId_componenteId: { sucursalId, componenteId: id('Cebolla') } },
    });
    await stockRepository.registrarMovimiento(ctx, {
      tipo: 'AJUSTE',
      componenteId: id('Cebolla'),
      cantidadContada: Number(cebolla.cantidadActual) - 250,
      costoUnitario: costoDe('Cebolla'),
      motivo: 'Conteo de cierre',
    });
    await fecharUltimoMovimiento(sucursalId, id('Cebolla'), haceDias(1, 23));
  }
}

// Historial de ventas para el pronóstico (Hito 6B). Termina ayer. Va fuera de la
// transacción de main() por el volumen. Se identifica por 20 comensales
// ficticios dedicados: se borra todo lo suyo y se vuelve a generar. No crea
// visitas, puntos, movimientos de stock ni comprobantes. Las semanas de cada
// sucursal y el prefijo del email de los comensales llegan por parámetro.
const CANTIDAD_COMENSALES_HISTORIAL = 20;
const LOTE = 2000;

export async function insertarPorLotes<T>(filas: T[], insertar: (lote: T[]) => Promise<unknown>) {
  for (let i = 0; i < filas.length; i += LOTE) await insertar(filas.slice(i, i + LOTE));
}

export async function seedHistorialVentas(
  restauranteId: string,
  sucursalIds: Map<NombreSucursal, string>,
  passwordHash: string,
  semanasHistorial: Record<NombreSucursal, number>,
  prefijoEmail = 'historial',
): Promise<number> {
  const emails = Array.from(
    { length: CANTIDAD_COMENSALES_HISTORIAL },
    (_, i) => `${prefijoEmail}-${String(i + 1).padStart(2, '0')}@demo.test`,
  );
  const comensalIds: string[] = [];
  for (const [i, email] of emails.entries()) {
    // Inactivos: no son para iniciar sesión.
    const usuario = await prisma.usuario.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, tipo: 'COMENSAL', activo: false },
    });
    await prisma.comensal.upsert({
      where: { usuarioId: usuario.id },
      update: {},
      create: { usuarioId: usuario.id, nombre: `Comensal de historial ${i + 1}` },
    });
    comensalIds.push(usuario.id);
  }

  const deHistorial = { in: comensalIds };
  await prisma.$transaction(async (tx) => {
    const cuenta = { reserva: { comensalId: deHistorial } };
    await tx.pago.deleteMany({ where: { comensalId: deHistorial } });
    await tx.lineaPedido.deleteMany({ where: { pedido: { cuentaMesa: cuenta } } });
    await tx.pedido.deleteMany({ where: { cuentaMesa: cuenta } });
    await tx.cuentaMesa.deleteMany({ where: cuenta });
    await tx.reserva.deleteMany({ where: { comensalId: deHistorial } });
  });

  const hoy = new Date();
  let total = 0;
  for (const [indice, [nombre, sucursalId]] of [...sucursalIds].entries()) {
    // Lecturas con orden fijo: alimentan al generador pseudoaleatorio y el
    // historial tiene que salir igual en cada corrida.
    const mesas = await prisma.mesa.findMany({
      where: { sucursalId, sucursal: { restauranteId }, activa: true },
      select: { id: true, numero: true, capacidad: true },
      orderBy: { numero: 'asc' },
    });
    const horarios = await prisma.horarioServicio.findMany({
      where: { sucursalId, sucursal: { restauranteId } },
      orderBy: { horaInicio: 'asc' },
    });
    // Platos activos del menú activo de la sucursal (misma condición que el
    // historial que lee el pronóstico).
    const platos = (
      await prisma.itemMenu.findMany({
        where: {
          restauranteId,
          activo: true,
          menus: {
            some: { menu: { sucursalesActivas: { some: { id: sucursalId, restauranteId } } } },
          },
        },
        select: { id: true, precio: true },
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      })
    ).map((p) => ({ id: p.id, precio: Number(p.precio) }));
    const ultimo = await prisma.pedido.aggregate({
      where: { sucursalId },
      _max: { numero: true },
    });
    const reservas = generarReservasHistorial({
      semilla: SEMILLA_HISTORIAL + indice,
      hoy,
      semanas: semanasHistorial[nombre]!,
      mesas,
      horarios: horarios.map((h) => ({
        franja: h.franja as Franja,
        horaInicio: aHora(h.horaInicio),
        horaFin: aHora(h.horaFin),
      })),
      platos,
    });

    // Los números siguen al máximo que quedó después del borrado.
    let numero = ultimo._max.numero ?? 0;
    const filas = {
      reserva: [] as Prisma.ReservaCreateManyInput[],
      cuenta: [] as Prisma.CuentaMesaCreateManyInput[],
      pedido: [] as Prisma.PedidoCreateManyInput[],
      linea: [] as Prisma.LineaPedidoCreateManyInput[],
      pago: [] as Prisma.PagoCreateManyInput[],
    };
    for (const [i, r] of reservas.entries()) {
      const comensalId = comensalIds[i % comensalIds.length]!;
      const reservaId = randomUUID();
      const cuentaMesaId = randomUUID();
      const pedidoId = randomUUID();
      const minutos = (m: number) => new Date(r.inicio.getTime() + m * 60_000);
      const monto = r.lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0);
      filas.reserva.push({
        id: reservaId,
        sucursalId,
        mesaId: r.mesaId,
        comensalId,
        inicio: r.inicio,
        cantidadPersonas: r.cantidadPersonas,
        modoAsignacion: 'AUTOMATICA',
        estado: 'FINALIZADA',
      });
      filas.cuenta.push({
        id: cuentaMesaId,
        reservaId,
        abiertaEn: r.inicio,
        cerradaEn: minutos(75),
        estado: 'CERRADA',
      });
      filas.pedido.push({
        id: pedidoId,
        cuentaMesaId,
        sucursalId,
        numero: ++numero,
        creadoEn: minutos(5),
        listoEn: minutos(25),
        estado: 'ENTREGADO',
      });
      for (const l of r.lineas) {
        filas.linea.push({
          pedidoId,
          itemMenuId: l.itemMenuId,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
        });
      }
      filas.pago.push({
        cuentaMesaId,
        comensalId,
        monto,
        metodo: i % 3 === 0 ? 'BILLETERA_VIRTUAL' : 'TARJETA',
        estado: 'APROBADO',
        fecha: minutos(70),
      });
    }
    await prisma.$transaction(
      async (tx) => {
        await insertarPorLotes(filas.reserva, (data) => tx.reserva.createMany({ data }));
        await insertarPorLotes(filas.cuenta, (data) => tx.cuentaMesa.createMany({ data }));
        await insertarPorLotes(filas.pedido, (data) => tx.pedido.createMany({ data }));
        await insertarPorLotes(filas.linea, (data) => tx.lineaPedido.createMany({ data }));
        await insertarPorLotes(filas.pago, (data) => tx.pago.createMany({ data }));
      },
      { timeout: 60_000 },
    );
    total += reservas.length;
  }
  return total;
}

// Borra las reservas del comensal de la demo y todo lo que cuelga de ellas, para
// que el seed se pueda repetir aunque alguien activó una (cuenta, pedidos, pagos).
// Los movimientos de stock de sus pedidos se conservan, sin la línea de pedido.
export async function borrarReservasDeDemo(comensalId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const reservas = { comensalId };
    const cuentas = { reserva: reservas };
    const pedidos = { cuentaMesa: cuentas };
    const pagos = { cuentaMesa: cuentas };
    await tx.movimientoStock.updateMany({
      where: { lineaPedido: { pedido: pedidos } },
      data: { lineaPedidoId: null },
    });
    await tx.movimientoPuntos.deleteMany({ where: { pago: pagos } });
    await tx.beneficioAplicado.deleteMany({ where: { pago: pagos } });
    await tx.comprobante.deleteMany({ where: { pago: pagos } });
    await tx.pago.deleteMany({ where: pagos });
    await tx.visita.deleteMany({ where: { cuentaMesa: cuentas } });
    await tx.lineaPedido.deleteMany({ where: { pedido: pedidos } });
    await tx.pedido.deleteMany({ where: pedidos });
    await tx.cuentaMesa.deleteMany({ where: cuentas });
    await tx.reserva.deleteMany({ where: reservas });
  });
}

// Faltantes de la demo del simulador (Hito 7). Se converge a un estado fijo, así
// que volver a correr el seed no agrega nada:
// - stock: todo con holgura para la semana, salvo el insumo escaso, que no alcanza;
// - capacidad: reservas pendientes del sábado a la noche de la semana próxima que
//   superan lo que entra en las mesas (todas llenas en cuatro turnos y la mesa
//   más grande con un grupo que no entra);
// - plantel: el que ya tenga la sucursal, que deja un faltante en los picos;
// - turnos: la semana en curso ya confirmada, para que "Mis turnos" tenga contenido.
// La planificación en borrador de la semana próxima se descarta para que el
// asistente la vuelva a armar con estos datos. Las mermas con motivo ya las
// carga seedProduccionDemo, dentro de los últimos 7 días.
const STOCK_HOLGADO = { GRAMO: 150000, MILILITRO: 150000, UNIDAD: 1000 } as const;

export interface OpcionesFaltantes {
  // Email del empleado de cocina de la sucursal del simulador.
  emailCocina: string;
  // Email del comensal ficticio dueño de las reservas pendientes.
  emailReservas: string;
  insumoEscaso: { nombre: string; stock: number };
}

export async function seedFaltantesSimulador(
  restauranteId: string,
  sucursalId: string,
  passwordHash: string,
  { emailCocina, emailReservas, insumoEscaso }: OpcionesFaltantes,
): Promise<void> {
  const empleado = await prisma.usuario.findUniqueOrThrow({
    where: { email: emailCocina },
  });
  const ctx = { restauranteId, sucursalId, empleadoId: empleado.id };

  const catalogo = await recetaRepository.cargarCatalogo(restauranteId);
  const existencias = await prisma.existencia.findMany({
    where: { sucursalId, sucursal: { restauranteId } },
    select: { cantidadActual: true, componente: { select: { id: true, nombre: true } } },
    orderBy: { componente: { nombre: 'asc' } },
  });
  for (const { cantidadActual, componente } of existencias) {
    const c = catalogo.get(componente.id)!;
    const escaso = componente.nombre === insumoEscaso.nombre;
    const objetivo = escaso ? insumoEscaso.stock : STOCK_HOLGADO[c.unidadBase];
    if (Number(cantidadActual) === objetivo) continue;
    await stockRepository.registrarMovimiento(ctx, {
      tipo: 'AJUSTE',
      componenteId: componente.id,
      cantidadContada: objetivo,
      costoUnitario: redondearCosto(costoUnitario(c)),
      motivo: escaso ? 'Conteo de la semana' : 'Reposición para la semana',
    });
  }

  // Reservas pendientes del sábado a la noche: cuatro turnos de una hora con
  // todas las mesas llenas y un grupo de cuatro más que los lugares de la mesa más grande.
  const comensal = await prisma.usuario.upsert({
    where: { email: emailReservas },
    update: {},
    create: { email: emailReservas, passwordHash, tipo: 'COMENSAL', activo: false },
  });
  await prisma.comensal.upsert({
    where: { usuarioId: comensal.id },
    update: {},
    create: { usuarioId: comensal.id, nombre: 'Reservas de la demo' },
  });
  await borrarReservasDeDemo(comensal.id);
  const mesas = await prisma.mesa.findMany({
    where: { sucursalId, sucursal: { restauranteId }, activa: true },
    select: { id: true, capacidad: true },
    orderBy: { numero: 'asc' },
  });
  const { desde: lunesProximo, fechas } = semanaSiguiente(new Date());
  const inicios = iniciosDelDia(fechas[5]!, '20:00', '00:00');
  const grande = mesas.reduce((a, m) => (m.capacidad > a.capacidad ? m : a));
  const reservas: Prisma.ReservaCreateManyInput[] = inicios.flatMap((inicio) =>
    mesas.map((m) => ({
      sucursalId,
      mesaId: m.id,
      comensalId: comensal.id,
      inicio,
      // La mesa más grande, a las 21, recibe un grupo de cuatro más que sus lugares.
      cantidadPersonas:
        m.id === grande.id && inicio.getTime() === inicios[1]!.getTime()
          ? m.capacidad + 4
          : m.capacidad,
      modoAsignacion: 'MANUAL' as const,
      estado: 'PENDIENTE' as const,
    })),
  );
  await prisma.reserva.createMany({ data: reservas });

  // Semana próxima: se descarta el borrador (nunca uno confirmado). Las alertas
  // y los turnos se van con la planificación.
  await prisma.planificacionTurnos.deleteMany({
    where: { sucursalId, estado: 'BORRADOR', semanaDesde: new Date(`${lunesProximo}T00:00:00Z`) },
  });

  // Semana en curso, confirmada: los mozos rotan entre almuerzo y cena.
  const lunesActual = sumarDias(lunesProximo, -7);
  const semana = new Date(`${lunesActual}T00:00:00Z`);
  const yaConfirmada = await prisma.planificacionTurnos.count({
    where: { sucursalId, semanaDesde: semana },
  });
  if (yaConfirmada > 0) return;
  const plantel = async (rol: 'Mozo' | 'Cocinero') =>
    (
      await prisma.empleado.findMany({
        where: { restauranteId, rol: { nombre: rol }, sucursales: { some: { sucursalId } } },
        select: { usuarioId: true },
        orderBy: { nombreCompleto: 'asc' },
      })
    ).map((e) => e.usuarioId);
  const mozos = await plantel('Mozo');
  const cocineros = await plantel('Cocinero');
  const turnos: Prisma.TurnoCreateManyPlanificacionInput[] = [];
  for (let d = 0; d < 7; d++) {
    const fecha = new Date(`${sumarDias(lunesActual, d)}T00:00:00Z`);
    for (const [franja, desfase] of [
      ['ALMUERZO', 0],
      ['CENA', 2],
    ] as const) {
      for (let k = 0; k < 2; k++) {
        turnos.push({
          empleadoId: mozos[(d + desfase + k) % mozos.length]!,
          sucursalId,
          fecha,
          franja,
        });
      }
      turnos.push({
        empleadoId: cocineros[(d + desfase / 2) % cocineros.length]!,
        sucursalId,
        fecha,
        franja,
      });
    }
  }
  await prisma.planificacionTurnos.create({
    data: {
      sucursalId,
      semanaDesde: semana,
      estado: 'CONFIRMADA',
      confirmadaEn: new Date(),
      turnos: { create: turnos },
    },
  });
}
