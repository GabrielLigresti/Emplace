import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prisma } from '../lib/prisma';
import { limpiarBase } from './db-setup';

// La seed guarda modelos 3D: van a una carpeta temporal.
const uploads = mkdtempSync(path.join(tmpdir(), 'pgim-seed-'));

afterAll(async () => {
  rmSync(uploads, { recursive: true, force: true });
  await limpiarBase();
  await prisma.$disconnect();
});

// Smoke test: la seed de deploy corre contra la base de prueba y es idempotente.
// Se ejecuta como proceso aparte porque corre sola al importarla.
function correrSeed() {
  return spawnSync('npx', ['tsx', 'prisma/seed-deploy.ts'], {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, UPLOADS_DIR: uploads },
    encoding: 'utf8',
  });
}

describe('seed de deploy', () => {
  it('deja los seis restaurantes y se puede correr dos veces', async () => {
    await limpiarBase();

    const primera = correrSeed();
    expect(primera.status).toBe(0);
    expect(await prisma.restaurante.count()).toBe(6);
    const sucursales = await prisma.sucursal.count();
    const platos = await prisma.itemMenu.count();
    const fotos = (await prisma.sucursal.findMany({ select: { fotoUrl: true } })).map(
      (s) => s.fotoUrl,
    );
    expect(new Set(fotos).size).toBe(sucursales);
    const fotosPlatos = (await prisma.itemMenu.findMany({ select: { fotoUrl: true } })).map(
      (p) => p.fotoUrl,
    );
    for (const foto of [...fotos, ...fotosPlatos]) {
      expect(existsSync(path.resolve(__dirname, '../../../web/public', `.${foto}`))).toBe(true);
    }
    const sinDiametro = await prisma.itemMenu.findMany({
      where: { diametroCm: null },
      select: { categoria: { select: { nombre: true } } },
    });
    expect(new Set(sinDiametro.map((p) => p.categoria.nombre))).toEqual(new Set(['Bebidas']));

    // Como una base sembrada con una versión anterior: sin fotos ni diámetros, salvo
    // uno cargado a mano, y con una mesa del simulador reservada por otro comensal.
    await prisma.sucursal.updateMany({ data: { fotoUrl: null } });
    await prisma.itemMenu.updateMany({ data: { diametroCm: null } });
    const bife = await prisma.itemMenu.findFirstOrThrow({
      where: { nombre: 'Bife de chorizo con papas' },
    });
    await prisma.itemMenu.update({ where: { id: bife.id }, data: { diametroCm: 27.5 } });
    // Cargas del panel: una foto subida y un plato agregado a la carta.
    const gaseosa = await prisma.itemMenu.findFirstOrThrow({
      where: { nombre: 'Gaseosa cola 500 ml' },
      include: { menus: true },
    });
    const subida = '/api/uploads/fotos/subida.jpg';
    await prisma.itemMenu.update({ where: { id: gaseosa.id }, data: { fotoUrl: subida } });
    const agregado = await prisma.itemMenu.create({
      data: {
        restauranteId: gaseosa.restauranteId,
        categoriaId: gaseosa.categoriaId,
        nombre: 'Plato del panel',
        precio: 1000,
        menus: { create: { menuId: gaseosa.menus[0]!.menuId } },
      },
    });
    const comensal = await prisma.usuario.findUniqueOrThrow({
      where: { email: 'comensal@demo.pgim.test' },
    });
    const reservada = await prisma.reserva.findFirstOrThrow({
      where: { comensal: { usuario: { email: 'reservas-deploy@demo.test' } }, estado: 'PENDIENTE' },
    });
    await prisma.reserva.update({
      where: { id: reservada.id },
      data: { comensalId: comensal.id },
    });

    const segunda = correrSeed();
    expect(segunda.status).toBe(0);
    expect(await prisma.restaurante.count()).toBe(6);
    expect(await prisma.sucursal.count()).toBe(sucursales);
    expect(await prisma.itemMenu.count()).toBe(platos + 1);
    expect(await prisma.sucursal.count({ where: { fotoUrl: null } })).toBe(0);
    const bifeDespues = await prisma.itemMenu.findUniqueOrThrow({ where: { id: bife.id } });
    expect(Number(bifeDespues.diametroCm)).toBe(27.5);
    expect(
      await prisma.itemMenu.count({
        where: { diametroCm: null, categoria: { nombre: { not: 'Bebidas' } } },
      }),
    ).toBe(0);
    const gaseosaDespues = await prisma.itemMenu.findUniqueOrThrow({ where: { id: gaseosa.id } });
    expect(gaseosaDespues.fotoUrl).toBe(subida);
    expect(await prisma.menuItem.count({ where: { itemMenuId: agregado.id } })).toBe(1);
    const negra = await prisma.itemMenu.findFirstOrThrow({
      where: { nombre: 'Hamburguesa pan negro' },
      include: { modeloRa: true },
    });
    expect(negra.modeloRa).not.toBeNull();
    const ajena = await prisma.reserva.findUniqueOrThrow({ where: { id: reservada.id } });
    expect(ajena.comensalId).toBe(comensal.id);
  }, 60_000);
});
