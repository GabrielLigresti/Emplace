// Personal y comensales de la seed de producción. Los nombres llegan por parámetro.
import { uuidDesde, type Azar } from './azar';

export interface NombresEntrada {
  nombres: readonly string[];
  apellidos: readonly string[];
}

export interface EmpleadoGenerado {
  id: string;
  email: string;
  nombreCompleto: string;
  rol: string;
  sucursales: number[];
  arquetipo: 'MOZO' | 'COCINERO' | 'OTRO';
}

export interface ComensalGenerado {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  perfil: 'HABITUAL' | 'OCASIONAL' | 'ESPORADICO';
  preferidos: string[];
  objetivoReservas: number;
}

// Restaurantes entre los que los comensales reparten sus preferencias.
const RESTAURANTES = [
  'Fuego de Quebracho',
  'Hoshi Sushi Bar',
  'Doble Medallón',
  'Horno de Barrio',
  'El Bodegón de Don Anselmo',
  'Nonna Ermelinda',
];

const PROVEEDORES: [string, number][] = [
  ['gmail.com', 60],
  ['hotmail.com', 20],
  ['outlook.com', 12],
  ['yahoo.com', 8],
];

const SIN_TELEFONO = 0.3;

// Minúsculas, sin tildes, ñ -> n y solo letras y números.
function limpiar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function slugMail(nombre: string, apellido: string): string {
  return `${limpiar(nombre)}${limpiar(apellido)}`;
}

// Si el mail ya existe, la segunda persona recibe un sufijo numérico.
function mailUnico(azar: Azar, local: string, dominio: string, usados: Set<string>): string {
  let email = `${local}@${dominio}`;
  for (let intento = 0; usados.has(email); intento++) {
    const sufijo = intento < 20 ? azar.entero(10, 99) : intento * 7 + azar.entero(100, 999);
    email = `${local}${sufijo}@${dominio}`;
  }
  usados.add(email);
  return email;
}

function mezclar<T>(azar: Azar, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = azar.entero(0, i);
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
  }
  return xs;
}

export function armarPlantel(
  azar: Azar,
  restaurante: { nombre: string; dominio: string; sucursales: [string, string] },
  nombres: NombresEntrada,
): EmpleadoGenerado[] {
  const usados = new Set<string>();
  const plantel: EmpleadoGenerado[] = [];
  const agregar = (
    rol: string,
    arquetipo: EmpleadoGenerado['arquetipo'],
    sucursales: number[],
  ): void => {
    const nombre = azar.elegir(nombres.nombres);
    const apellido = azar.elegir(nombres.apellidos);
    plantel.push({
      id: uuidDesde(azar),
      email: mailUnico(azar, slugMail(nombre, apellido), restaurante.dominio, usados),
      nombreCompleto: `${nombre} ${apellido}`,
      rol,
      sucursales,
      arquetipo,
    });
  };

  agregar('Administrador', 'OTRO', [0, 1]);
  for (const s of [0, 1]) {
    agregar('Gerente de sucursal', 'OTRO', [s]);
    agregar('Jefe de cocina', 'COCINERO', [s]);
  }
  // Mozos de las dos sucursales: cuentan dentro del total de cada una.
  const compartidos = azar.entero(1, 2);
  for (let i = 0; i < compartidos; i++) agregar('Mozo', 'MOZO', [0, 1]);
  const mozos = [azar.entero(6, 8), azar.entero(4, 5)];
  const cocineros = [azar.entero(3, 4), azar.entero(2, 3)];
  for (const s of [0, 1]) {
    for (let i = 0; i < mozos[s]! - compartidos; i++) agregar('Mozo', 'MOZO', [s]);
    for (let i = 0; i < cocineros[s]!; i++) agregar('Cocinero', 'COCINERO', [s]);
  }
  return plantel;
}

function telefonoFicticio(azar: Azar): string {
  const parte = (n: number): string => Array.from({ length: n }, () => azar.entero(0, 9)).join('');
  return `+54 9 11 ${azar.entero(2, 6)}${parte(3)}-${parte(4)}`;
}

export function armarComensales(
  azar: Azar,
  cantidad: number,
  nombres: NombresEntrada,
): ComensalGenerado[] {
  const habituales = Math.round(cantidad * 0.2);
  const ocasionales = Math.round(cantidad * 0.45);
  const perfiles = mezclar(
    azar,
    Array.from({ length: cantidad }, (_, i): ComensalGenerado['perfil'] =>
      i < habituales ? 'HABITUAL' : i < habituales + ocasionales ? 'OCASIONAL' : 'ESPORADICO',
    ),
  );
  const usados = new Set<string>();
  return perfiles.map((perfil) => {
    const nombre = azar.elegir(nombres.nombres);
    const apellido = azar.elegir(nombres.apellidos);
    const n = limpiar(nombre);
    const a = limpiar(apellido);
    const estilo = azar.ponderado<'simple' | 'punto' | 'numero'>([
      ['simple', 30],
      ['punto', 35],
      ['numero', 35],
    ]);
    const local =
      estilo === 'punto'
        ? `${n}.${a}`
        : estilo === 'numero'
          ? `${n}${a}${azar.entero(10, 99)}`
          : `${n}${a}`;
    const email = mailUnico(azar, local, azar.ponderado(PROVEEDORES), usados);
    const cuantos =
      perfil === 'HABITUAL'
        ? azar.entero(2, 3)
        : perfil === 'OCASIONAL'
          ? azar.entero(2, 4)
          : azar.entero(1, 2);
    const objetivoReservas =
      perfil === 'HABITUAL'
        ? azar.entero(30, 48)
        : perfil === 'OCASIONAL'
          ? azar.entero(12, 18)
          : azar.entero(3, 8);
    return {
      id: uuidDesde(azar),
      email,
      nombre: `${nombre} ${apellido}`,
      telefono: azar() < SIN_TELEFONO ? null : telefonoFicticio(azar),
      perfil,
      preferidos: mezclar(azar, [...RESTAURANTES]).slice(0, cuantos),
      objetivoReservas,
    };
  });
}
