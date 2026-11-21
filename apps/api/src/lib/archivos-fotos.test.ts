import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { VISTAS } from '@pgim/shared';

// La carpeta de uploads se fija antes de cargar la configuración.
const UPLOADS = mkdtempSync(path.join(tmpdir(), 'pgim-fotos-'));
process.env.UPLOADS_DIR = UPLOADS;
const { CARPETA_ESCANEOS, borrarFotos, guardarFotos, leerFotos } =
  require('./archivos-fotos') as typeof import('./archivos-fotos');

const fotos = () => ({
  front: Buffer.from('f'),
  left: Buffer.from('l'),
  back: Buffer.from('b'),
  right: Buffer.from('r'),
});

describe('archivos de fotos', () => {
  it('guarda las 4 fotos en una carpeta de escaneos y las lee', async () => {
    const ruta = await guardarFotos(fotos());
    expect(path.dirname(ruta)).toBe(CARPETA_ESCANEOS);
    for (const v of VISTAS) expect(existsSync(path.join(ruta, `${v}.jpg`))).toBe(true);
    const leidas = await leerFotos(ruta);
    expect(leidas.left.equals(Buffer.from('l'))).toBe(true);
    expect(leidas.right.equals(Buffer.from('r'))).toBe(true);
  });

  it('borrar dos veces no falla', async () => {
    const ruta = await guardarFotos(fotos());
    await borrarFotos(ruta);
    expect(existsSync(ruta)).toBe(false);
    await expect(borrarFotos(ruta)).resolves.toBeUndefined();
    await expect(borrarFotos(null)).resolves.toBeUndefined();
  });

  it('ignora rutas fuera de la carpeta de escaneos', async () => {
    const afuera = path.join(UPLOADS, 'otro.txt');
    writeFileSync(afuera, 'no se toca');
    await borrarFotos(afuera);
    await borrarFotos(path.join(CARPETA_ESCANEOS, '..'));
    expect(existsSync(afuera)).toBe(true);
  });
});
