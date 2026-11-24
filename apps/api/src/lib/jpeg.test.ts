import { jpegFalso } from '../test/jpeg-falso';
import { leerDimensionesJpeg } from './jpeg';

describe('leerDimensionesJpeg', () => {
  it('lee ancho y alto de un JPEG de 640x480', () => {
    expect(leerDimensionesJpeg(jpegFalso(640, 480))).toEqual({ ancho: 640, alto: 480 });
  });

  it('lee también un JPEG progresivo (SOF2)', () => {
    expect(leerDimensionesJpeg(jpegFalso(1280, 720, 0xc2))).toEqual({ ancho: 1280, alto: 720 });
  });

  it('un PNG lanza 422', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(() => leerDimensionesJpeg(png)).toThrow(
      expect.objectContaining({ status: 422, message: 'Las fotos tienen que ser JPEG' }),
    );
  });

  it('un JPEG truncado sin SOF lanza 422', () => {
    expect(() => leerDimensionesJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toThrow(
      expect.objectContaining({ status: 422 }),
    );
  });

  it('dimensiones en cero lanzan 422', () => {
    expect(() => leerDimensionesJpeg(jpegFalso(0, 480))).toThrow(
      expect.objectContaining({ status: 422 }),
    );
  });
});
