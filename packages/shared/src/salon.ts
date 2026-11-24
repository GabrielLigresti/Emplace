import { z } from 'zod';
import type { EstadoPedido, LineaPedidoVista } from './pedido';
import type { ReservaPanel } from './reserva';

// CU-14. El salón es un lienzo fijo en unidades lógicas; la web lo escala al
// ancho de la pantalla. Todas las mesas se dibujan iguales.
export const LIENZO_SALON = { ancho: 100, alto: 60 } as const;

export const mesaInputSchema = z.object({
  numero: z.number().int().min(1).max(999),
  capacidad: z.number().int().min(1).max(20),
  posX: z.number().min(0).max(LIENZO_SALON.ancho),
  posY: z.number().min(0).max(LIENZO_SALON.alto),
  vertical: z.boolean().optional(),
  activa: z.boolean().optional(),
});

export type MesaInput = z.infer<typeof mesaInputSchema>;

export interface Mesa {
  id: string;
  numero: number;
  capacidad: number;
  posX: number;
  posY: number;
  vertical: boolean;
  activa: boolean;
}

// Vista en vivo del salón para el mozo: estado calculado por el servidor.
export type EstadoMesaSalon = 'LIBRE' | 'RESERVADA' | 'OCUPADA';

export interface PedidoSalon {
  id: string;
  numero: number;
  creadoEn: string;
  estado: EstadoPedido;
  lineas: LineaPedidoVista[];
}

export interface MesaSalon {
  id: string;
  numero: number;
  capacidad: number;
  posX: number;
  posY: number;
  vertical: boolean;
  estado: EstadoMesaSalon;
  reserva: ReservaPanel | null;
  pedidos: PedidoSalon[];
}

// Guardado de la distribución del salón: solo las posiciones, en una operación.
export const distribucionInputSchema = z.object({
  mesas: z
    .array(
      z.object({
        id: z.uuid(),
        posX: z.number().min(0).max(LIENZO_SALON.ancho),
        posY: z.number().min(0).max(LIENZO_SALON.alto),
      }),
    )
    .min(1)
    .max(200)
    .refine((mesas) => new Set(mesas.map((m) => m.id)).size === mesas.length, {
      message: 'Hay mesas repetidas',
    }),
});

export type DistribucionInput = z.infer<typeof distribucionInputSchema>;
