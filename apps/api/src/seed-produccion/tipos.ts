// Entrada y salida de la operativa de la seed de producción.
import type { Prisma } from '../generated/prisma/client';
import type { Escalon } from './precios';

export interface EstructuraSucursal {
  id: string;
  restaurante: string;
  // La primera sucursal de cada restaurante (salón grande).
  grande: boolean;
  mesas: { id: string; numero: number; capacidad: number }[];
  // Horas "HH:MM"; una franja que termina a las 00:00 llega hasta las 24.
  horarios: { franja: 'ALMUERZO' | 'CENA'; horaInicio: string; horaFin: string }[];
  platos: {
    id: string;
    categoria: string;
    precioHoy: number;
    admiteObservaciones: boolean;
    // Peso relativo: los platos con más peso se piden más.
    popularidad: number;
  }[];
  escalones: Escalon[];
  empleadosCocina: string[];
}

export interface Filas {
  reserva: Prisma.ReservaCreateManyInput[];
  cuenta: Prisma.CuentaMesaCreateManyInput[];
  pedido: Prisma.PedidoCreateManyInput[];
  linea: Prisma.LineaPedidoCreateManyInput[];
  pago: Prisma.PagoCreateManyInput[];
  comprobante: Prisma.ComprobanteCreateManyInput[];
  alerta: Prisma.AlertaCreateManyInput[];
}

export interface CuentaCerrada {
  cuentaMesaId: string;
  reservaId: string;
  comensalId: string;
  restaurante: string;
  sucursalId: string;
  cerradaEn: Date;
  total: number;
  pagoAprobadoId: string;
  // Solo los pedidos que no se cancelaron: son los que consumen stock.
  lineasEntregadas: { id: string; itemMenuId: string; cantidad: number; fecha: Date }[];
}
