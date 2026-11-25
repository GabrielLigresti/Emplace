import { expect, test } from '@playwright/test';
import { ingresar } from '../lib/base';

const MENSAJE = 'Email o contraseña incorrectos';

// TP-01-04 (CU-01): el acceso rechaza credenciales incorrectas y campos vacíos
// sin revelar qué dato falló ni crear sesión.
test('TP-01-04: rechaza credenciales incorrectas y campos vacíos sin crear sesión', async ({
  page,
}) => {
  // Paso 1: campos vacíos → el navegador exige completarlos y no se envía nada.
  const intentos: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/auth/login')) intentos.push(r.url());
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  for (const campo of ['Email', 'Contraseña']) {
    const faltante = await page
      .getByLabel(campo)
      .evaluate((el) => (el as HTMLInputElement).validity.valueMissing);
    expect(faltante, `${campo} debería ser obligatorio`).toBe(true);
  }
  expect(intentos).toHaveLength(0);
  await expect(page).toHaveURL(/\/login/);

  // Paso 2: email del Mozo con contraseña incorrecta → credenciales inválidas.
  await ingresar(page, 'mozo@demo.pgim.test', 'contraseña-incorrecta');
  await expect(page.getByRole('alert')).toHaveText(MENSAJE);

  // Paso 3: email inexistente → el mismo mensaje, sin indicar si el email existe.
  await ingresar(page, 'nadie@demo.pgim.test', 'cualquiera');
  await expect(page.getByRole('alert')).toHaveText(MENSAJE);

  // Paso 4: una pantalla protegida redirige al acceso.
  await page.goto('/panel');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
});
