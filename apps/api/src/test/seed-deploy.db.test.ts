import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/prisma';
import { limpiarBase } from './db-setup';

afterAll(async () => {
  await limpiarBase();
  await prisma.$disconnect();
});

// Smoke test: la seed de deploy corre contra la base de prueba y es idempotente.
// Se ejecuta como proceso aparte porque corre sola al importarla.
function correrSeed() {
  return spawnSync('npx', ['tsx', 'prisma/seed-deploy.ts'], {
    cwd: path.resolve(__dirname, '../..'),
    env: process.env,
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
    for (const foto of fotos) {
      expect(existsSync(path.resolve(__dirname, '../../../web/public', `.${foto}`))).toBe(true);
    }
    const sinDiametro = await prisma.itemMenu.findMany({
      where: { diametroCm: null },
      select: { categoria: { select: { nombre: true } } },
    });
    expect(new Set(sinDiametro.map((p) => p.categoria.nombre))).toEqual(new Set(['Bebidas']));

    const segunda = correrSeed();
    expect(segunda.status).toBe(0);
    expect(await prisma.restaurante.count()).toBe(6);
    expect(await prisma.sucursal.count()).toBe(sucursales);
    expect(await prisma.itemMenu.count()).toBe(platos);
  }, 60_000);
});
