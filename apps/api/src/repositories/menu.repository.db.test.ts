import { prisma } from '../lib/prisma';
import { crearEscenario, limpiarBase } from '../test/db-setup';
import { menuRepository } from './menu.repository';

afterAll(() => prisma.$disconnect());

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
