import { prisma } from '../lib/prisma';
import { crearEscenario, limpiarBase, type Escenario } from '../test/db-setup';
import { mesaRepository } from './mesa.repository';

afterAll(() => prisma.$disconnect());

let e: Escenario;
let propia1: string;
let propia2: string;

beforeEach(async () => {
  await limpiarBase();
  e = await crearEscenario();
  const m1 = await prisma.mesa.create({
    data: { sucursalId: e.sucursalId, numero: 1, capacidad: 2, posX: 20, posY: 20 },
  });
  const m2 = await prisma.mesa.create({
    data: { sucursalId: e.sucursalId, numero: 2, capacidad: 2, posX: 50, posY: 20 },
  });
  propia1 = m1.id;
  propia2 = m2.id;
});

const posicion = async (id: string) => {
  const m = await prisma.mesa.findUniqueOrThrow({ where: { id } });
  return [Number(m.posX), Number(m.posY)];
};

// Una sucursal con una mesa, en otro restaurante o en el mismo.
async function mesaAjena(mismoRestaurante: boolean) {
  const restauranteId = mismoRestaurante
    ? e.restauranteId
    : (
        await prisma.restaurante.create({
          data: { nombre: 'Otro', cuit: `30-${Date.now()}-1` },
        })
      ).id;
  const sucursal = await prisma.sucursal.create({
    data: {
      restauranteId,
      nombre: 'Otra',
      direccion: 'Calle 1',
      barrio: 'SAN_NICOLAS',
      horarioApertura: new Date('1970-01-01T12:00:00Z'),
      horarioCierre: new Date('1970-01-01T00:00:00Z'),
      toleranciaNoShowMin: 15,
    },
  });
  return prisma.mesa.create({
    data: { sucursalId: sucursal.id, numero: 1, capacidad: 2, posX: 10, posY: 10 },
  });
}

describe('mesaRepository.actualizarPosiciones', () => {
  it('mueve todas las mesas en una operación', async () => {
    await mesaRepository.actualizarPosiciones(e.restauranteId, e.sucursalId, [
      { id: propia1, posX: 30, posY: 40 },
      { id: propia2, posX: 60, posY: 41.5 },
    ]);

    expect(await posicion(propia1)).toEqual([30, 40]);
    expect(await posicion(propia2)).toEqual([60, 41.5]);
  });

  it.each([
    ['otra sucursal del mismo restaurante', true],
    ['otro restaurante', false],
  ])('no mueve mesas de %s y no escribe nada', async (_caso, mismoRestaurante) => {
    const ajena = await mesaAjena(mismoRestaurante);

    await expect(
      mesaRepository.actualizarPosiciones(e.restauranteId, e.sucursalId, [
        { id: propia1, posX: 30, posY: 40 },
        { id: ajena.id, posX: 80, posY: 50 },
      ]),
    ).rejects.toThrow();

    expect(await posicion(propia1)).toEqual([20, 20]);
    expect(await posicion(ajena.id)).toEqual([10, 10]);
  });

  it('si una mesa no existe falla todo y no se escribe ninguna', async () => {
    await expect(
      mesaRepository.actualizarPosiciones(e.restauranteId, e.sucursalId, [
        { id: propia1, posX: 30, posY: 40 },
        { id: '00000000-0000-4000-8000-000000000000', posX: 1, posY: 1 },
        { id: propia2, posX: 60, posY: 40 },
      ]),
    ).rejects.toThrow();

    expect(await posicion(propia1)).toEqual([20, 20]);
    expect(await posicion(propia2)).toEqual([50, 20]);
  });
});
