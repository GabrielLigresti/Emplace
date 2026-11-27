// Tipos de los datos fijos de los restaurantes de la seed de producción.
import type { Barrio } from '@pgim/shared';
import type { ModeloRaSeed, RecetaSeed, SalonSeed } from '../seed-comun';

export interface CategoriaSeed {
  nombre: string;
  requiereReceta: boolean;
  admiteObservaciones: boolean;
}

export interface PlatoSeed {
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

export interface IntermedioSeed {
  nombre: string;
  receta: RecetaSeed;
  // Con stock arranca en el costo teórico de su receta; sin stock se explota en cada pedido.
  llevaStock?: boolean;
}

export interface SucursalSeed {
  nombre: string;
  direccion: string;
  barrio: Barrio;
  // Archivo dentro de apps/web/public/fotos-deploy/sucursales.
  foto: string;
  salon: SalonSeed;
}

export interface RestauranteSeed {
  nombre: string;
  cuit: string;
  carpeta: string;
  // Dominio de los mails del personal.
  dominio: string;
  sucursales: [SucursalSeed, SucursalSeed];
  categorias: CategoriaSeed[];
  intermedios: IntermedioSeed[];
  platos: PlatoSeed[];
  modelosRa?: readonly ModeloRaSeed[];
  // Precio de hoy del plato, sobre el de seed-deploy.ts.
  ajustePrecio: (plato: PlatoSeed) => number;
}
