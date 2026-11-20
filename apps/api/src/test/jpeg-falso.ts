// JPEG mínimo para tests: SOI, un APP0 de relleno, un SOF con las dimensiones y EOI.
// No se puede decodificar; alcanza para leerle el tamaño.
export function jpegFalso(ancho: number, alto: number, marcadorSof = 0xc0): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]);
  const sof = Buffer.from([
    0xff,
    marcadorSof,
    0x00,
    0x0b,
    0x08,
    alto >> 8,
    alto & 0xff,
    ancho >> 8,
    ancho & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
  ]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.from([0xff, 0xd9])]);
}
