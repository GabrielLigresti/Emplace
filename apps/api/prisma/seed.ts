// Datos ficticios de prueba. Es idempotente: se puede correr varias veces sin
// duplicar filas (npm run db:seed -w @pgim/api).
import { CONFIGURACION_APERTURA_POR_DEFECTO, type UnidadBase } from '@pgim/shared';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import type { Prisma } from '../src/generated/prisma/client';
import { crearRolesPredeterminados, upsertRol } from '../src/repositories/roles-predeterminados';
import {
  ROLES_STAFF,
  hora,
  redondearCosto,
  seedComponente,
  seedFaltantesSimulador,
  seedFidelizacion,
  seedHistorialVentas,
  seedMenus,
  seedModelosRa,
  seedPermisos,
  seedProduccionDemo,
  seedReceta,
  seedSalon,
  costoTeoricoDeSeed,
  type RecetaSeed,
  type SalonSeed,
} from './seed-comun';

const PASSWORD_DEMO = 'demo1234';

const SUCURSALES = [
  { nombre: 'Centro', direccion: 'Av. Siempre Viva 742', barrio: 'SAN_NICOLAS' },
  { nombre: 'Palermo', direccion: 'Calle Falsa 123', barrio: 'PALERMO' },
] as const;

type NombreSucursal = (typeof SUCURSALES)[number]['nombre'];

// Salón de cada sucursal (CU-14): capacidades en orden de número de mesa,
// ubicadas en el primer lugar libre del lienzo de 100 × 60.
const SALONES: Record<NombreSucursal, SalonSeed> = {
  Centro: { capacidades: [2, 2, 4, 4, 4, 6, 6, 8, 2, 4] },
  Palermo: { capacidades: [2, 4, 4, 6, 2, 8] },
};

const COMENSALES = [
  { email: 'comensal@demo.pgim.test', nombre: 'Carlos Comensal' },
  { email: 'comensal2@demo.pgim.test', nombre: 'Lucía Comensal' },
];

const EMPLEADOS: {
  email: string;
  nombreCompleto: string;
  rol: string;
  sucursales: NombreSucursal[];
}[] = [
  {
    email: 'admin@demo.pgim.test',
    nombreCompleto: 'Ana Admin',
    rol: 'Administrador',
    sucursales: ['Centro', 'Palermo'],
  },
  {
    email: 'gerente@demo.pgim.test',
    nombreCompleto: 'Germán Gerente',
    rol: 'Gerente de sucursal',
    sucursales: ['Centro'],
  },
  {
    email: 'cocina@demo.pgim.test',
    nombreCompleto: 'Julia Jefa',
    rol: 'Jefe de cocina',
    sucursales: ['Centro'],
  },
  {
    email: 'mozo@demo.pgim.test',
    nombreCompleto: 'Mario Mozo',
    rol: 'Mozo',
    sucursales: ['Centro'],
  },
  {
    email: 'cocinero@demo.pgim.test',
    nombreCompleto: 'Carla Cocinera',
    rol: 'Cocinero',
    sucursales: ['Palermo'],
  },
  // Plantel de Centro para la demo del simulador: cinco mozos y dos cocineros
  // (con la jefa de cocina, que también cuenta como cocinera para los turnos),
  // lo justo para que la grilla muestre reparto y todavía falte gente en los picos.
  {
    email: 'mozo2@demo.pgim.test',
    nombreCompleto: 'Marta Mozo',
    rol: 'Mozo',
    sucursales: ['Centro'],
  },
  {
    email: 'mozo3@demo.pgim.test',
    nombreCompleto: 'Nicolás Mozo',
    rol: 'Mozo',
    sucursales: ['Centro'],
  },
  {
    email: 'mozo4@demo.pgim.test',
    nombreCompleto: 'Paula Mozo',
    rol: 'Mozo',
    sucursales: ['Centro'],
  },
  {
    email: 'mozo5@demo.pgim.test',
    nombreCompleto: 'Rubén Mozo',
    rol: 'Mozo',
    sucursales: ['Centro'],
  },
  {
    email: 'cocinero2@demo.pgim.test',
    nombreCompleto: 'Silvia Cocinera',
    rol: 'Cocinero',
    sucursales: ['Centro'],
  },
];

const HORARIOS_SERVICIO = [
  { franja: 'ALMUERZO', horaInicio: hora('12:00'), horaFin: hora('16:00') },
  { franja: 'CENA', horaInicio: hora('20:00'), horaFin: hora('00:00') },
] as const;

const CATEGORIAS = [
  { nombre: 'Entradas', requiereReceta: false, admiteObservaciones: true },
  { nombre: 'Principales', requiereReceta: true, admiteObservaciones: true },
  { nombre: 'Postres', requiereReceta: true, admiteObservaciones: true },
  // Las bebidas no llevan aclaración.
  { nombre: 'Bebidas', requiereReceta: false, admiteObservaciones: false },
] as const;

type NombreCategoria = (typeof CATEGORIAS)[number]['nombre'];

// Costos ficticios por unidad base; stock inicial de la sucursal Centro.
const INSUMOS: { nombre: string; unidadBase: UnidadBase; costo: number; stock: number }[] = [
  { nombre: 'Carne vacuna', unidadBase: 'GRAMO', costo: 18, stock: 20000 },
  { nombre: 'Queso provolone', unidadBase: 'GRAMO', costo: 14, stock: 5000 },
  { nombre: 'Papa', unidadBase: 'GRAMO', costo: 1.2, stock: 15000 },
  { nombre: 'Tomate', unidadBase: 'GRAMO', costo: 2.5, stock: 6000 },
  { nombre: 'Cebolla', unidadBase: 'GRAMO', costo: 1.5, stock: 6000 },
  { nombre: 'Morrón', unidadBase: 'GRAMO', costo: 4, stock: 3000 },
  { nombre: 'Aceite de oliva', unidadBase: 'MILILITRO', costo: 12, stock: 5000 },
  { nombre: 'Vinagre', unidadBase: 'MILILITRO', costo: 3, stock: 2000 },
  { nombre: 'Sal', unidadBase: 'GRAMO', costo: 0.5, stock: 3000 },
  { nombre: 'Huevo', unidadBase: 'UNIDAD', costo: 250, stock: 120 },
  { nombre: 'Leche', unidadBase: 'MILILITRO', costo: 1.5, stock: 10000 },
  { nombre: 'Azúcar', unidadBase: 'GRAMO', costo: 1.2, stock: 5000 },
  // Reventa: las bebidas se venden como vienen y descuentan una botella.
  { nombre: 'Agua mineral 500 ml', unidadBase: 'UNIDAD', costo: 600, stock: 48 },
];

const SALSA_CRIOLLA: RecetaSeed = {
  rendimiento: 1000,
  instrucciones: 'Picar las verduras chico y mezclar con el aceite, el vinagre y la sal.',
  lineas: [
    ['Tomate', 400, 'GRAMO', 10],
    ['Cebolla', 300, 'GRAMO', 10],
    ['Morrón', 200, 'GRAMO', 15],
    ['Aceite de oliva', 100, 'MILILITRO'],
    ['Vinagre', 50, 'MILILITRO'],
    ['Sal', 10, 'GRAMO'],
  ],
};

// Intermedio sin stock: se explota hasta sus insumos en cada pedido.
const CHIMICHURRI: RecetaSeed = {
  rendimiento: 300,
  instrucciones: 'Picar todo fino y dejar reposar en el aceite y el vinagre.',
  lineas: [
    ['Aceite de oliva', 100, 'MILILITRO'],
    ['Vinagre', 50, 'MILILITRO'],
    ['Cebolla', 100, 'GRAMO', 10],
    ['Morrón', 50, 'GRAMO', 15],
    ['Sal', 5, 'GRAMO'],
  ],
};

// Las fotos están en apps/web/public/fotos-demo (licencias en su LICENCIA.md).
// Todos los platos con receta llevan costo cargado, así el ranking por margen de
// las métricas no sale con "Sin dato".
const PLATOS: {
  nombre: string;
  categoria: NombreCategoria;
  precio: number;
  diametroCm: number;
  descripcion: string;
  foto: string;
  receta?: RecetaSeed;
  // Nombre del insumo que se revende como viene (sin receta).
  reventa?: string;
}[] = [
  {
    nombre: 'Provoleta',
    categoria: 'Entradas',
    precio: 7500,
    diametroCm: 20,
    descripcion: 'Queso provolone a la parrilla con orégano.',
    foto: 'provoleta.jpg',
    receta: {
      rendimiento: 1,
      instrucciones: 'Grillar el queso en la plancha de hierro hasta dorar.',
      lineas: [
        ['Queso provolone', 200, 'GRAMO'],
        ['Aceite de oliva', 10, 'MILILITRO'],
        ['Chimichurri', 20, 'GRAMO'],
      ],
    },
  },
  {
    nombre: 'Empanada de carne',
    categoria: 'Entradas',
    precio: 2500,
    diametroCm: 22,
    descripcion: 'Cortada a cuchillo, al horno.',
    foto: 'empanada-de-carne.jpg',
    receta: {
      rendimiento: 1,
      instrucciones: 'Rehogar la cebolla, cocinar la carne, rellenar y hornear.',
      lineas: [
        ['Carne vacuna', 60, 'GRAMO', 10],
        ['Cebolla', 30, 'GRAMO', 10],
        ['Aceite de oliva', 5, 'MILILITRO'],
        ['Sal', 1, 'GRAMO'],
      ],
    },
  },
  {
    nombre: 'Bife de chorizo con papas',
    categoria: 'Principales',
    precio: 18000,
    diametroCm: 28,
    descripcion: 'Bife de 400 g con papas fritas y salsa criolla.',
    foto: 'bife-de-chorizo-con-papas.jpg',
    receta: {
      rendimiento: 1,
      instrucciones: 'Sellar el bife a fuego fuerte; freír las papas en bastones.',
      lineas: [
        ['Carne vacuna', 400, 'GRAMO', 15],
        ['Papa', 300, 'GRAMO', 20],
        ['Aceite de oliva', 30, 'MILILITRO'],
        ['Sal', 5, 'GRAMO'],
        ['Salsa criolla', 80, 'GRAMO'],
      ],
    },
  },
  {
    nombre: 'Milanesa con puré',
    categoria: 'Principales',
    precio: 14000,
    diametroCm: 30,
    descripcion: 'Milanesa de ternera con puré de papas.',
    foto: 'milanesa-con-pure.jpg',
    receta: {
      rendimiento: 1,
      instrucciones: 'Empanar la milanesa y freírla; hervir las papas y pisarlas con leche.',
      lineas: [
        ['Carne vacuna', 250, 'GRAMO', 10],
        ['Huevo', 1, 'UNIDAD'],
        ['Papa', 250, 'GRAMO', 15],
        ['Leche', 50, 'MILILITRO'],
        ['Aceite de oliva', 40, 'MILILITRO'],
        ['Sal', 3, 'GRAMO'],
      ],
    },
  },
  {
    nombre: 'Flan casero',
    categoria: 'Postres',
    precio: 5500,
    diametroCm: 20,
    descripcion: 'Con dulce de leche o crema.',
    foto: 'flan-casero.jpg',
    receta: {
      rendimiento: 4,
      instrucciones: 'Batir, colar y cocinar a baño María en el horno durante 50 minutos.',
      lineas: [
        ['Huevo', 4, 'UNIDAD'],
        ['Leche', 0.5, 'LITRO'],
        ['Azúcar', 150, 'GRAMO'],
      ],
    },
  },
  {
    nombre: 'Agua mineral',
    categoria: 'Bebidas',
    precio: 2000,
    diametroCm: 22,
    descripcion: 'Botella de 500 ml, con o sin gas.',
    foto: 'agua-mineral.jpg',
    reventa: 'Agua mineral 500 ml',
  },
];

async function seedMenuEInventario(
  tx: Prisma.TransactionClient,
  restauranteId: string,
  sucursalIds: string[],
  adminId: string,
): Promise<string[]> {
  const categoriaIds = new Map<NombreCategoria, string>();
  for (const { nombre, requiereReceta, admiteObservaciones } of CATEGORIAS) {
    const categoria = await tx.categoria.upsert({
      where: { restauranteId_nombre: { restauranteId, nombre } },
      update: { requiereReceta, admiteObservaciones },
      create: { restauranteId, nombre, requiereReceta, admiteObservaciones },
    });
    categoriaIds.set(nombre, categoria.id);
  }

  const componentes = new Map<string, string>();
  for (const insumo of INSUMOS) {
    const id = await seedComponente(tx, restauranteId, {
      nombre: insumo.nombre,
      tipo: 'INSUMO',
      unidadBase: insumo.unidadBase,
      costoCompraVigente: insumo.costo,
    });
    componentes.set(insumo.nombre, id);

    // El stock es la suma de los movimientos: la existencia nace con un
    // INGRESO. Solo se crea una vez por sucursal, así que volver a correr el
    // seed no duplica.
    for (const sucursalId of sucursalIds) {
      const existencia = await tx.existencia.findUnique({
        where: { sucursalId_componenteId: { sucursalId, componenteId: id } },
      });
      if (existencia) continue;
      await tx.existencia.create({
        data: {
          sucursalId,
          componenteId: id,
          cantidadActual: insumo.stock,
          movimientos: {
            create: {
              tipo: 'INGRESO',
              cantidad: insumo.stock,
              costoUnitario: insumo.costo,
              motivo: 'Stock inicial',
              empleadoId: adminId,
            },
          },
        },
      });
    }
  }

  const salsaId = await seedComponente(tx, restauranteId, {
    nombre: 'Salsa criolla',
    tipo: 'INTERMEDIO',
    unidadBase: 'GRAMO',
    // Con stock, el intermedio nunca queda sin costo: arranca en el teórico de su receta.
    costoCompraVigente: redondearCosto(
      costoTeoricoDeSeed('Salsa criolla', 'GRAMO', SALSA_CRIOLLA, INSUMOS),
    ),
    llevaStock: true,
  });
  componentes.set('Salsa criolla', salsaId);
  await seedReceta(tx, { productoIntermedioId: salsaId }, SALSA_CRIOLLA, componentes);

  const chimichurriId = await seedComponente(tx, restauranteId, {
    nombre: 'Chimichurri',
    tipo: 'INTERMEDIO',
    unidadBase: 'GRAMO',
    costoCompraVigente: null,
  });
  componentes.set('Chimichurri', chimichurriId);
  await seedReceta(tx, { productoIntermedioId: chimichurriId }, CHIMICHURRI, componentes);

  const platoIds: string[] = [];
  for (const plato of PLATOS) {
    const datos = {
      categoriaId: categoriaIds.get(plato.categoria)!,
      precio: plato.precio,
      diametroCm: plato.diametroCm,
      descripcion: plato.descripcion,
      fotoUrl: `/fotos-demo/${plato.foto}`,
      disponible: true,
      activo: true,
      insumoId: plato.reventa ? componentes.get(plato.reventa)! : null,
    };
    const existente = await tx.itemMenu.findFirst({
      where: { restauranteId, nombre: plato.nombre },
    });
    const item = existente
      ? await tx.itemMenu.update({ where: { id: existente.id }, data: datos })
      : await tx.itemMenu.create({ data: { restauranteId, nombre: plato.nombre, ...datos } });

    if (plato.receta) await seedReceta(tx, { itemMenuId: item.id }, plato.receta, componentes);
    else await tx.receta.deleteMany({ where: { itemMenuId: item.id } });
    platoIds.push(item.id);
  }
  return platoIds;
}

// "Carta principal" queda vigente y activa en Centro y en Palermo; "Menú de invierno" ya
// venció, para ver cómo se marca en el panel.
const MENUS = [
  {
    nombre: 'Carta principal',
    descripcion: 'La carta de todo el año.',
    vigenciaDesde: '2026-10-01',
    vigenciaHasta: null,
  },
  {
    nombre: 'Menú de invierno',
    descripcion: 'Platos de olla y guisos.',
    vigenciaDesde: '2026-06-21',
    vigenciaHasta: '2026-09-20',
  },
] as const;

// Modelos de demo (Kenney, CC0; ver modelos-demo/LICENCIA.md), ya a escala
// real. El resto de los platos queda sin modelo, para ver el menú sin "Ver en RA".
const MODELOS_RA = [
  { plato: 'Flan casero', archivo: 'flan.glb', porcionGramos: 120 },
  { plato: 'Bife de chorizo con papas', archivo: 'bife.glb', porcionGramos: 400 },
];

// Empleado de cocina de cada sucursal, para la demo de producción y del simulador.
const COCINA_DE: Record<NombreSucursal, string> = {
  Centro: 'cocina@demo.pgim.test',
  Palermo: 'cocinero@demo.pgim.test',
};

// Historial de ventas: Centro con 12 semanas y Palermo con 5, para mostrar el progreso.
const SEMANAS_HISTORIAL: Record<NombreSucursal, number> = { Centro: 12, Palermo: 5 };

// Faltantes de la demo del simulador en Centro: el queso provolone no alcanza.
const STOCK_PROVOLONE_DEMO = 15000;
const EMAIL_RESERVAS_DEMO = 'reservas-demo@demo.test';

// Una sucursal dada de baja del primer restaurante: el buscador público no la muestra.
// Queda fuera del mapa de sucursales del seed, así no recibe salón, stock ni historial.
async function seedSucursalCerrada(tx: Prisma.TransactionClient, restauranteId: string) {
  const nombre = 'Belgrano (cerrada)';
  const datos = {
    direccion: 'Av. Cabildo 1500',
    barrio: 'BELGRANO',
    horarioApertura: hora('12:00'),
    horarioCierre: hora('00:00'),
    toleranciaNoShowMin: 15,
    activa: false,
  } as const;
  const existente = await tx.sucursal.findFirst({ where: { restauranteId, nombre } });
  const sucursal = existente
    ? await tx.sucursal.update({ where: { id: existente.id }, data: datos })
    : await tx.sucursal.create({ data: { restauranteId, nombre, ...datos } });
  await tx.configuracionApertura.upsert({
    where: { sucursalId: sucursal.id },
    update: {},
    create: { sucursalId: sucursal.id, ...CONFIGURACION_APERTURA_POR_DEFECTO },
  });
}

// Segundo restaurante ficticio, chico y sin historial: sirve para probar que el
// buscador cruza restaurantes y que cada panel ve solo lo suyo.
const CUIT_SEGUNDO_RESTAURANTE = '30-00000001-8';
const INSUMOS_SEGUNDO: { nombre: string; unidadBase: UnidadBase; costo: number; stock: number }[] =
  [
    { nombre: 'Papa', unidadBase: 'GRAMO', costo: 1.2, stock: 8000 },
    { nombre: 'Harina 000', unidadBase: 'GRAMO', costo: 0.9, stock: 8000 },
    { nombre: 'Tomate', unidadBase: 'GRAMO', costo: 2.5, stock: 4000 },
    { nombre: 'Gaseosa cola 500 ml', unidadBase: 'UNIDAD', costo: 700, stock: 48 },
  ];
const NOQUIS: RecetaSeed = {
  rendimiento: 1,
  instrucciones: 'Amasar la papa con la harina, cortar los ñoquis, hervirlos y servir con el tuco.',
  lineas: [
    ['Papa', 250, 'GRAMO', 10],
    ['Harina 000', 100, 'GRAMO'],
    ['Tomate', 150, 'GRAMO', 10],
  ],
};

async function seedSegundoRestaurante(tx: Prisma.TransactionClient, passwordHash: string) {
  const nombre = 'La Esquina de Villa Crespo';
  const restaurante = await tx.restaurante.upsert({
    where: { cuit: CUIT_SEGUNDO_RESTAURANTE },
    update: { nombre },
    create: { nombre, cuit: CUIT_SEGUNDO_RESTAURANTE },
  });
  const restauranteId = restaurante.id;

  const datosSucursal = {
    direccion: 'Av. Corrientes 5400',
    barrio: 'VILLA_CRESPO',
    horarioApertura: hora('12:00'),
    horarioCierre: hora('00:00'),
    toleranciaNoShowMin: 15,
    activa: true,
  } as const;
  const existente = await tx.sucursal.findFirst({
    where: { restauranteId, nombre: 'Villa Crespo' },
  });
  const sucursal = existente
    ? await tx.sucursal.update({ where: { id: existente.id }, data: datosSucursal })
    : await tx.sucursal.create({
        data: { restauranteId, nombre: 'Villa Crespo', ...datosSucursal },
      });
  await tx.horarioServicio.deleteMany({ where: { sucursalId: sucursal.id } });
  await tx.horarioServicio.createMany({
    data: HORARIOS_SERVICIO.map((h) => ({ sucursalId: sucursal.id, ...h })),
  });
  await seedSalon(tx, sucursal.id, { capacidades: [2, 4, 4, 6] });
  await tx.configuracionApertura.upsert({
    where: { sucursalId: sucursal.id },
    update: {},
    create: { sucursalId: sucursal.id, ...CONFIGURACION_APERTURA_POR_DEFECTO },
  });

  // Administrador con el rol predeterminado.
  const rolIds = await crearRolesPredeterminados(tx, restauranteId);
  const usuario = await tx.usuario.upsert({
    where: { email: 'admin2@demo.pgim.test' },
    update: { passwordHash, activo: true },
    create: { email: 'admin2@demo.pgim.test', passwordHash, tipo: 'EMPLEADO' },
  });
  const datosEmpleado = {
    restauranteId,
    rolId: rolIds.get('Administrador')!,
    nombreCompleto: 'Bruno Administrador',
    horasSemanalesMax: 48,
  };
  await tx.empleado.upsert({
    where: { usuarioId: usuario.id },
    update: datosEmpleado,
    create: { usuarioId: usuario.id, ...datosEmpleado },
  });
  await tx.empleadoSucursal.deleteMany({ where: { empleadoId: usuario.id } });
  await tx.empleadoSucursal.create({
    data: { empleadoId: usuario.id, sucursalId: sucursal.id },
  });

  // Carta: un principal con receta y una bebida de reventa.
  const categorias = new Map<string, string>();
  for (const c of CATEGORIAS.filter((c) => c.nombre === 'Principales' || c.nombre === 'Bebidas')) {
    const { id } = await tx.categoria.upsert({
      where: { restauranteId_nombre: { restauranteId, nombre: c.nombre } },
      update: { requiereReceta: c.requiereReceta, admiteObservaciones: c.admiteObservaciones },
      create: { restauranteId, ...c },
    });
    categorias.set(c.nombre, id);
  }
  const componentes = new Map<string, string>();
  for (const insumo of INSUMOS_SEGUNDO) {
    const id = await seedComponente(tx, restauranteId, {
      nombre: insumo.nombre,
      tipo: 'INSUMO',
      unidadBase: insumo.unidadBase,
      costoCompraVigente: insumo.costo,
    });
    componentes.set(insumo.nombre, id);
    const existencia = await tx.existencia.findUnique({
      where: { sucursalId_componenteId: { sucursalId: sucursal.id, componenteId: id } },
    });
    if (existencia) continue;
    await tx.existencia.create({
      data: {
        sucursalId: sucursal.id,
        componenteId: id,
        cantidadActual: insumo.stock,
        movimientos: {
          create: {
            tipo: 'INGRESO',
            cantidad: insumo.stock,
            costoUnitario: insumo.costo,
            motivo: 'Stock inicial',
            empleadoId: usuario.id,
          },
        },
      },
    });
  }
  const platos = [
    {
      nombre: 'Ñoquis con tuco',
      categoria: 'Principales',
      precio: 9500,
      diametroCm: 26,
      descripcion: 'Ñoquis de papa caseros con salsa de tomate.',
      receta: NOQUIS as RecetaSeed | null,
      insumo: null as string | null,
    },
    {
      nombre: 'Gaseosa cola 500 ml',
      categoria: 'Bebidas',
      precio: 2800,
      diametroCm: 22,
      descripcion: 'Botella individual.',
      receta: null,
      insumo: 'Gaseosa cola 500 ml',
    },
  ];
  const platoIds: string[] = [];
  for (const plato of platos) {
    const datos = {
      categoriaId: categorias.get(plato.categoria)!,
      precio: plato.precio,
      diametroCm: plato.diametroCm,
      descripcion: plato.descripcion,
      // Sin foto: las de /fotos-demo son solo de La Parrilla Demo.
      fotoUrl: null,
      disponible: true,
      activo: true,
      insumoId: plato.insumo ? componentes.get(plato.insumo)! : null,
    };
    const actual = await tx.itemMenu.findFirst({ where: { restauranteId, nombre: plato.nombre } });
    const item = actual
      ? await tx.itemMenu.update({ where: { id: actual.id }, data: datos })
      : await tx.itemMenu.create({ data: { restauranteId, nombre: plato.nombre, ...datos } });
    if (plato.receta) await seedReceta(tx, { itemMenuId: item.id }, plato.receta, componentes);
    platoIds.push(item.id);
  }
  const cartaId = await seedMenus(tx, restauranteId, platoIds, MENUS);
  await tx.sucursal.update({ where: { id: sucursal.id }, data: { menuActivoId: cartaId } });
}

async function main(): Promise<void> {
  const passwordHash = await hashPassword(PASSWORD_DEMO);

  const { restauranteId, sucursalIds } = await prisma.$transaction(async (tx) => {
    const permisoIds = await seedPermisos(tx);

    const restaurante = await tx.restaurante.upsert({
      where: { cuit: '30-00000000-0' },
      update: { nombre: 'La Parrilla Demo' },
      create: { nombre: 'La Parrilla Demo', cuit: '30-00000000-0' },
    });

    const sucursalIds = new Map<NombreSucursal, string>();
    for (const { nombre, direccion, barrio } of SUCURSALES) {
      const datos = {
        direccion,
        barrio,
        horarioApertura: hora('12:00'),
        horarioCierre: hora('00:00'),
        toleranciaNoShowMin: 15,
        activa: true,
      };
      const existente = await tx.sucursal.findFirst({
        where: { restauranteId: restaurante.id, nombre },
      });
      const sucursal = existente
        ? await tx.sucursal.update({ where: { id: existente.id }, data: datos })
        : await tx.sucursal.create({ data: { restauranteId: restaurante.id, nombre, ...datos } });
      sucursalIds.set(nombre, sucursal.id);

      await tx.horarioServicio.deleteMany({ where: { sucursalId: sucursal.id } });
      await tx.horarioServicio.createMany({
        data: HORARIOS_SERVICIO.map((h) => ({ sucursalId: sucursal.id, ...h })),
      });

      await seedSalon(tx, sucursal.id, SALONES[nombre]);

      // Solo se crea: una configuración editada no se pisa al volver a correr el seed.
      await tx.configuracionApertura.upsert({
        where: { sucursalId: sucursal.id },
        update: {},
        create: { sucursalId: sucursal.id, ...CONFIGURACION_APERTURA_POR_DEFECTO },
      });
    }

    await seedSucursalCerrada(tx, restaurante.id);

    const rolIds = await crearRolesPredeterminados(tx, restaurante.id);
    for (const rol of ROLES_STAFF) {
      rolIds.set(rol.nombre, await upsertRol(tx, restaurante.id, rol, false, permisoIds));
    }

    for (const empleado of EMPLEADOS) {
      const usuario = await tx.usuario.upsert({
        where: { email: empleado.email },
        update: { passwordHash, activo: true },
        create: { email: empleado.email, passwordHash, tipo: 'EMPLEADO' },
      });
      const datos = {
        restauranteId: restaurante.id,
        rolId: rolIds.get(empleado.rol)!,
        nombreCompleto: empleado.nombreCompleto,
        horasSemanalesMax: 48,
      };
      await tx.empleado.upsert({
        where: { usuarioId: usuario.id },
        update: datos,
        create: { usuarioId: usuario.id, ...datos },
      });

      await tx.empleadoSucursal.deleteMany({ where: { empleadoId: usuario.id } });
      await tx.empleadoSucursal.createMany({
        data: empleado.sucursales.map((nombre) => ({
          empleadoId: usuario.id,
          sucursalId: sucursalIds.get(nombre)!,
        })),
      });
    }

    const admin = await tx.usuario.findUniqueOrThrow({ where: { email: 'admin@demo.pgim.test' } });
    const platoIds = await seedMenuEInventario(
      tx,
      restaurante.id,
      [...sucursalIds.values()],
      admin.id,
    );
    const cartaId = await seedMenus(tx, restaurante.id, platoIds, MENUS);
    // Las dos sucursales usan la carta: el historial de ventas sale de ella.
    await tx.sucursal.updateMany({
      where: { id: { in: [...sucursalIds.values()] } },
      data: { menuActivoId: cartaId },
    });
    await seedFidelizacion(tx, restaurante.id, cartaId);
    await seedSegundoRestaurante(tx, passwordHash);

    for (const { email, nombre } of COMENSALES) {
      const comensal = await tx.usuario.upsert({
        where: { email },
        update: { passwordHash, activo: true },
        create: { email, passwordHash, tipo: 'COMENSAL' },
      });
      await tx.comensal.upsert({
        where: { usuarioId: comensal.id },
        update: { nombre },
        create: { usuarioId: comensal.id, nombre },
      });
    }
    return { restauranteId: restaurante.id, sucursalIds };
  });
  await seedModelosRa(restauranteId, MODELOS_RA);
  await seedProduccionDemo(restauranteId, sucursalIds, COCINA_DE);
  const reservasHistorial = await seedHistorialVentas(
    restauranteId,
    sucursalIds,
    passwordHash,
    SEMANAS_HISTORIAL,
  );
  await seedFaltantesSimulador(restauranteId, sucursalIds.get('Centro')!, passwordHash, {
    emailCocina: COCINA_DE.Centro,
    emailReservas: EMAIL_RESERVAS_DEMO,
    insumoEscaso: { nombre: 'Queso provolone', stock: STOCK_PROVOLONE_DEMO },
  });

  const [permisos, roles, sucursales, usuarios, componentes, platos, movimientos, tandas] =
    await Promise.all([
      prisma.permiso.count(),
      prisma.rol.count(),
      prisma.sucursal.count(),
      prisma.usuario.count(),
      prisma.componenteInventario.count(),
      prisma.itemMenu.count(),
      prisma.movimientoStock.count(),
      prisma.tandaProduccion.count(),
    ]);
  console.log(
    `Seed listo: ${permisos} permisos, ${roles} roles, ${sucursales} sucursales, ${usuarios} usuarios, ` +
      `${componentes} componentes, ${platos} platos, ${movimientos} movimientos, ${tandas} tandas, ${reservasHistorial} reservas de historial (contraseña: ${PASSWORD_DEMO}).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
