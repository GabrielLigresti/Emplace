import { AppError } from './errors';

// Lee las dimensiones de un JPEG recorriendo sus segmentos hasta el marcador SOF.
// No decodifica la imagen: solo confirma que es un JPEG con cabecera válida.

const NO_ES_JPEG = 'Las fotos tienen que ser JPEG';

// SOF0 a SOF15, salvo DHT (C4), JPG (C8) y DAC (CC), que no son cabeceras de cuadro.
const esSof = (m: number) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

export function leerDimensionesJpeg(archivo: Buffer): { ancho: number; alto: number } {
  if (archivo.length < 4 || archivo[0] !== 0xff || archivo[1] !== 0xd8) {
    throw new AppError(422, NO_ES_JPEG);
  }
  let i = 2;
  while (i + 4 <= archivo.length) {
    if (archivo[i] !== 0xff) throw new AppError(422, NO_ES_JPEG);
    const marcador = archivo[i + 1]!;
    // Relleno 0xFF o marcadores sin longitud (RSTn, SOI, TEM).
    if (marcador === 0xff) {
      i++;
      continue;
    }
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd8)) {
      i += 2;
      continue;
    }
    // Llegó al inicio del escaneo o al final sin encontrar el cuadro.
    if (marcador === 0xda || marcador === 0xd9) break;
    const largo = archivo.readUInt16BE(i + 2);
    if (esSof(marcador)) {
      if (i + 9 > archivo.length) break;
      const alto = archivo.readUInt16BE(i + 5);
      const ancho = archivo.readUInt16BE(i + 7);
      if (ancho === 0 || alto === 0) break;
      return { ancho, alto };
    }
    if (largo < 2) break;
    i += 2 + largo;
  }
  throw new AppError(422, NO_ES_JPEG);
}
