/**
 * Tests E2E del Login del Dashboard ProEv.
 * 
 * SOLO usa emails de test: andara14+test-*@gmail.com
 * NUNCA usuarios reales — sistema en producción.
 */

import { test, expect } from '@playwright/test';

const TEST_ADMIN_EMAIL = 'andara14+test-dashboard-admin@gmail.com';
const INVALID_EMAIL = 'noautorizado@example.com';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    // Limpiar sesión antes de cada test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('muestra el formulario de login correctamente', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('text=ProEv')).toBeVisible();
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText('Acceder');
  });

  test('login con email admin de test redirige al dashboard', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', TEST_ADMIN_EMAIL);
    await page.click('button[type="submit"]');
    
    // Esperar a que se redirija al dashboard
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
    
    // Verificar que el header del dashboard está visible
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('login con email no autorizado muestra error', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', INVALID_EMAIL);
    await page.click('button[type="submit"]');
    
    // Esperar al mensaje de error
    await expect(page.locator('text=no autorizado')).toBeVisible({ timeout: 5000 });
    
    // Verificar que NO redirige
    await expect(page).not.toHaveURL('**/admin/**');
  });

  test('sesión persiste tras recarga', async ({ page }) => {
    await page.goto('/');
    
    // Login
    await page.fill('input[type="email"]', TEST_ADMIN_EMAIL);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
    
    // Recargar
    await page.reload();
    
    // Debería seguir en el dashboard, no en login
    await expect(page).toHaveURL(/admin\/dashboard/);
    await expect(page.locator('h1')).toContainText('Dashboard');
  });
});
