import { expect, test } from '@playwright/test';
import { ingresarComensal, ingresarEmpleado } from '../lib/base';

test('el comensal entra a Inicio y al cerrar sesión llega a la landing', async ({ page }) => {
  await ingresarComensal(page, 'comensal@demo.pgim.test');
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Buscá dónde comer' })).toBeVisible();

  // Con sesión, la landing redirige a Inicio.
  await page.goto('/');
  await expect(page).toHaveURL(/\/inicio$/);

  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: /Una mesa/ })).toBeVisible();
});

test('el empleado, al cerrar sesión, llega a la landing', async ({ page }) => {
  await ingresarEmpleado(page, 'gerente@demo.pgim.test');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: /Una mesa/ })).toBeVisible();
});

test('el comensal ve «Mi cuenta» en el tab bar y al tocarla abre su perfil', async ({ page }) => {
  await ingresarComensal(page, 'comensal@demo.pgim.test');
  await expect(page).toHaveURL(/\/inicio$/);

  const tabBar = page.getByRole('navigation', { name: 'Secciones' });
  const cuenta = tabBar.getByRole('link', { name: 'Mi cuenta' });
  await expect(cuenta).toBeVisible();

  await cuenta.click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
  await expect(page.getByLabel('Teléfono (opcional)')).toBeVisible();
});
