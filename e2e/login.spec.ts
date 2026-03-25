/**
 * Tests E2E del Login del Dashboard ProEv.
 *
 * SOLO usa emails de test: andara14+test-*@gmail.com
 * NUNCA usuarios reales — sistema en producción.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, TEST_ADMIN_EMAIL } from './helpers/login';

const INVALID_EMAIL = 'noautorizado@example.com';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('muestra el logo FOCUS y el badge ProEv', async ({ page }) => {
    await page.goto('/');
    // FOCUS logo image
    await expect(page.locator('img[alt="FOCUS Dance Studio"]')).toBeVisible();
    // ProEv badge text
    await expect(page.locator('text=ProEv')).toBeVisible();
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('muestra el formulario de login correctamente', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    // Google sign-in button
    await expect(page.locator('text=Continuar con Google')).toBeVisible();
  });

  test('botón de submit deshabilitado con campo vacío', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    await page.fill('input[type="email"]', TEST_ADMIN_EMAIL);
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('login con email admin de test redirige al dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('login con email no autorizado muestra error', async ({ page }) => {
    await page.goto('/');

    await page.fill('input[type="email"]', INVALID_EMAIL);
    await page.click('button[type="submit"]');

    await expect(page.locator('text=no autorizado')).toBeVisible({ timeout: 5000 });
    await expect(page).not.toHaveURL('**/admin/**');
  });

  test('sesión persiste tras recarga', async ({ page }) => {
    await loginAsAdmin(page);
    await page.reload();

    await expect(page).toHaveURL(/admin\/dashboard/);
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('usuario sin sesión es redirigido al login desde ruta protegida', async ({ page }) => {
    // Clear session first
    await page.evaluate(() => localStorage.clear());
    await page.goto('/admin/alumnos');
    // Should redirect to login (root)
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
  });
});
