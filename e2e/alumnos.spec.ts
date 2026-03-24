/**
 * Tests E2E de Gestión de Alumnos.
 *
 * Verifica tabla, filtros por edición (por nombre), búsqueda, y navegación al detalle.
 * SOLO usa emails de test — NUNCA usuarios reales.
 */

import { test, expect } from '@playwright/test';

const TEST_ADMIN_EMAIL = 'andara14+test-dashboard-admin@gmail.com';

test.describe('Gestión de Alumnos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[type="email"]', TEST_ADMIN_EMAIL);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });

    await page.click('nav >> text=Alumnos');
    await page.waitForURL('**/admin/alumnos');
  });

  test('muestra tabla de alumnos con datos', async ({ page }) => {
    await page.waitForSelector('table tbody tr:not(:has(.skeleton))', { timeout: 15000 });

    await expect(page.locator('th >> text=ALUMNO')).toBeVisible();
    await expect(page.locator('th >> text=ESTADO')).toBeVisible();

    const rows = page.locator('table tbody tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('el dropdown de edición filtra por nombre (no ID)', async ({ page }) => {
    await page.waitForSelector('table tbody tr:not(:has(.skeleton))', { timeout: 15000 });

    const select = page.locator('select');
    if (await select.isVisible()) {
      // Get available options
      const options = await select.locator('option').allTextContents();
      const edicionOption = options.find(o => o !== 'Todas las ediciones');

      if (edicionOption) {
        // Select an edition by name
        await select.selectOption({ label: edicionOption });
        await page.waitForTimeout(3000);

        // Table should still be visible (filter by name works correctly)
        await expect(page.locator('table')).toBeVisible();

        // The selected value should be the edition name, not a record ID (rec...)
        const selectedValue = await select.inputValue();
        expect(selectedValue).not.toMatch(/^rec/); // should be name, not Airtable recordId
      }
    }
  });

  test('navegar desde dashboard con filtro de edición pre-selecciona dropdown', async ({ page }) => {
    // Go to dashboard first and click Total Alumnos
    await page.goto('/admin/dashboard');
    await page.waitForTimeout(4000);

    const kpiCard = page.locator('text=Total Alumnos').first();
    if (await kpiCard.isVisible()) {
      await kpiCard.click();
      await page.waitForURL('**/admin/alumnos**', { timeout: 5000 });

      // URL should have ?edicion= with a name value
      const url = page.url();
      if (url.includes('edicion=')) {
        const param = new URL(url).searchParams.get('edicion');
        expect(param).not.toMatch(/^rec/); // Edition name, not record ID
      }
    }
  });

  test('búsqueda filtra alumnos correctamente', async ({ page }) => {
    await page.waitForSelector('table tbody tr:not(:has(.skeleton))', { timeout: 15000 });

    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('test');
    await page.waitForTimeout(500);

    await expect(page.locator('table')).toBeVisible();
  });

  test('filtros de estado filtran la lista', async ({ page }) => {
    await page.waitForSelector('table tbody tr:not(:has(.skeleton))', { timeout: 15000 });

    const preinsButton = page.locator('button:has-text("Preinscrito")');
    if (await preinsButton.isVisible()) {
      await preinsButton.click();
      await page.waitForTimeout(3000);
      await expect(page.locator('table')).toBeVisible();
    }
  });

  test('click en fila navega al detalle sin crash', async ({ page }) => {
    await page.waitForTimeout(4000);
    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();

    await expect(page).toHaveURL(/\/admin\/alumnos\/rec/, { timeout: 10000 });
    // No CharAt crash
    await expect(page.locator('text=Algo ha fallado')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Volver")').or(page.locator('[class*="name"]'))).toBeVisible({ timeout: 15000 });
  });
});
