import { expect, test, type Locator, type Page } from '@playwright/test';
import { ingresarEmpleado } from '../lib/base';

// CU-14: el administrador arma un borrador arrastrando una mesa, confirma la
// distribución y la posición persiste. Al final devuelve la mesa a su lugar
// (con la misma vía), así que se puede correr cualquier cantidad de veces.

async function abrirSalonDeCentro(page: Page) {
  await ingresarEmpleado(page, 'admin@demo.pgim.test');
  await page.goto('/panel/sucursales');
  await page
    .getByRole('row', { name: /Centro/ })
    .getByRole('button', { name: 'Salón' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: /Salón de Centro/ })).toBeVisible();
  await elegirMesa(page);
}

// El plano de edición no muestra la ocupación y una mesa ocupada no se puede
// mover: se usa la última, que el camino principal (mesa más chica) no toca.
let numeroMesa = 1;
async function elegirMesa(page: Page) {
  const etiqueta = await page
    .getByRole('button', { name: /^Mesa \d+,/ })
    .last()
    .getAttribute('aria-label');
  numeroMesa = Number(/^Mesa (\d+),/.exec(etiqueta ?? '')?.[1]);
}
const mesaLibre = (page: Page) =>
  page.getByRole('button', { name: new RegExp(`^Mesa ${numeroMesa},`) });

async function centro(l: Locator) {
  const caja = await l.boundingBox();
  if (!caja) throw new Error('La mesa no tiene caja visible');
  return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
}

async function arrastrar(page: Page, mesa: Locator, hasta: { x: number; y: number }) {
  const desde = await centro(mesa);
  await page.mouse.move(desde.x, desde.y);
  await page.mouse.down();
  await page.mouse.move((desde.x + hasta.x) / 2, (desde.y + hasta.y) / 2, { steps: 5 });
  await page.mouse.move(hasta.x, hasta.y, { steps: 5 });
  await page.mouse.up();
}

// Espera la respuesta del guardado: recargar antes la cortaría a medias.
async function confirmarDistribucion(page: Page) {
  const guardado = page.waitForResponse(
    (r) => r.url().endsWith('/mesas/distribucion') && r.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Confirmar distribución' }).click();
  expect((await guardado).ok()).toBe(true);
  await expect(page.getByRole('status').filter({ hasText: 'sin confirmar' })).toBeHidden();
}

// Esquina inferior derecha del plano: el seed acomoda las mesas desde arriba a la izquierda.
async function lugarLibre(page: Page) {
  const caja = await page.getByRole('group', { name: 'Mapa del salón' }).boundingBox();
  if (!caja) throw new Error('El plano no tiene caja visible');
  return { x: caja.x + caja.width * 0.85, y: caja.y + caja.height * 0.85 };
}

test('el administrador mueve una mesa, confirma la distribución y queda guardada', async ({
  page,
}) => {
  await abrirSalonDeCentro(page);
  await expect(mesaLibre(page)).toBeVisible();
  const origen = await centro(mesaLibre(page));
  const destino = await lugarLibre(page);

  try {
    await arrastrar(page, mesaLibre(page), destino);
    await expect(page.getByRole('status').filter({ hasText: 'sin confirmar' })).toHaveText(
      '1 mesa movida sin confirmar',
    );
    await confirmarDistribucion(page);

    await page.reload();
    await expect(mesaLibre(page)).toBeVisible();
    const guardada = await centro(mesaLibre(page));
    expect(Math.abs(guardada.x - destino.x)).toBeLessThan(15);
    expect(Math.abs(guardada.y - destino.y)).toBeLessThan(15);
  } finally {
    // Devuelve la mesa a su lugar para la próxima corrida.
    await page.reload();
    await expect(mesaLibre(page)).toBeVisible();
    const actual = await centro(mesaLibre(page));
    if (Math.abs(actual.x - origen.x) > 3 || Math.abs(actual.y - origen.y) > 3) {
      await arrastrar(page, mesaLibre(page), origen);
      await confirmarDistribucion(page);
    }
  }
});

test('con una mesa sin confirmar, volver a Sucursales pide confirmación', async ({ page }) => {
  await abrirSalonDeCentro(page);
  await expect(mesaLibre(page)).toBeVisible();
  await arrastrar(page, mesaLibre(page), await lugarLibre(page));
  await expect(page.getByRole('status').filter({ hasText: 'sin confirmar' })).toBeVisible();

  await page.getByRole('link', { name: '← Sucursales' }).click();
  await expect(page.getByText('Tenés 1 mesa sin confirmar')).toBeVisible();
  await expect(page).toHaveURL(/\/salon$/);

  // Volver deja el borrador; confirmar la salida lo descarta.
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'sin confirmar' })).toBeVisible();

  await page.getByRole('link', { name: '← Sucursales' }).click();
  await page.getByRole('button', { name: 'Salir sin confirmar' }).click();
  await expect(page).toHaveURL(/\/panel\/sucursales$/);
});
