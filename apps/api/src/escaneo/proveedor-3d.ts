import type { UmbralesCalidad, VistaEscaneo } from '@pgim/shared';

// Un proveedor convierte las 4 fotos de un plato en un modelo 3D. El servicio
// del escaneo lo usa solo a través de esta interfaz.

// Una foto JPEG por vista.
export type FotosEscaneo = Record<VistaEscaneo, Buffer>;

export type ResultadoEscaneo =
  | { estado: 'EN_PROCESO' }
  | { estado: 'LISTO'; glb: Buffer; usdz?: Buffer }
  | { estado: 'FALLIDO'; motivo: string };

export interface Proveedor3D {
  readonly nombre: string;
  // Lo que le exige a las fotos para poder procesarlo.
  requisitos(): UmbralesCalidad;
  // Envía las fotos y devuelve el id de la tarea en el proveedor.
  iniciar(fotos: FotosEscaneo): Promise<string>;
  consultar(tareaId: string): Promise<ResultadoEscaneo>;
}
