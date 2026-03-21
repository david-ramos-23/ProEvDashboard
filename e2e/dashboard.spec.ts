/**
 * Tests E2E del Dashboard Admin.
 * 
 * Verifica KPIs, gráficos, tabla de actividad, y navegación sidebar.
 * SOLO usa emails de test — NUNCA usuarios reales.
 */

import { test, expect } from '@playwright/test';

const TEST_ADMIN_EMAIL = 'andara14+test-dashboard-admin@gmail.com';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login como admin de test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[type="email"]', TEST_ADMIN_EMAIL);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
  });

  test('muestra KPIs con datos reales', async ({ page }) => {
    // Esperar a que carguen los KPIs (spinner desaparece)
    await page.waitForSelector('text=Total Alumnos', { timeout: 15000 });
    
    // Verificar que hay al menos un KPI visible
    await expect(page.locator('text=Total Alumnos')).toBeVisible();
    await expect(page.locator('text=Pagados')).toBeVisible();
    await expect(page.locator('text=Engagement')).toBeVisible();
  });

  test('muestra gráfico de alumnos por estado', async ({ page }) => {
    await page.waitForSelector('text=Alumnos por Estado', { timeout: 15000 });
    await expect(page.locator('text=Alumnos por Estado')).toBeVisible();
  });

  test('muestra tabla de actividad reciente', async ({ page }) => {
    await page.waitForSelector('text=Actividad Reciente', { timeout: 15000 });
    await expect(page.locator('text=Actividad Reciente')).toBeVisible();
  });

  test('sidebar navigation funciona correctamente', async ({ page }) => {
    // Esperar a que cargue
    await page.waitForSelector('text=Total Alumnos', { timeout: 15000 });

    // Navegar a Alumnos
    await page.click('nav >> text=Alumnos');
    await page.waitForURL('**/admin/alumnos');
    await expect(page.locator('text=Gestión de Alumnos')).toBeVisible();

    // Navegar a Pagos
    await page.click('nav >> text=Pagos');
    await page.waitForURL('**/admin/pagos');
    await expect(page.locator('text=Portal de Pagos')).toBeVisible();

    // Navegar a Comunicaciones
    await page.click('nav >> text=Comunicaciones');
    await page.waitForURL('**/admin/comunicaciones');

    // Navegar a Ediciones
    await page.click('nav >> text=Ediciones');
    await page.waitForURL('**/admin/ediciones');
  });
});
