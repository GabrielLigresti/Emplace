import { expect, test } from '@playwright/test';

// Portada pública: el carrusel de "Ver en mi mesa" y el cierre, sin sesión.
test('el carrusel avanza, se pausa y el cierre lleva al buscador', async ({ page }) => {
  await page.goto('/');

  const carrusel = page.getByRole('region', { name: 'Ver en mi mesa' });
  await expect(carrusel.getByRole('heading', { name: 'Ver en mi mesa' })).toBeVisible();

  await carrusel.getByRole('button', { name: 'Plato siguiente' }).click();
  await expect(carrusel.getByRole('heading', { name: 'Giralo con el dedo' })).toBeVisible();

  await carrusel.getByRole('button', { name: 'Pausar el carrusel' }).click();
  await expect(carrusel.getByRole('button', { name: 'Reanudar el carrusel' })).toBeVisible();

  await page.getByRole('button', { name: 'Buscar restaurantes' }).click();
  await expect(page.getByRole('searchbox', { name: 'Buscar' })).toBeFocused();
});
