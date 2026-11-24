import { prisma } from '../lib/prisma';
import { crearEscenario, limpiarBase } from '../test/db-setup';
import { menuRepository } from './menu.repository';

afterAll(() => prisma.$disconnect());

describe('menuRepository.agregarPlatoAMenu', () => {
  async function platoNuevo(restauranteId: string, menuId: string) {
    const otro = await prisma.menuItem.findFirstOrThrow({
      where: { menuId },
      select: { itemMenu: { select: { categoriaId: true } } },
    });
    return prisma.itemMenu.create({
      data: {
        restauranteId,
        categoriaId: otro.itemMenu.categoriaId,
        nombre: 'Flan',
        precio: 500,
      },
    });
  }

  it('suma el plato y deja el resto de la lista como estaba', async () => {
    await limpiarBase();
    const e = await crearEscenario();
    const antes = await prisma.menuItem.findMany({ where: { menuId: e.menuId } });
    const flan = await platoNuevo(e.restauranteId, e.menuId);

    const menu = await menuRepository.agregarPlatoAMenu(e.restauranteId, e.menuId, flan.id);

    expect(menu.platoIds.sort()).toEqual([...antes.map((i) => i.itemMenuId), flan.id].sort());
  });

  it('no duplica un plato que ya estaba', async () => {
    await limpiarBase();
    const e = await crearEscenario();

    const menu = await menuRepository.agregarPlatoAMenu(e.restauranteId, e.menuId, e.aguaId);

    expect(menu.platoIds.filter((id) => id === e.aguaId)).toHaveLength(1);
  });

  it('no toca un menú de otro restaurante', async () => {
    await limpiarBase();
    const e = await crearEscenario();
    const flan = await platoNuevo(e.restauranteId, e.menuId);

    await expect(
      menuRepository.agregarPlatoAMenu('01900000-0000-7000-8000-0000000000ff', e.menuId, flan.id),
    ).rejects.toThrow();
    expect(await prisma.menuItem.count({ where: { itemMenuId: flan.id } })).toBe(0);
  });
});

// Regresión: tras subir la foto desde la computadora, guardar el plato sin
// fotoUrl no debe borrarla.
describe('menuRepository.actualizarPlato con foto subida', () => {
  const RUTA = '/api/uploads/fotos/foto-subida.jpg';

  it('deja la foto como estaba cuando el dato no llega', async () => {
    await limpiarBase();
    const e = await crearEscenario();
    const plato = await prisma.itemMenu.findUniqueOrThrow({ where: { id: e.aguaId } });
    await menuRepository.guardarFotoPlato(e.restauranteId, e.aguaId, RUTA);

    const editado = await menuRepository.actualizarPlato(e.restauranteId, e.aguaId, {
      categoriaId: plato.categoriaId,
      nombre: 'Agua sin gas',
      precio: 350,
      disponible: true,
    });

    expect(editado.nombre).toBe('Agua sin gas');
    expect(editado.fotoUrl).toBe(RUTA);
    const guardado = await prisma.itemMenu.findUniqueOrThrow({ where: { id: e.aguaId } });
    expect(guardado.fotoUrl).toBe(RUTA);
  });

  it('quita la foto cuando llega vacía o null', async () => {
    await limpiarBase();
    const e = await crearEscenario();
    const plato = await prisma.itemMenu.findUniqueOrThrow({ where: { id: e.aguaId } });
    await menuRepository.guardarFotoPlato(e.restauranteId, e.aguaId, RUTA);

    const editado = await menuRepository.actualizarPlato(e.restauranteId, e.aguaId, {
      categoriaId: plato.categoriaId,
      nombre: 'Agua',
      precio: 300,
      fotoUrl: null,
      disponible: true,
    });

    expect(editado.fotoUrl).toBeNull();
  });
});
