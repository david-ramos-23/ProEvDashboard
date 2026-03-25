/**
 * Tests E2E del Dashboard Admin.
 *
 * Verifica KPIs, gráficos, tabla de actividad, y navegación sidebar.
 * SOLO usa emails de test — NUNCA usuarios reales.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('muestra KPIs con datos de edición activa', async ({ page }) => {
    await page.waitForSelector('text=Total Alumnos', { timeout: 15000 });

    await expect(page.locator('text=Total Alumnos')).toBeVisible();
    await expect(page.locator('text=Ingresos Totales')).toBeVisible();
    await expect(page.locator('text=Pendientes Revision')).toBeVisible();

    // The edition dropdown button should be visible in the header
    await expect(page.locator('button[class*="edicionSelect"]')).toBeVisible({ timeout: 5000 });
  });

  test('KPIs no muestran 0 cuando hay edición activa con alumnos', async ({ page }) => {
    await page.waitForSelector('text=Total Alumnos', { timeout: 15000 });
    // Wait for data to load (spinner gone)
    await page.waitForTimeout(3000);

    // Total alumnos should not be 0 when there's an active edition with students
    const totalAlumnosCard = page.locator('text=Total Alumnos').locator('..');
    await expect(totalAlumnosCard).not.toContainText('0', { timeout: 8000 });
  });

  test('muestra gráfico de alumnos por estado', async ({ page }) => {
    await page.waitForSelector('text=Alumnos por Estado', { timeout: 15000 });
    await expect(page.locator('text=Alumnos por Estado')).toBeVisible();
  });

  test('muestra tabla de actividad reciente', async ({ page }) => {
    // Use h3 heading to avoid strict mode violation with "Sin actividad reciente" empty state
    const heading = page.locator('h3', { hasText: 'Actividad Reciente' });
    await heading.waitFor({ timeout: 15000 });
    await expect(heading).toBeVisible();
  });

  test('sidebar navigation — Alumnos', async ({ page }) => {
    await page.waitForSelector('text=Total Alumnos', { timeout: 15000 });
    await page.click('nav >> text=Alumnos');
    await page.waitForURL('**/admin/alumnos');
    await expect(page.locator('h1')).toContainText('Alumnos');
  });

  test('sidebar navigation — Pagos', async ({ page }) => {
    await page.waitForSelector('text=Total Alumnos', { timeout: 15000 });
    await page.click('nav >> text=Pagos');
    await page.waitForURL('**/admin/pagos');
    await expect(page.locator('h1')).toContainText('Pagos');
  });

  test('sidebar navigation — Emails (merged inbox)', async ({ page }) => {
    await page.waitForSelector('text=Total Alumnos', { timeout: 15000 });
    await page.click('nav >> text=Emails');
    await page.waitForURL('**/admin/inbox');
    await expect(page.locator('h1')).toContainText('Emails');
  });

  test('sidebar navigation — Ediciones', async ({ page }) => {
    await page.waitForSelector('text=Total Alumnos', { timeout: 15000 });
    await page.click('nav >> text=Ediciones');
    await page.waitForURL('**/admin/ediciones');
    await expect(page.locator('h1')).toContainText('Ediciones');
  });

  test('redirect de /admin/comunicaciones a /admin/inbox', async ({ page }) => {
    await page.goto('/admin/comunicaciones');
    await page.waitForURL('**/admin/inbox', { timeout: 5000 });
  });

  test('KPI Total Alumnos navega a Alumnos', async ({ page }) => {
    await page.waitForSelector('text=Total Alumnos', { timeout: 15000 });
    await page.waitForTimeout(2000); // let data load
    await page.locator('text=Total Alumnos').locator('..').click();
    await page.waitForURL('**/admin/alumnos**', { timeout: 5000 });
    // KPI navigates to /admin/alumnos (no query params added by default)
    expect(page.url()).toContain('/admin/alumnos');
  });
});
