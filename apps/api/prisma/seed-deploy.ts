// Datos ficticios para el deploy: seis restaurantes operativos de dos sucursales cada
// uno, con carta y fotos. Es idempotente (npm run db:seed:deploy -w @pgim/api) y no
// choca con seed.ts: CUIT y emails propios, salvo las dos cuentas de comensal de la
// demo, que se comparten. Solo la parrilla lleva historial, producción, simulador y RA.
import { CONFIGURACION_APERTURA_POR_DEFECTO, type Barrio, type UnidadBase } from '@pgim/shared';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import type { Prisma } from '../src/generated/prisma/client';
import { crearRolesPredeterminados, upsertRol } from '../src/repositories/roles-predeterminados';
import {
  ROLES_STAFF,
  costoTeoricoDeSeed,
  hora,
  redondearCosto,
  seedComponente,
  seedFaltantesSimulador,
  seedHistorialVentas,
  seedMenus,
  seedModelosRa,
  seedPermisos,
  seedProduccionDemo,
  seedReceta,
  seedSalon,
  type InsumoSeed,
  type LineaSeed,
  type MenuSeed,
  type ModeloRaSeed,
  type RecetaSeed,
  type SalonSeed,
} from './seed-comun';

const PASSWORD_DEMO = 'demo1234';

const COMENSALES = [
  { email: 'comensal@demo.pgim.test', nombre: 'Carlos Ibáñez' },
  { email: 'comensal2@demo.pgim.test', nombre: 'Lucía Ferreyra' },
];

const HORARIOS_SERVICIO = [
  { franja: 'ALMUERZO', horaInicio: hora('12:00'), horaFin: hora('16:00') },
  { franja: 'CENA', horaInicio: hora('20:00'), horaFin: hora('00:00') },
] as const;

// Salón grande para la primera sucursal y chico para la segunda.
const SALON_GRANDE: SalonSeed = { capacidades: [2, 2, 4, 4, 4, 6, 6, 8, 2, 4] };
const SALON_CHICO: SalonSeed = { capacidades: [2, 4, 4, 6, 2, 8] };

const MENUS: readonly MenuSeed[] = [
  {
    nombre: 'Carta principal',
    descripcion: 'La carta de todo el año.',
    vigenciaDesde: '2026-10-01',
    vigenciaHasta: null,
  },
];

// Catálogo común de insumos: costo ficticio por unidad base. Cada restaurante carga
// los que usan sus recetas, con el stock inicial según la unidad.
const CATALOGO: Record<string, [UnidadBase, number]> = {
  // Carnes, pescados y fiambres
  'Bife de chorizo': ['GRAMO', 22],
  'Ojo de bife': ['GRAMO', 26],
  Lomo: ['GRAMO', 24],
  Chorizo: ['GRAMO', 9],
  'Pechuga de pollo': ['GRAMO', 7],
  Nalga: ['GRAMO', 18],
  'Carne para estofado': ['GRAMO', 13],
  'Carne molida': ['GRAMO', 14],
  Panceta: ['GRAMO', 16],
  'Cerdo molido': ['GRAMO', 10],
  Salmón: ['GRAMO', 35],
  Langostino: ['GRAMO', 28],
  Kanikama: ['GRAMO', 18],
  Pepperoni: ['GRAMO', 17],
  'Jamón cocido': ['GRAMO', 12],
  'Jamón crudo': ['GRAMO', 30],
  // Verduras y frutas
  Papa: ['GRAMO', 1.2],
  Tomate: ['GRAMO', 2.5],
  'Tomate triturado': ['GRAMO', 3],
  Cebolla: ['GRAMO', 1.5],
  'Cebolla morada': ['GRAMO', 2],
  Morrón: ['GRAMO', 4],
  Zapallito: ['GRAMO', 2.5],
  Zanahoria: ['GRAMO', 1.5],
  Lechuga: ['GRAMO', 3],
  'Hojas verdes': ['GRAMO', 5],
  Rúcula: ['GRAMO', 6],
  Kale: ['GRAMO', 6],
  Espárragos: ['GRAMO', 10],
  Hongos: ['GRAMO', 8],
  Champiñones: ['GRAMO', 8],
  Palta: ['GRAMO', 9],
  Pepino: ['GRAMO', 2],
  Repollo: ['GRAMO', 1.5],
  Limón: ['GRAMO', 2],
  Ajo: ['GRAMO', 8],
  Albahaca: ['GRAMO', 15],
  Salvia: ['GRAMO', 8],
  Aceitunas: ['GRAMO', 9],
  Pepinillos: ['GRAMO', 8],
  'Porotos negros': ['GRAMO', 4],
  'Porotos alubia': ['GRAMO', 4],
  Edamame: ['GRAMO', 10],
  // Lácteos, huevos y panificados
  'Queso cheddar': ['GRAMO', 13],
  Mozzarella: ['GRAMO', 11],
  'Queso parmesano': ['GRAMO', 20],
  'Queso ricota': ['GRAMO', 8],
  'Queso fresco': ['GRAMO', 9],
  'Queso crema': ['GRAMO', 12],
  Manteca: ['GRAMO', 14],
  'Crema de leche': ['MILILITRO', 4],
  Leche: ['MILILITRO', 1.5],
  Huevo: ['UNIDAD', 250],
  'Harina 000': ['GRAMO', 0.9],
  Levadura: ['GRAMO', 20],
  'Pan de campo': ['GRAMO', 5],
  'Pan rallado': ['GRAMO', 2],
  'Penne secos': ['GRAMO', 3],
  'Pan de hamburguesa': ['UNIDAD', 380],
  'Tubo de cannoli': ['UNIDAD', 180],
  // Despensa, aceites y salsas
  'Aceite de oliva': ['MILILITRO', 12],
  'Aceite de girasol': ['MILILITRO', 4],
  Vinagre: ['MILILITRO', 3],
  'Vinagre balsámico': ['MILILITRO', 15],
  'Vinagre de arroz': ['MILILITRO', 7],
  'Salsa de soja': ['MILILITRO', 6],
  Sal: ['GRAMO', 0.5],
  Pimienta: ['GRAMO', 20],
  Orégano: ['GRAMO', 15],
  Piñones: ['GRAMO', 60],
  Mayonesa: ['GRAMO', 5],
  'Salsa barbacoa': ['GRAMO', 6],
  Azúcar: ['GRAMO', 1.2],
  'Dulce de leche': ['GRAMO', 5],
  'Dulce de membrillo': ['GRAMO', 4],
  Chocolate: ['GRAMO', 14],
  'Helado de vainilla': ['GRAMO', 7],
  'Helado de chocolate': ['GRAMO', 7],
  // Sushi
  'Arroz para sushi': ['GRAMO', 3],
  'Alga nori': ['UNIDAD', 120],
  'Alga wakame': ['GRAMO', 60],
  'Pasta de miso': ['GRAMO', 14],
  Tofu: ['GRAMO', 6],
  Sésamo: ['GRAMO', 12],
  'Masa de gyoza': ['UNIDAD', 60],
  // Reventa: las bebidas se venden como vienen y descuentan una unidad.
  'Agua mineral 500 ml': ['UNIDAD', 600],
  'Gaseosa cola 500 ml': ['UNIDAD', 700],
  'Vino Malbec (copa)': ['UNIDAD', 1500],
  'Cerveza rubia (pinta)': ['UNIDAD', 900],
};

const STOCK_INICIAL: Record<UnidadBase, number> = { GRAMO: 20000, MILILITRO: 10000, UNIDAD: 200 };

const receta = (rendimiento: number, instrucciones: string, lineas: LineaSeed[]): RecetaSeed => ({
  rendimiento,
  instrucciones,
  lineas,
});

interface CategoriaSeed {
  nombre: string;
  requiereReceta: boolean;
  admiteObservaciones: boolean;
}
const categoria = (nombre: string, conReceta = true): CategoriaSeed => ({
  nombre,
  requiereReceta: conReceta,
  admiteObservaciones: conReceta,
});
// Las bebidas no llevan receta ni aclaración.
const BEBIDAS = categoria('Bebidas', false);

interface PlatoSeed {
  nombre: string;
  categoria: string;
  precio: number;
  descripcion: string;
  // Ruta de la foto dentro de apps/web/public/fotos-deploy.
  foto: string;
  // Diámetro del plato en que se sirve, para escanearlo; las bebidas no llevan.
  diametroCm?: number;
  receta?: RecetaSeed;
  // Insumo que se revende como viene (sin receta).
  reventa?: string;
}

const BEBIDA_AGUA: PlatoSeed = {
  nombre: 'Agua mineral 500 ml',
  categoria: 'Bebidas',
  precio: 2000,
  descripcion: 'Botella de 500 ml, con o sin gas.',
  foto: 'bebidas/agua-mineral.webp',
  reventa: 'Agua mineral 500 ml',
};
const BEBIDA_GASEOSA: PlatoSeed = {
  nombre: 'Gaseosa cola 500 ml',
  categoria: 'Bebidas',
  precio: 2500,
  descripcion: 'Botella de 500 ml, bien fría.',
  foto: 'bebidas/gaseosa-cola.webp',
  reventa: 'Gaseosa cola 500 ml',
};
const BEBIDA_MALBEC: PlatoSeed = {
  nombre: 'Copa de Malbec',
  categoria: 'Bebidas',
  precio: 4800,
  descripcion: 'Malbec mendocino por copa.',
  foto: 'parrilla/copa-de-vino-tinto.webp',
  reventa: 'Vino Malbec (copa)',
};
const BEBIDA_CERVEZA: PlatoSeed = {
  nombre: 'Pinta de cerveza rubia',
  categoria: 'Bebidas',
  precio: 4200,
  descripcion: 'Rubia tirada, pinta de 473 ml.',
  foto: 'hamburgueseria/cerveza.webp',
  reventa: 'Cerveza rubia (pinta)',
};

interface IntermedioSeed {
  nombre: string;
  receta: RecetaSeed;
  // Con stock arranca en el costo teórico de su receta; sin stock se explota en cada pedido.
  llevaStock?: boolean;
}

interface SucursalSeed {
  nombre: string;
  direccion: string;
  barrio: Barrio;
  // Archivo dentro de apps/web/public/fotos-deploy/sucursales.
  foto: string;
  salon: SalonSeed;
}

interface EmpleadoSeed {
  // Parte local del email: <usuario>@<carpeta>.pgim.test.
  usuario: string;
  nombreCompleto: string;
  rol: string;
  // Índices de SucursalSeed.
  sucursales: number[];
}

// Extras de la parrilla: producción, historial, simulador y modelos RA.
interface DemoSeed {
  modelosRa: readonly ModeloRaSeed[];
  // Empleado de cocina de cada sucursal (por nombre).
  cocinaDe: Record<string, string>;
  semanasHistorial: Record<string, number>;
  prefijoEmailHistorial: string;
  emailReservas: string;
  insumoEscaso: { nombre: string; stock: number };
}

interface RestauranteSeed {
  nombre: string;
  cuit: string;
  carpeta: string;
  sucursales: [SucursalSeed, SucursalSeed];
  categorias: CategoriaSeed[];
  intermedios: IntermedioSeed[];
  platos: PlatoSeed[];
  empleados: EmpleadoSeed[];
  demo?: DemoSeed;
}

// Plantel de los restaurantes chicos: administrador (las dos sucursales), gerente y
// jefe de cocina de la primera, dos mozos y un cocinero por sucursal.
function plantelBasico(nombres: string[]): EmpleadoSeed[] {
  const [admin, gerente, jefe, m1, m2, m3, m4, c1, c2] = nombres as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  return [
    { usuario: 'admin', nombreCompleto: admin, rol: 'Administrador', sucursales: [0, 1] },
    { usuario: 'gerente', nombreCompleto: gerente, rol: 'Gerente de sucursal', sucursales: [0] },
    { usuario: 'cocina', nombreCompleto: jefe, rol: 'Jefe de cocina', sucursales: [0] },
    { usuario: 'mozo', nombreCompleto: m1, rol: 'Mozo', sucursales: [0] },
    { usuario: 'mozo2', nombreCompleto: m2, rol: 'Mozo', sucursales: [0] },
    { usuario: 'mozo3', nombreCompleto: m3, rol: 'Mozo', sucursales: [1] },
    { usuario: 'mozo4', nombreCompleto: m4, rol: 'Mozo', sucursales: [1] },
    { usuario: 'cocinero', nombreCompleto: c1, rol: 'Cocinero', sucursales: [0] },
    { usuario: 'cocinero2', nombreCompleto: c2, rol: 'Cocinero', sucursales: [1] },
  ];
}

const SALSA_CRIOLLA = receta(
  1000,
  'Picar las verduras chico y mezclar con el aceite, el vinagre y la sal.',
  [
    ['Tomate', 400, 'GRAMO', 10],
    ['Cebolla', 300, 'GRAMO', 10],
    ['Morrón', 200, 'GRAMO', 15],
    ['Aceite de oliva', 100, 'MILILITRO'],
    ['Vinagre', 50, 'MILILITRO'],
    ['Sal', 10, 'GRAMO'],
  ],
);

// Pizzas: masa y salsa de tomate de la casa más la cobertura.
const pizza = (cobertura: LineaSeed[]) =>
  receta(1, 'Estirar la masa, salsear, cubrir y hornear a punto de borde dorado.', [
    ['Masa de pizza', 250, 'GRAMO'],
    ['Salsa de tomate', 100, 'GRAMO'],
    ...cobertura,
  ]);

const RESTAURANTES: RestauranteSeed[] = [
  // ───────────────────────────── Pastas ─────────────────────────────
  {
    nombre: 'Nonna Ermelinda',
    cuit: '30000001011',
    carpeta: 'pastas',
    sucursales: [
      {
        nombre: 'Caballito',
        direccion: 'Av. Pedro Goyena 1150',
        barrio: 'CABALLITO',
        foto: 'nonna-ermelinda-caballito.webp',
        salon: SALON_GRANDE,
      },
      {
        nombre: 'Villa Urquiza',
        direccion: 'Av. Monroe 4320',
        barrio: 'VILLA_URQUIZA',
        foto: 'nonna-ermelinda-villa-urquiza.webp',
        salon: SALON_CHICO,
      },
    ],
    categorias: [categoria('Entradas'), categoria('Pastas'), categoria('Postres'), BEBIDAS],
    intermedios: [
      {
        nombre: 'Masa de pasta fresca',
        receta: receta(
          1000,
          'Amasar la harina con los huevos, el aceite y la sal; dejar descansar.',
          [
            ['Harina 000', 700, 'GRAMO'],
            ['Huevo', 7, 'UNIDAD'],
            ['Aceite de oliva', 10, 'MILILITRO'],
            ['Sal', 5, 'GRAMO'],
          ],
        ),
      },
      {
        nombre: 'Salsa de tomate',
        receta: receta(
          1000,
          'Rehogar la cebolla, sumar el tomate y cocinar a fuego bajo con la albahaca.',
          [
            ['Tomate triturado', 800, 'GRAMO'],
            ['Cebolla', 80, 'GRAMO', 10],
            ['Aceite de oliva', 30, 'MILILITRO'],
            ['Albahaca', 10, 'GRAMO'],
            ['Sal', 8, 'GRAMO'],
          ],
        ),
      },
      {
        nombre: 'Salsa bolognesa',
        receta: receta(
          1000,
          'Sellar la carne con las verduras, sumar el tomate y cocinar dos horas.',
          [
            ['Carne molida', 400, 'GRAMO', 5],
            ['Tomate triturado', 500, 'GRAMO'],
            ['Cebolla', 100, 'GRAMO', 10],
            ['Zanahoria', 60, 'GRAMO', 10],
            ['Aceite de oliva', 30, 'MILILITRO'],
            ['Sal', 10, 'GRAMO'],
          ],
        ),
      },
    ],
    platos: [
      {
        nombre: 'Caprese con pesto',
        categoria: 'Entradas',
        precio: 9800,
        descripcion: 'Tomate, mozzarella fresca y pesto de albahaca con piñones.',
        foto: 'pastas/caprese.webp',
        diametroCm: 24,
        receta: receta(1, 'Alternar el tomate y la mozzarella en rodajas; aderezar con el pesto.', [
          ['Tomate', 150, 'GRAMO'],
          ['Mozzarella', 120, 'GRAMO'],
          ['Albahaca', 20, 'GRAMO'],
          ['Queso parmesano', 10, 'GRAMO'],
          ['Aceite de oliva', 25, 'MILILITRO'],
          ['Piñones', 8, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Spaghetti a la bolognesa',
        categoria: 'Pastas',
        precio: 13500,
        descripcion: 'Spaghetti caseros con salsa bolognesa y parmesano.',
        foto: 'pastas/spaghetti-bolognesa.webp',
        diametroCm: 26,
        receta: receta(1, 'Cortar y hervir la pasta; servir con la bolognesa caliente.', [
          ['Masa de pasta fresca', 160, 'GRAMO'],
          ['Salsa bolognesa', 200, 'GRAMO'],
          ['Queso parmesano', 15, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Ravioles de ricota con manteca y salvia',
        categoria: 'Pastas',
        precio: 14500,
        descripcion: 'Ravioles rellenos de ricota, manteca dorada y salvia.',
        foto: 'pastas/ravioles-salvia.webp',
        diametroCm: 26,
        receta: receta(
          1,
          'Rellenar y cerrar los ravioles; hervir y saltear en la manteca con salvia.',
          [
            ['Masa de pasta fresca', 120, 'GRAMO'],
            ['Queso ricota', 100, 'GRAMO'],
            ['Manteca', 30, 'GRAMO'],
            ['Salvia', 8, 'GRAMO'],
            ['Queso parmesano', 15, 'GRAMO'],
            ['Sal', 2, 'GRAMO'],
          ],
        ),
      },
      {
        nombre: 'Ñoquis de papa con tomate y mozzarella',
        categoria: 'Pastas',
        precio: 12800,
        descripcion: 'Ñoquis de papa gratinados con salsa de tomate y mozzarella.',
        foto: 'pastas/noquis-mozzarella.webp',
        diametroCm: 26,
        receta: receta(1, 'Amasar la papa con la harina, cortar y hervir; gratinar con la salsa.', [
          ['Papa', 250, 'GRAMO', 10],
          ['Harina 000', 100, 'GRAMO'],
          ['Huevo', 1, 'UNIDAD'],
          ['Salsa de tomate', 150, 'GRAMO'],
          ['Mozzarella', 60, 'GRAMO'],
          ['Albahaca', 3, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Penne rosa',
        categoria: 'Pastas',
        precio: 12500,
        descripcion: 'Penne con salsa rosa de tomate y crema, y parmesano.',
        foto: 'pastas/penne-salsa-rosa.webp',
        diametroCm: 26,
        receta: receta(1, 'Hervir los penne y saltearlos con la salsa de tomate y la crema.', [
          ['Penne secos', 130, 'GRAMO'],
          ['Salsa de tomate', 120, 'GRAMO'],
          ['Crema de leche', 60, 'MILILITRO'],
          ['Queso parmesano', 15, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Spaghetti al limón y pimienta',
        categoria: 'Pastas',
        precio: 12900,
        descripcion: 'Spaghetti con manteca, ralladura de limón, pimienta y parmesano.',
        foto: 'pastas/pasta-limon-pimienta.webp',
        diametroCm: 26,
        receta: receta(1, 'Hervir la pasta y mantecarla con el limón, la pimienta y el queso.', [
          ['Masa de pasta fresca', 160, 'GRAMO'],
          ['Manteca', 30, 'GRAMO'],
          ['Limón', 40, 'GRAMO'],
          ['Pimienta', 2, 'GRAMO'],
          ['Queso parmesano', 25, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Fettuccine primavera con albahaca',
        categoria: 'Pastas',
        precio: 13200,
        descripcion: 'Fettuccine con verduras de estación y albahaca fresca.',
        foto: 'pastas/pasta-vegetales-albahaca.webp',
        diametroCm: 26,
        receta: receta(
          1,
          'Saltear las verduras en el aceite y mezclar con la pasta recién hervida.',
          [
            ['Masa de pasta fresca', 160, 'GRAMO'],
            ['Zapallito', 80, 'GRAMO'],
            ['Zanahoria', 50, 'GRAMO'],
            ['Tomate', 60, 'GRAMO'],
            ['Albahaca', 5, 'GRAMO'],
            ['Aceite de oliva', 20, 'MILILITRO'],
            ['Queso parmesano', 10, 'GRAMO'],
          ],
        ),
      },
      {
        nombre: 'Tagliatelle con langostinos',
        categoria: 'Pastas',
        precio: 18500,
        descripcion: 'Tagliatelle con langostinos salteados al ajo y tomate.',
        foto: 'pastas/pasta-camarones.webp',
        diametroCm: 27,
        receta: receta(1, 'Saltear los langostinos con ajo, sumar la salsa y la pasta hervida.', [
          ['Masa de pasta fresca', 160, 'GRAMO'],
          ['Langostino', 120, 'GRAMO', 5],
          ['Salsa de tomate', 80, 'GRAMO'],
          ['Aceite de oliva', 20, 'MILILITRO'],
          ['Ajo', 5, 'GRAMO'],
          ['Albahaca', 5, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Cannoli',
        categoria: 'Postres',
        precio: 6500,
        descripcion: 'Dos cannoli crocantes rellenos de ricota dulce y chocolate.',
        foto: 'pastas/cannoli.webp',
        diametroCm: 20,
        receta: receta(
          1,
          'Rellenar los tubos con la ricota azucarada y espolvorear con chocolate.',
          [
            ['Tubo de cannoli', 2, 'UNIDAD'],
            ['Queso ricota', 80, 'GRAMO'],
            ['Azúcar', 25, 'GRAMO'],
            ['Chocolate', 20, 'GRAMO'],
          ],
        ),
      },
      {
        nombre: 'Semifreddo de cannoli',
        categoria: 'Postres',
        precio: 7200,
        descripcion: 'Semifreddo cremoso con sabor a cannoli y chocolate rallado.',
        foto: 'pastas/semifreddo-cannoli.webp',
        diametroCm: 20,
        receta: receta(1, 'Batir las yemas con el azúcar, sumar la ricota y la crema; congelar.', [
          ['Crema de leche', 150, 'MILILITRO'],
          ['Huevo', 2, 'UNIDAD'],
          ['Azúcar', 60, 'GRAMO'],
          ['Queso ricota', 60, 'GRAMO'],
          ['Chocolate', 25, 'GRAMO'],
        ]),
      },
      BEBIDA_MALBEC,
      BEBIDA_AGUA,
    ],
    empleados: plantelBasico([
      'Emilia Ferrari',
      'Gustavo Bianchi',
      'Rosa Ricci',
      'Dante Moretti',
      'Elena Greco',
      'Bruno Conti',
      'Marcela Esposito',
      'Lorenzo Gallo',
      'Pía Romano',
    ]),
  },

  // ───────────────────────────── Parrilla ─────────────────────────────
  {
    nombre: 'Fuego de Quebracho',
    cuit: '30000001038',
    carpeta: 'parrilla',
    sucursales: [
      {
        nombre: 'Palermo',
        direccion: 'Honduras 5320',
        barrio: 'PALERMO',
        foto: 'fuego-de-quebracho-palermo.webp',
        salon: SALON_GRANDE,
      },
      {
        nombre: 'San Telmo',
        direccion: 'Defensa 980',
        barrio: 'SAN_TELMO',
        foto: 'fuego-de-quebracho-san-telmo.webp',
        salon: SALON_CHICO,
      },
    ],
    categorias: [
      categoria('Entradas'),
      categoria('Principales'),
      categoria('Guarniciones'),
      categoria('Postres'),
      BEBIDAS,
    ],
    intermedios: [{ nombre: 'Salsa criolla', receta: SALSA_CRIOLLA, llevaStock: true }],
    platos: [
      {
        nombre: 'Chorizo a la plancha',
        categoria: 'Entradas',
        precio: 6500,
        descripcion: 'Chorizo de cerdo grillado, con salsa criolla.',
        foto: 'parrilla/chorizo-grillado.webp',
        diametroCm: 22,
        receta: receta(1, 'Grillar el chorizo mariposa hasta dorar de los dos lados.', [
          ['Chorizo', 180, 'GRAMO', 5],
          ['Aceite de oliva', 5, 'MILILITRO'],
          ['Salsa criolla', 30, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Ensalada de hojas y espárragos',
        categoria: 'Entradas',
        precio: 7800,
        descripcion: 'Hojas verdes, espárragos, tomate y aceto balsámico.',
        foto: 'parrilla/ensalada-fresca.webp',
        diametroCm: 24,
        receta: receta(
          1,
          'Blanquear los espárragos y mezclar con las hojas y el tomate; aderezar.',
          [
            ['Hojas verdes', 100, 'GRAMO'],
            ['Espárragos', 120, 'GRAMO', 10],
            ['Tomate', 60, 'GRAMO'],
            ['Aceite de oliva', 15, 'MILILITRO'],
            ['Vinagre balsámico', 10, 'MILILITRO'],
            ['Sal', 1, 'GRAMO'],
          ],
        ),
      },
      {
        nombre: 'Bife de chorizo con papas',
        categoria: 'Principales',
        precio: 18000,
        descripcion: 'Bife de 400 g con papas fritas y salsa criolla.',
        foto: 'parrilla/bife-con-papas.webp',
        diametroCm: 30,
        receta: receta(1, 'Sellar el bife a fuego fuerte; freír las papas en bastones.', [
          ['Bife de chorizo', 400, 'GRAMO', 15],
          ['Papa', 300, 'GRAMO', 20],
          ['Aceite de oliva', 30, 'MILILITRO'],
          ['Sal', 5, 'GRAMO'],
          ['Salsa criolla', 80, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Ojo de bife feteado con hongos',
        categoria: 'Principales',
        precio: 21500,
        descripcion: 'Ojo de bife a la parrilla, feteado, con hongos salteados.',
        foto: 'parrilla/bife-feteado.webp',
        diametroCm: 28,
        receta: receta(
          1,
          'Grillar el ojo de bife, fetear y servir con los hongos salteados en manteca.',
          [
            ['Ojo de bife', 350, 'GRAMO', 12],
            ['Hongos', 120, 'GRAMO', 5],
            ['Manteca', 20, 'GRAMO'],
            ['Cebolla', 40, 'GRAMO', 10],
            ['Sal', 3, 'GRAMO'],
          ],
        ),
      },
      {
        nombre: 'Brochette de lomo con verduras',
        categoria: 'Principales',
        precio: 17500,
        descripcion: 'Brochette de lomo con morrón, cebolla y zapallito grillados.',
        foto: 'parrilla/bife-con-verduras.webp',
        diametroCm: 28,
        receta: receta(1, 'Ensartar el lomo y las verduras y grillar hasta que tomen color.', [
          ['Lomo', 300, 'GRAMO', 10],
          ['Morrón', 80, 'GRAMO', 15],
          ['Cebolla', 80, 'GRAMO', 10],
          ['Zapallito', 80, 'GRAMO'],
          ['Aceite de oliva', 15, 'MILILITRO'],
          ['Sal', 3, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Pollo grillado con kale',
        categoria: 'Principales',
        precio: 14500,
        descripcion: 'Pechuga de pollo a la parrilla con kale salteado y limón.',
        foto: 'parrilla/pollo-a-la-parrilla.webp',
        diametroCm: 28,
        receta: receta(1, 'Grillar la pechuga; saltear el kale en aceite y servir con limón.', [
          ['Pechuga de pollo', 300, 'GRAMO', 8],
          ['Kale', 100, 'GRAMO', 10],
          ['Aceite de oliva', 15, 'MILILITRO'],
          ['Limón', 20, 'GRAMO'],
          ['Sal', 3, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Ensalada tibia de pollo y palta',
        categoria: 'Principales',
        precio: 12500,
        descripcion: 'Pollo grillado en tiras con palta, hojas verdes y tomate.',
        foto: 'parrilla/ensalada-con-pollo.webp',
        diametroCm: 26,
        receta: receta(
          1,
          'Grillar el pollo, cortarlo en tiras y mezclar con la palta y las hojas.',
          [
            ['Pechuga de pollo', 200, 'GRAMO', 8],
            ['Palta', 100, 'GRAMO', 25],
            ['Hojas verdes', 80, 'GRAMO'],
            ['Tomate', 60, 'GRAMO'],
            ['Aceite de oliva', 15, 'MILILITRO'],
            ['Limón', 20, 'GRAMO'],
            ['Sal', 1, 'GRAMO'],
          ],
        ),
      },
      {
        nombre: 'Papas fritas',
        categoria: 'Guarniciones',
        precio: 5500,
        descripcion: 'Papas en bastones, bien crocantes.',
        foto: 'parrilla/papas-fritas.webp',
        diametroCm: 22,
        receta: receta(1, 'Cortar en bastones, lavar, secar y freír en dos tiempos.', [
          ['Papa', 350, 'GRAMO', 20],
          ['Aceite de girasol', 60, 'MILILITRO'],
          ['Sal', 3, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Flan casero',
        categoria: 'Postres',
        precio: 5500,
        descripcion: 'Con dulce de leche o crema.',
        foto: 'parrilla/flan.webp',
        diametroCm: 20,
        receta: receta(4, 'Batir, colar y cocinar a baño María en el horno durante 50 minutos.', [
          ['Huevo', 4, 'UNIDAD'],
          ['Leche', 0.5, 'LITRO'],
          ['Azúcar', 150, 'GRAMO'],
          ['Dulce de leche', 60, 'GRAMO'],
        ]),
      },
      BEBIDA_MALBEC,
      BEBIDA_AGUA,
      BEBIDA_GASEOSA,
    ],
    empleados: [
      {
        usuario: 'admin',
        nombreCompleto: 'Facundo Quiroga',
        rol: 'Administrador',
        sucursales: [0, 1],
      },
      {
        usuario: 'gerente',
        nombreCompleto: 'Mónica Ledesma',
        rol: 'Gerente de sucursal',
        sucursales: [0],
      },
      {
        usuario: 'cocina',
        nombreCompleto: 'Ramona Ibarra',
        rol: 'Jefe de cocina',
        sucursales: [0],
      },
      // Plantel de la primera sucursal para la demo del simulador: cinco mozos y dos
      // cocineros (con la jefa de cocina), lo justo para que falte gente en los picos.
      { usuario: 'mozo', nombreCompleto: 'Tomás Peralta', rol: 'Mozo', sucursales: [0] },
      { usuario: 'mozo2', nombreCompleto: 'Valeria Soria', rol: 'Mozo', sucursales: [0] },
      { usuario: 'mozo3', nombreCompleto: 'Ezequiel Maidana', rol: 'Mozo', sucursales: [0] },
      { usuario: 'mozo4', nombreCompleto: 'Noelia Cabrera', rol: 'Mozo', sucursales: [0] },
      { usuario: 'mozo5', nombreCompleto: 'Hugo Barrios', rol: 'Mozo', sucursales: [0] },
      { usuario: 'cocinero', nombreCompleto: 'Celeste Ocampo', rol: 'Cocinero', sucursales: [0] },
      { usuario: 'cocinero2', nombreCompleto: 'Ariel Duarte', rol: 'Cocinero', sucursales: [0] },
      { usuario: 'mozo6', nombreCompleto: 'Brenda Acuña', rol: 'Mozo', sucursales: [1] },
      { usuario: 'mozo7', nombreCompleto: 'Joaquín Villalba', rol: 'Mozo', sucursales: [1] },
      { usuario: 'cocinero3', nombreCompleto: 'Ivana Sosa', rol: 'Cocinero', sucursales: [1] },
    ],
    demo: {
      modelosRa: [
        { plato: 'Flan casero', archivo: 'flan.glb', porcionGramos: 120 },
        { plato: 'Bife de chorizo con papas', archivo: 'bife.glb', porcionGramos: 400 },
      ],
      cocinaDe: {
        Palermo: 'cocina@parrilla.pgim.test',
        'San Telmo': 'cocinero3@parrilla.pgim.test',
      },
      // Primera sucursal con 12 semanas y la segunda con 5, para mostrar el progreso.
      semanasHistorial: { Palermo: 12, 'San Telmo': 5 },
      prefijoEmailHistorial: 'historial-deploy',
      emailReservas: 'reservas-deploy@demo.test',
      // El chorizo no alcanza para la semana próxima (se venden unos 18 kg por semana).
      insumoEscaso: { nombre: 'Chorizo', stock: 10000 },
    },
  },

  // ───────────────────────────── Sushi ─────────────────────────────
  {
    nombre: 'Hoshi Sushi Bar',
    cuit: '30000001046',
    carpeta: 'sushi',
    sucursales: [
      {
        nombre: 'Belgrano',
        direccion: 'Av. Cabildo 2240',
        barrio: 'BELGRANO',
        foto: 'hoshi-sushi-bar-belgrano.webp',
        salon: SALON_GRANDE,
      },
      {
        nombre: 'Puerto Madero',
        direccion: 'Juana Manso 1180',
        barrio: 'PUERTO_MADERO',
        foto: 'hoshi-sushi-bar-puerto-madero.webp',
        salon: SALON_CHICO,
      },
    ],
    categorias: [
      categoria('Entradas'),
      categoria('Piezas y combinados'),
      categoria('Bowls'),
      BEBIDAS,
    ],
    intermedios: [
      {
        nombre: 'Arroz sazonado',
        receta: receta(
          1000,
          'Cocer el arroz y condimentarlo con el vinagre de arroz y el azúcar.',
          [
            ['Arroz para sushi', 450, 'GRAMO'],
            ['Vinagre de arroz', 60, 'MILILITRO'],
            ['Azúcar', 20, 'GRAMO'],
            ['Sal', 8, 'GRAMO'],
          ],
        ),
      },
    ],
    platos: [
      {
        nombre: 'Gyozas de cerdo',
        categoria: 'Entradas',
        precio: 9500,
        descripcion: 'Seis empanaditas japonesas de cerdo y repollo, selladas a la plancha.',
        foto: 'sushi/gyozas.webp',
        diametroCm: 22,
        receta: receta(1, 'Rellenar las masas, sellar en aceite y cocinar al vapor.', [
          ['Masa de gyoza', 6, 'UNIDAD'],
          ['Cerdo molido', 90, 'GRAMO', 5],
          ['Repollo', 40, 'GRAMO', 10],
          ['Salsa de soja', 10, 'MILILITRO'],
          ['Aceite de girasol', 15, 'MILILITRO'],
        ]),
      },
      {
        nombre: 'Sopa miso',
        categoria: 'Entradas',
        precio: 5200,
        descripcion: 'Caldo de miso con tofu y alga wakame.',
        foto: 'sushi/sopa-miso.webp',
        diametroCm: 18,
        receta: receta(
          1,
          'Disolver el miso en el caldo caliente sin hervir y sumar el tofu y el alga.',
          [
            ['Pasta de miso', 30, 'GRAMO'],
            ['Tofu', 60, 'GRAMO'],
            ['Alga wakame', 5, 'GRAMO'],
          ],
        ),
      },
      {
        nombre: 'Combinado Hoshi, 20 piezas',
        categoria: 'Piezas y combinados',
        precio: 32000,
        descripcion: 'Veinte piezas de nigiris y rolls de salmón, langostino y palta.',
        foto: 'sushi/combinado-de-sushi.webp',
        diametroCm: 32,
        receta: receta(1, 'Armar los nigiris y los rolls y acomodarlos en la tabla.', [
          ['Arroz sazonado', 400, 'GRAMO'],
          ['Salmón', 200, 'GRAMO', 5],
          ['Langostino', 80, 'GRAMO', 5],
          ['Palta', 80, 'GRAMO', 25],
          ['Queso crema', 60, 'GRAMO'],
          ['Alga nori', 5, 'UNIDAD'],
          ['Pepino', 60, 'GRAMO', 10],
          ['Salsa de soja', 30, 'MILILITRO'],
        ]),
      },
      {
        nombre: 'Nigiris y rolls, 10 piezas',
        categoria: 'Piezas y combinados',
        precio: 17500,
        descripcion: 'Diez piezas surtidas de nigiris y rolls de salmón.',
        foto: 'sushi/nigiris-y-rolls-en-pizarra.webp',
        diametroCm: 30,
        receta: receta(1, 'Armar las piezas y servir sobre la pizarra con soja.', [
          ['Arroz sazonado', 200, 'GRAMO'],
          ['Salmón', 100, 'GRAMO', 5],
          ['Alga nori', 2, 'UNIDAD'],
          ['Palta', 40, 'GRAMO', 25],
          ['Queso crema', 30, 'GRAMO'],
          ['Salsa de soja', 20, 'MILILITRO'],
        ]),
      },
      {
        nombre: 'Maki de palta y langostino crocante',
        categoria: 'Piezas y combinados',
        precio: 15500,
        descripcion: 'Maki de palta y langostino empanado, con queso crema.',
        foto: 'sushi/maki-rolls.webp',
        diametroCm: 24,
        receta: receta(
          1,
          'Freír los langostinos empanados y enrollarlos con la palta y el arroz.',
          [
            ['Arroz sazonado', 150, 'GRAMO'],
            ['Langostino', 100, 'GRAMO', 5],
            ['Palta', 60, 'GRAMO', 25],
            ['Alga nori', 2, 'UNIDAD'],
            ['Pan rallado', 30, 'GRAMO'],
            ['Aceite de girasol', 60, 'MILILITRO'],
            ['Queso crema', 20, 'GRAMO'],
          ],
        ),
      },
      {
        nombre: 'Roll California',
        categoria: 'Piezas y combinados',
        precio: 13800,
        descripcion: 'Roll invertido de kanikama, palta y pepino con sésamo.',
        foto: 'sushi/roll-california.webp',
        diametroCm: 24,
        receta: receta(1, 'Enrollar con el arroz por fuera y pasar por sésamo.', [
          ['Arroz sazonado', 160, 'GRAMO'],
          ['Kanikama', 80, 'GRAMO'],
          ['Palta', 60, 'GRAMO', 25],
          ['Pepino', 40, 'GRAMO', 10],
          ['Alga nori', 2, 'UNIDAD'],
          ['Sésamo', 10, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Surtido de nigiris y makis, 9 piezas',
        categoria: 'Piezas y combinados',
        precio: 16500,
        descripcion: 'Nueve piezas surtidas de nigiris y makis.',
        foto: 'sushi/nigiris-y-makis-surtidos.webp',
        diametroCm: 26,
        receta: receta(1, 'Armar las piezas y acomodarlas en la tabla.', [
          ['Arroz sazonado', 180, 'GRAMO'],
          ['Salmón', 70, 'GRAMO', 5],
          ['Langostino', 40, 'GRAMO', 5],
          ['Palta', 40, 'GRAMO', 25],
          ['Alga nori', 3, 'UNIDAD'],
          ['Queso crema', 25, 'GRAMO'],
          ['Salsa de soja', 15, 'MILILITRO'],
        ]),
      },
      {
        nombre: 'Poke de salmón',
        categoria: 'Bowls',
        precio: 16800,
        descripcion: 'Bowl de arroz con salmón, palta, pepino, edamame y sésamo.',
        foto: 'sushi/poke-de-salmon.webp',
        diametroCm: 20,
        receta: receta(1, 'Cubetear el salmón, marinarlo en soja y armar el bowl sobre el arroz.', [
          ['Arroz sazonado', 150, 'GRAMO'],
          ['Salmón', 140, 'GRAMO', 5],
          ['Palta', 70, 'GRAMO', 25],
          ['Pepino', 40, 'GRAMO', 10],
          ['Edamame', 50, 'GRAMO'],
          ['Salsa de soja', 20, 'MILILITRO'],
          ['Sésamo', 5, 'GRAMO'],
        ]),
      },
      BEBIDA_AGUA,
      BEBIDA_GASEOSA,
    ],
    empleados: plantelBasico([
      'Akira Nakamura',
      'Julieta Morales',
      'Kenji Tanaka',
      'Sofía Herrera',
      'Mateo Vidal',
      'Camila Sato',
      'Diego Ortiz',
      'Hana Yamamoto',
      'Ramiro Paz',
    ]),
  },

  // ───────────────────────────── Hamburguesería ─────────────────────────────
  {
    nombre: 'Doble Medallón',
    cuit: '30000001054',
    carpeta: 'hamburgueseria',
    sucursales: [
      {
        nombre: 'Colegiales',
        direccion: 'Av. Federico Lacroze 2850',
        barrio: 'COLEGIALES',
        foto: 'doble-medallon-colegiales.webp',
        salon: SALON_GRANDE,
      },
      {
        nombre: 'Almagro',
        direccion: 'Av. Medrano 640',
        barrio: 'ALMAGRO',
        foto: 'doble-medallon-almagro.webp',
        salon: SALON_CHICO,
      },
    ],
    categorias: [
      categoria('Hamburguesas'),
      categoria('Acompañamientos'),
      categoria('Postres'),
      BEBIDAS,
    ],
    intermedios: [],
    platos: [
      {
        nombre: 'Clásica con queso',
        categoria: 'Hamburguesas',
        precio: 11500,
        descripcion: 'Medallón de carne, queso cheddar, lechuga, tomate y mayonesa.',
        foto: 'hamburgueseria/hamburguesa-clasica-con-queso.webp',
        diametroCm: 24,
        receta: receta(
          1,
          'Sellar el medallón en plancha, fundir el queso y armar con el pan tostado.',
          [
            ['Pan de hamburguesa', 1, 'UNIDAD'],
            ['Carne molida', 150, 'GRAMO', 10],
            ['Queso cheddar', 20, 'GRAMO'],
            ['Lechuga', 15, 'GRAMO'],
            ['Tomate', 40, 'GRAMO'],
            ['Mayonesa', 20, 'GRAMO'],
          ],
        ),
      },
      {
        nombre: 'Doble cheddar',
        categoria: 'Hamburguesas',
        precio: 14500,
        descripcion: 'Dos medallones, doble cheddar, cebolla y pepinillos.',
        foto: 'hamburgueseria/hamburguesa-doble-cheddar.webp',
        diametroCm: 24,
        receta: receta(1, 'Sellar los dos medallones, cubrirlos con cheddar y armar.', [
          ['Pan de hamburguesa', 1, 'UNIDAD'],
          ['Carne molida', 300, 'GRAMO', 10],
          ['Queso cheddar', 50, 'GRAMO'],
          ['Cebolla', 20, 'GRAMO', 10],
          ['Pepinillos', 20, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Bacon cheddar',
        categoria: 'Hamburguesas',
        precio: 14000,
        descripcion: 'Medallón, panceta crocante, cheddar y salsa barbacoa.',
        foto: 'hamburgueseria/hamburguesa-con-bacon.webp',
        diametroCm: 24,
        receta: receta(1, 'Dorar la panceta hasta que quede crocante y armar sobre el medallón.', [
          ['Pan de hamburguesa', 1, 'UNIDAD'],
          ['Carne molida', 150, 'GRAMO', 10],
          ['Queso cheddar', 30, 'GRAMO'],
          ['Panceta', 40, 'GRAMO', 10],
          ['Cebolla', 20, 'GRAMO', 10],
          ['Salsa barbacoa', 25, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Pollo crispy',
        categoria: 'Hamburguesas',
        precio: 12800,
        descripcion: 'Pechuga de pollo empanada y frita, lechuga y mayonesa.',
        foto: 'hamburgueseria/hamburguesa-pollo-crispy.webp',
        diametroCm: 24,
        receta: receta(1, 'Empanar la pechuga, freírla y armar con la lechuga y la mayonesa.', [
          ['Pan de hamburguesa', 1, 'UNIDAD'],
          ['Pechuga de pollo', 160, 'GRAMO', 8],
          ['Harina 000', 40, 'GRAMO'],
          ['Huevo', 1, 'UNIDAD'],
          ['Pan rallado', 40, 'GRAMO'],
          ['Lechuga', 15, 'GRAMO'],
          ['Mayonesa', 25, 'GRAMO'],
          ['Aceite de girasol', 80, 'MILILITRO'],
        ]),
      },
      {
        nombre: 'Veggie de porotos y palta',
        categoria: 'Hamburguesas',
        precio: 12500,
        descripcion: 'Medallón de porotos negros, palta, tomate y lechuga.',
        foto: 'hamburgueseria/hamburguesa-vegetariana.webp',
        diametroCm: 24,
        receta: receta(1, 'Pisar los porotos con la cebolla y el pan rallado, formar y dorar.', [
          ['Pan de hamburguesa', 1, 'UNIDAD'],
          ['Porotos negros', 120, 'GRAMO'],
          ['Palta', 50, 'GRAMO', 25],
          ['Cebolla', 20, 'GRAMO', 10],
          ['Pan rallado', 20, 'GRAMO'],
          ['Tomate', 40, 'GRAMO'],
          ['Lechuga', 15, 'GRAMO'],
          ['Aceite de girasol', 20, 'MILILITRO'],
        ]),
      },
      {
        nombre: 'Papas fritas',
        categoria: 'Acompañamientos',
        precio: 5500,
        descripcion: 'Papas en bastones, crocantes y saladas.',
        foto: 'hamburgueseria/papas-fritas.webp',
        diametroCm: 22,
        receta: receta(1, 'Cortar en bastones, lavar, secar y freír en dos tiempos.', [
          ['Papa', 350, 'GRAMO', 20],
          ['Aceite de girasol', 60, 'MILILITRO'],
          ['Sal', 3, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Aros de cebolla',
        categoria: 'Acompañamientos',
        precio: 6200,
        descripcion: 'Aros de cebolla rebozados y fritos.',
        foto: 'hamburgueseria/aros-de-cebolla.webp',
        diametroCm: 22,
        receta: receta(1, 'Pasar los aros por harina, huevo y pan rallado; freír.', [
          ['Cebolla', 200, 'GRAMO', 15],
          ['Harina 000', 60, 'GRAMO'],
          ['Huevo', 1, 'UNIDAD'],
          ['Pan rallado', 50, 'GRAMO'],
          ['Aceite de girasol', 100, 'MILILITRO'],
          ['Sal', 2, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Cookie con chips de chocolate',
        categoria: 'Postres',
        precio: 4800,
        descripcion: 'Cookie recién horneada con chips de chocolate.',
        foto: 'hamburgueseria/cookie.webp',
        diametroCm: 18,
        receta: receta(1, 'Mezclar la masa con los chips, formar y hornear diez minutos.', [
          ['Harina 000', 80, 'GRAMO'],
          ['Manteca', 50, 'GRAMO'],
          ['Azúcar', 50, 'GRAMO'],
          ['Chocolate', 40, 'GRAMO'],
          ['Huevo', 1, 'UNIDAD'],
        ]),
      },
      {
        nombre: 'Sundae de chocolate',
        categoria: 'Postres',
        precio: 6800,
        descripcion: 'Helado de vainilla con salsa de chocolate y crema.',
        foto: 'hamburgueseria/sundae.webp',
        diametroCm: 18,
        receta: receta(1, 'Servir el helado en copa con la salsa de chocolate tibia y la crema.', [
          ['Helado de vainilla', 150, 'GRAMO'],
          ['Chocolate', 40, 'GRAMO'],
          ['Crema de leche', 30, 'MILILITRO'],
        ]),
      },
      BEBIDA_GASEOSA,
      BEBIDA_CERVEZA,
    ],
    empleados: plantelBasico([
      'Leandro Rojas',
      'Agustina Pereyra',
      'Cristian Molina',
      'Florencia Luna',
      'Matías Sandoval',
      'Daniela Fuentes',
      'Gonzalo Navarro',
      'Julián Ríos',
      'Milagros Vera',
    ]),
  },

  // ───────────────────────────── Pizzería ─────────────────────────────
  {
    nombre: 'Horno de Barrio',
    cuit: '30000001062',
    carpeta: 'pizzeria',
    sucursales: [
      {
        nombre: 'Villa Crespo',
        direccion: 'Thames 1380',
        barrio: 'VILLA_CRESPO',
        foto: 'horno-de-barrio-villa-crespo.webp',
        salon: SALON_GRANDE,
      },
      {
        nombre: 'Boedo',
        direccion: 'Av. Boedo 820',
        barrio: 'BOEDO',
        foto: 'horno-de-barrio-boedo.webp',
        salon: SALON_CHICO,
      },
    ],
    categorias: [categoria('Pizzas'), categoria('Postres'), BEBIDAS],
    intermedios: [
      {
        nombre: 'Masa de pizza',
        receta: receta(1000, 'Amasar con la levadura, dejar levar doce horas y estirar.', [
          ['Harina 000', 600, 'GRAMO'],
          ['Levadura', 6, 'GRAMO'],
          ['Sal', 12, 'GRAMO'],
          ['Aceite de oliva', 30, 'MILILITRO'],
        ]),
      },
      {
        nombre: 'Salsa de tomate',
        receta: receta(
          1000,
          'Rehogar la cebolla, sumar el tomate y cocinar a fuego bajo con la albahaca.',
          [
            ['Tomate triturado', 800, 'GRAMO'],
            ['Cebolla', 80, 'GRAMO', 10],
            ['Aceite de oliva', 30, 'MILILITRO'],
            ['Albahaca', 10, 'GRAMO'],
            ['Sal', 8, 'GRAMO'],
          ],
        ),
      },
    ],
    platos: [
      {
        nombre: 'Muzzarella',
        categoria: 'Pizzas',
        precio: 11000,
        descripcion: 'Salsa de tomate, muzzarella y orégano.',
        foto: 'pizzeria/pizza-muzzarella.webp',
        diametroCm: 32,
        receta: pizza([
          ['Mozzarella', 200, 'GRAMO'],
          ['Aceite de oliva', 5, 'MILILITRO'],
          ['Orégano', 1, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Napolitana',
        categoria: 'Pizzas',
        precio: 12800,
        descripcion: 'Muzzarella, rodajas de tomate, ajo y orégano.',
        foto: 'pizzeria/pizza-napolitana.webp',
        diametroCm: 32,
        receta: pizza([
          ['Mozzarella', 180, 'GRAMO'],
          ['Tomate', 80, 'GRAMO'],
          ['Ajo', 5, 'GRAMO'],
          ['Orégano', 1, 'GRAMO'],
          ['Aceite de oliva', 10, 'MILILITRO'],
        ]),
      },
      {
        nombre: 'Pepperoni',
        categoria: 'Pizzas',
        precio: 13800,
        descripcion: 'Muzzarella y rodajas de pepperoni.',
        foto: 'pizzeria/pizza-pepperoni.webp',
        diametroCm: 32,
        receta: pizza([
          ['Mozzarella', 180, 'GRAMO'],
          ['Pepperoni', 70, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Jamón crudo y rúcula',
        categoria: 'Pizzas',
        precio: 15500,
        descripcion: 'Muzzarella, jamón crudo, rúcula fresca y parmesano.',
        foto: 'pizzeria/pizza-jamon-rucula.webp',
        diametroCm: 32,
        receta: pizza([
          ['Mozzarella', 180, 'GRAMO'],
          ['Jamón crudo', 60, 'GRAMO'],
          ['Rúcula', 30, 'GRAMO'],
          ['Queso parmesano', 15, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Rúcula y aceto balsámico',
        categoria: 'Pizzas',
        precio: 13500,
        descripcion: 'Muzzarella, tomate, rúcula, parmesano y aceto balsámico.',
        foto: 'pizzeria/pizza-rucula-balsamico.webp',
        diametroCm: 32,
        receta: pizza([
          ['Mozzarella', 180, 'GRAMO'],
          ['Rúcula', 50, 'GRAMO'],
          ['Vinagre balsámico', 15, 'MILILITRO'],
          ['Queso parmesano', 20, 'GRAMO'],
          ['Tomate', 60, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Morrón verde y aceitunas',
        categoria: 'Pizzas',
        precio: 12900,
        descripcion: 'Muzzarella, morrón verde, cebolla y aceitunas.',
        foto: 'pizzeria/pizza-verdeo-aceitunas.webp',
        diametroCm: 32,
        receta: pizza([
          ['Mozzarella', 180, 'GRAMO'],
          ['Morrón', 80, 'GRAMO', 15],
          ['Aceitunas', 40, 'GRAMO'],
          ['Cebolla', 40, 'GRAMO', 10],
        ]),
      },
      {
        nombre: 'Jamón y champiñones',
        categoria: 'Pizzas',
        precio: 13500,
        descripcion: 'Muzzarella, jamón cocido y champiñones.',
        foto: 'pizzeria/pizza-jamon-champinones.webp',
        diametroCm: 32,
        receta: pizza([
          ['Mozzarella', 180, 'GRAMO'],
          ['Jamón cocido', 70, 'GRAMO'],
          ['Champiñones', 80, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Jamón y cebolla morada',
        categoria: 'Pizzas',
        precio: 13200,
        descripcion: 'Muzzarella, jamón cocido y cebolla morada.',
        foto: 'pizzeria/pizza-jamon-cebolla.webp',
        diametroCm: 32,
        receta: pizza([
          ['Mozzarella', 180, 'GRAMO'],
          ['Jamón cocido', 70, 'GRAMO'],
          ['Cebolla morada', 70, 'GRAMO', 10],
        ]),
      },
      {
        nombre: 'Helado de chocolate',
        categoria: 'Postres',
        precio: 5800,
        descripcion: 'Tres bochas de helado de chocolate con virutas.',
        foto: 'pizzeria/helado-chocolate.webp',
        diametroCm: 18,
        receta: receta(1, 'Servir tres bochas en copa y decorar con virutas de chocolate.', [
          ['Helado de chocolate', 200, 'GRAMO'],
          ['Chocolate', 15, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Flan con caramelo',
        categoria: 'Postres',
        precio: 5200,
        descripcion: 'Flan casero con caramelo.',
        foto: 'pizzeria/flan-caramelo.webp',
        diametroCm: 20,
        receta: receta(4, 'Acaramelar la flanera, volcar la mezcla y cocinar a baño María.', [
          ['Huevo', 4, 'UNIDAD'],
          ['Leche', 0.5, 'LITRO'],
          ['Azúcar', 200, 'GRAMO'],
        ]),
      },
      BEBIDA_CERVEZA,
      BEBIDA_GASEOSA,
    ],
    empleados: plantelBasico([
      'Nicolás Benítez',
      'Carolina Medina',
      'Aldo Cardozo',
      'Lucas Giménez',
      'Rocío Bravo',
      'Federico Aguirre',
      'Sabrina Correa',
      'Walter Núñez',
      'Tamara Silva',
    ]),
  },
  // ───────────────────────────── Bodegón ─────────────────────────────
  {
    nombre: 'El Bodegón de Don Anselmo',
    cuit: '30000001070',
    carpeta: 'bodegon',
    sucursales: [
      {
        nombre: 'Barracas',
        direccion: 'Av. Montes de Oca 1280',
        barrio: 'BARRACAS',
        foto: 'el-bodegon-de-don-anselmo-barracas.webp',
        salon: SALON_GRANDE,
      },
      {
        nombre: 'Flores',
        direccion: 'Av. Rivadavia 6950',
        barrio: 'FLORES',
        foto: 'el-bodegon-de-don-anselmo-flores.webp',
        salon: SALON_CHICO,
      },
    ],
    categorias: [categoria('Entradas'), categoria('Principales'), categoria('Postres'), BEBIDAS],
    intermedios: [
      {
        nombre: 'Estofado de carne',
        receta: receta(
          1000,
          'Dorar la carne, sumar la verdura y el tomate, y cocinar dos horas a fuego bajo.',
          [
            ['Carne para estofado', 500, 'GRAMO', 10],
            ['Tomate triturado', 500, 'GRAMO'],
            ['Cebolla', 150, 'GRAMO', 10],
            ['Zanahoria', 100, 'GRAMO', 10],
            ['Aceite de girasol', 30, 'MILILITRO'],
            ['Sal', 8, 'GRAMO'],
          ],
        ),
      },
      {
        nombre: 'Puré de papas',
        receta: receta(1000, 'Hervir las papas, pisarlas y unir con la manteca y la leche.', [
          ['Papa', 850, 'GRAMO', 15],
          ['Manteca', 60, 'GRAMO'],
          ['Leche', 150, 'MILILITRO'],
          ['Sal', 8, 'GRAMO'],
        ]),
      },
    ],
    platos: [
      {
        nombre: 'Empanadas de carne, para compartir',
        categoria: 'Entradas',
        precio: 16500,
        descripcion: 'Docena de empanadas de carne al horno.',
        foto: 'bodegon/empanadas-de-carne.webp',
        diametroCm: 30,
        receta: receta(1, 'Rehogar la cebolla y la carne, rellenar las tapas y hornear.', [
          ['Harina 000', 400, 'GRAMO'],
          ['Carne molida', 500, 'GRAMO'],
          ['Cebolla', 300, 'GRAMO', 10],
          ['Huevo', 2, 'UNIDAD'],
          ['Aceite de girasol', 40, 'MILILITRO'],
          ['Sal', 8, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Omelette de queso en sartén',
        categoria: 'Entradas',
        precio: 8900,
        descripcion: 'Omelette con queso gratinado y tostadas de la casa.',
        foto: 'bodegon/omelette-de-queso.webp',
        diametroCm: 22,
        receta: receta(1, 'Batir los huevos, cuajar en la sartén y gratinar con el queso.', [
          ['Huevo', 3, 'UNIDAD'],
          ['Queso cheddar', 60, 'GRAMO'],
          ['Tomate', 40, 'GRAMO', 5],
          ['Manteca', 15, 'GRAMO'],
          ['Pan de campo', 80, 'GRAMO'],
          ['Sal', 2, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Tortilla de papas',
        categoria: 'Entradas',
        precio: 9800,
        descripcion: 'Tortilla de papas y cebolla, jugosa.',
        foto: 'bodegon/tortilla-de-papas.webp',
        diametroCm: 24,
        receta: receta(
          1,
          'Freír la papa con la cebolla, unir con el huevo y cuajar de los dos lados.',
          [
            ['Papa', 350, 'GRAMO', 15],
            ['Cebolla', 80, 'GRAMO', 10],
            ['Huevo', 4, 'UNIDAD'],
            ['Aceite de girasol', 50, 'MILILITRO'],
            ['Sal', 4, 'GRAMO'],
          ],
        ),
      },
      {
        nombre: 'Milanesa con papas fritas',
        categoria: 'Principales',
        precio: 15500,
        descripcion: 'Milanesa de nalga con papas fritas y limón.',
        foto: 'bodegon/milanesa-con-papas-fritas.webp',
        diametroCm: 30,
        receta: receta(1, 'Empanar la milanesa, freírla y servir con las papas y el limón.', [
          ['Nalga', 250, 'GRAMO', 10],
          ['Huevo', 1, 'UNIDAD'],
          ['Pan rallado', 60, 'GRAMO'],
          ['Papa', 300, 'GRAMO', 20],
          ['Aceite de girasol', 60, 'MILILITRO'],
          ['Limón', 30, 'GRAMO'],
          ['Sal', 4, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Pollo a la crema con hongos y puré',
        categoria: 'Principales',
        precio: 16200,
        descripcion: 'Pechuga con salsa de crema y hongos, puré y vegetales.',
        foto: 'bodegon/pollo-a-la-crema-con-pure.webp',
        diametroCm: 28,
        receta: receta(
          1,
          'Sellar el pollo, terminarlo en la salsa de crema y servir con el puré.',
          [
            ['Pechuga de pollo', 220, 'GRAMO', 5],
            ['Crema de leche', 120, 'MILILITRO'],
            ['Champiñones', 60, 'GRAMO', 10],
            ['Puré de papas', 200, 'GRAMO'],
            ['Zanahoria', 60, 'GRAMO', 10],
            ['Sal', 4, 'GRAMO'],
          ],
        ),
      },
      {
        nombre: 'Ravioles con estofado',
        categoria: 'Principales',
        precio: 14800,
        descripcion: 'Ravioles de ricota con estofado de carne.',
        foto: 'bodegon/ravioles-con-estofado.webp',
        diametroCm: 24,
        receta: receta(1, 'Hervir los ravioles y saltearlos en el estofado caliente.', [
          ['Harina 000', 110, 'GRAMO'],
          ['Huevo', 1, 'UNIDAD'],
          ['Queso ricota', 100, 'GRAMO'],
          ['Estofado de carne', 200, 'GRAMO'],
          ['Queso parmesano', 10, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Guiso de porotos',
        categoria: 'Principales',
        precio: 13500,
        descripcion: 'Guiso de porotos con carne, verduras y tomate.',
        foto: 'bodegon/guiso-de-porotos.webp',
        diametroCm: 24,
        receta: receta(
          1,
          'Hervir los porotos remojados y terminar la cocción con la carne y la verdura.',
          [
            ['Porotos alubia', 110, 'GRAMO'],
            ['Carne para estofado', 120, 'GRAMO', 10],
            ['Tomate triturado', 120, 'GRAMO'],
            ['Zanahoria', 60, 'GRAMO', 10],
            ['Morrón', 40, 'GRAMO', 15],
            ['Cebolla', 50, 'GRAMO', 10],
            ['Sal', 4, 'GRAMO'],
          ],
        ),
      },
      {
        nombre: 'Flan casero',
        categoria: 'Postres',
        precio: 5800,
        descripcion: 'Flan casero con caramelo.',
        foto: 'bodegon/flan-casero.webp',
        diametroCm: 20,
        receta: receta(4, 'Acaramelar la flanera, volcar la mezcla y cocinar a baño María.', [
          ['Huevo', 4, 'UNIDAD'],
          ['Leche', 0.5, 'LITRO'],
          ['Azúcar', 200, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Panqueques con dulce de leche',
        categoria: 'Postres',
        precio: 6200,
        descripcion: 'Panqueques rellenos de dulce de leche.',
        foto: 'bodegon/panqueques-con-dulce-de-leche.webp',
        diametroCm: 24,
        receta: receta(1, 'Hacer los panqueques en sartén, rellenar y enrollar.', [
          ['Harina 000', 60, 'GRAMO'],
          ['Huevo', 1, 'UNIDAD'],
          ['Leche', 120, 'MILILITRO'],
          ['Manteca', 10, 'GRAMO'],
          ['Dulce de leche', 120, 'GRAMO'],
        ]),
      },
      {
        nombre: 'Queso y dulce',
        categoria: 'Postres',
        precio: 5200,
        descripcion: 'Postre vigilante: queso fresco y dulce de membrillo.',
        foto: 'bodegon/queso-y-dulce.webp',
        diametroCm: 18,
        receta: receta(1, 'Cortar el queso y el dulce en porciones iguales y servir.', [
          ['Queso fresco', 80, 'GRAMO'],
          ['Dulce de membrillo', 80, 'GRAMO'],
        ]),
      },
      BEBIDA_AGUA,
      BEBIDA_GASEOSA,
      BEBIDA_MALBEC,
    ],
    empleados: plantelBasico([
      'Anselmo Peralta',
      'Graciela Sosa',
      'Héctor Villar',
      'Marina Quiroga',
      'Esteban Luna',
      'Noelia Ibarra',
      'Damián Rojas',
      'Beatriz Maldonado',
      'Ramiro Leiva',
    ]),
  },
];

type Tx = Prisma.TransactionClient;

// Insumos que usan las recetas del restaurante (los intermedios no cuentan), en orden
// de aparición, con el costo del catálogo y el stock inicial según la unidad.
function insumosDe(r: RestauranteSeed): InsumoSeed[] {
  const intermedios = new Set(r.intermedios.map((i) => i.nombre));
  const nombres = new Set<string>();
  const recetas = [
    ...r.intermedios.map((i) => i.receta),
    ...r.platos.flatMap((p) => p.receta ?? []),
  ];
  for (const { lineas } of recetas)
    for (const [componente] of lineas) if (!intermedios.has(componente)) nombres.add(componente);
  for (const p of r.platos) if (p.reventa) nombres.add(p.reventa);
  return [...nombres].map((nombre) => {
    const entrada = CATALOGO[nombre];
    if (!entrada) throw new Error(`Falta "${nombre}" en el catálogo de insumos`);
    const [unidadBase, costo] = entrada;
    return { nombre, unidadBase, costo, stock: STOCK_INICIAL[unidadBase] };
  });
}

async function seedSucursales(tx: Tx, restauranteId: string, r: RestauranteSeed) {
  const sucursalIds = new Map<string, string>();
  for (const { nombre, direccion, barrio, foto, salon } of r.sucursales) {
    const datos = {
      direccion,
      barrio,
      fotoUrl: `/fotos-deploy/sucursales/${foto}`,
      horarioApertura: hora('12:00'),
      horarioCierre: hora('00:00'),
      toleranciaNoShowMin: 15,
      activa: true,
    };
    const existente = await tx.sucursal.findFirst({ where: { restauranteId, nombre } });
    const sucursal = existente
      ? await tx.sucursal.update({ where: { id: existente.id }, data: datos })
      : await tx.sucursal.create({ data: { restauranteId, nombre, ...datos } });
    sucursalIds.set(nombre, sucursal.id);

    await tx.horarioServicio.deleteMany({ where: { sucursalId: sucursal.id } });
    await tx.horarioServicio.createMany({
      data: HORARIOS_SERVICIO.map((h) => ({ sucursalId: sucursal.id, ...h })),
    });
    await seedSalon(tx, sucursal.id, salon);
    // Solo se crea: una configuración editada no se pisa al volver a correr el seed.
    await tx.configuracionApertura.upsert({
      where: { sucursalId: sucursal.id },
      update: {},
      create: { sucursalId: sucursal.id, ...CONFIGURACION_APERTURA_POR_DEFECTO },
    });
  }
  return sucursalIds;
}

async function seedEmpleados(
  tx: Tx,
  restauranteId: string,
  r: RestauranteSeed,
  sucursalIds: Map<string, string>,
  permisoIds: Awaited<ReturnType<typeof seedPermisos>>,
  passwordHash: string,
) {
  const rolIds = await crearRolesPredeterminados(tx, restauranteId);
  for (const rol of ROLES_STAFF) {
    rolIds.set(rol.nombre, await upsertRol(tx, restauranteId, rol, false, permisoIds));
  }
  for (const empleado of r.empleados) {
    const email = `${empleado.usuario}@${r.carpeta}.pgim.test`;
    const usuario = await tx.usuario.upsert({
      where: { email },
      update: { passwordHash, activo: true },
      create: { email, passwordHash, tipo: 'EMPLEADO' },
    });
    const datos = {
      restauranteId,
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
      data: empleado.sucursales.map((i) => ({
        empleadoId: usuario.id,
        sucursalId: sucursalIds.get(r.sucursales[i]!.nombre)!,
      })),
    });
  }
}

async function seedMenuEInventario(
  tx: Tx,
  restauranteId: string,
  r: RestauranteSeed,
  sucursalIds: string[],
  adminId: string,
): Promise<string[]> {
  const categoriaIds = new Map<string, string>();
  for (const { nombre, requiereReceta, admiteObservaciones } of r.categorias) {
    const c = await tx.categoria.upsert({
      where: { restauranteId_nombre: { restauranteId, nombre } },
      update: { requiereReceta, admiteObservaciones },
      create: { restauranteId, nombre, requiereReceta, admiteObservaciones },
    });
    categoriaIds.set(nombre, c.id);
  }

  const insumos = insumosDe(r);
  const componentes = new Map<string, string>();
  for (const insumo of insumos) {
    const id = await seedComponente(tx, restauranteId, {
      nombre: insumo.nombre,
      tipo: 'INSUMO',
      unidadBase: insumo.unidadBase,
      costoCompraVigente: insumo.costo,
    });
    componentes.set(insumo.nombre, id);

    // El stock es la suma de los movimientos: la existencia nace con un INGRESO.
    // Solo se crea una vez por sucursal, así que repetir el seed no duplica.
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

  for (const intermedio of r.intermedios) {
    const id = await seedComponente(tx, restauranteId, {
      nombre: intermedio.nombre,
      tipo: 'INTERMEDIO',
      unidadBase: 'GRAMO',
      // Con stock, el intermedio nunca queda sin costo: arranca en el teórico de su receta.
      costoCompraVigente: intermedio.llevaStock
        ? redondearCosto(costoTeoricoDeSeed(intermedio.nombre, 'GRAMO', intermedio.receta, insumos))
        : null,
      llevaStock: intermedio.llevaStock ?? false,
    });
    componentes.set(intermedio.nombre, id);
    await seedReceta(tx, { productoIntermedioId: id }, intermedio.receta, componentes);
  }

  const platoIds: string[] = [];
  for (const plato of r.platos) {
    const datos = {
      categoriaId: categoriaIds.get(plato.categoria)!,
      precio: plato.precio,
      descripcion: plato.descripcion,
      fotoUrl: `/fotos-deploy/${plato.foto}`,
      diametroCm: plato.diametroCm ?? null,
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

async function seedRestaurante(
  r: RestauranteSeed,
  permisoIds: Awaited<ReturnType<typeof seedPermisos>>,
  passwordHash: string,
) {
  return prisma.$transaction(
    async (tx) => {
      const restaurante = await tx.restaurante.upsert({
        where: { cuit: r.cuit },
        update: { nombre: r.nombre },
        create: { nombre: r.nombre, cuit: r.cuit },
      });
      const sucursalIds = await seedSucursales(tx, restaurante.id, r);
      await seedEmpleados(tx, restaurante.id, r, sucursalIds, permisoIds, passwordHash);

      const admin = await tx.usuario.findUniqueOrThrow({
        where: { email: `admin@${r.carpeta}.pgim.test` },
      });
      const platoIds = await seedMenuEInventario(
        tx,
        restaurante.id,
        r,
        [...sucursalIds.values()],
        admin.id,
      );
      const cartaId = await seedMenus(tx, restaurante.id, platoIds, MENUS);
      // Las dos sucursales usan la carta: el historial de ventas sale de ella.
      await tx.sucursal.updateMany({
        where: { id: { in: [...sucursalIds.values()] } },
        data: { menuActivoId: cartaId },
      });
      return { restauranteId: restaurante.id, sucursalIds };
    },
    { timeout: 120_000 },
  );
}

async function main(): Promise<void> {
  const passwordHash = await hashPassword(PASSWORD_DEMO);
  const permisoIds = await prisma.$transaction((tx) => seedPermisos(tx));

  let reservasHistorial = 0;
  for (const r of RESTAURANTES) {
    const { restauranteId, sucursalIds } = await seedRestaurante(r, permisoIds, passwordHash);
    if (!r.demo) continue;
    const { modelosRa, cocinaDe, semanasHistorial, prefijoEmailHistorial, emailReservas } = r.demo;
    await seedModelosRa(restauranteId, modelosRa);
    await seedProduccionDemo(restauranteId, sucursalIds, cocinaDe);
    reservasHistorial = await seedHistorialVentas(
      restauranteId,
      sucursalIds,
      passwordHash,
      semanasHistorial,
      prefijoEmailHistorial,
    );
    const primera = r.sucursales[0].nombre;
    await seedFaltantesSimulador(restauranteId, sucursalIds.get(primera)!, passwordHash, {
      emailCocina: cocinaDe[primera]!,
      emailReservas,
      insumoEscaso: r.demo.insumoEscaso,
    });
  }

  await prisma.$transaction(async (tx) => {
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
  });

  const [restaurantes, sucursales, usuarios, componentes, platos] = await Promise.all([
    prisma.restaurante.count(),
    prisma.sucursal.count(),
    prisma.usuario.count(),
    prisma.componenteInventario.count(),
    prisma.itemMenu.count(),
  ]);
  console.log(
    `Seed de deploy listo: ${restaurantes} restaurantes, ${sucursales} sucursales, ${usuarios} usuarios, ` +
      `${componentes} componentes, ${platos} platos, ${reservasHistorial} reservas de historial (contraseña: ${PASSWORD_DEMO}).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
