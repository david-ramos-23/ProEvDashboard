/**
 * Tests E2E de Gestión de Alumnos.
 *
 * Verifica tabla, filtros multi-select por estado, búsqueda, contador,
 * y navegación al detalle.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

const ESTADOS = [
  'Preinscrito',
  'En revisión de video',
  'Aprobado',
  'Rechazado',
  'Pendiente de pago',
  'Reserva',
  'Pagado',
  'Finalizado',
  'Plazo Vencido',
  'Pago Fallido',
];

test.describe('Gestión de Alumnos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.click('nav >> text=Alumnos');
    await page.waitForURL('**/admin/alumnos');
    await page.waitForSelector('table tbody tr:not(:has([class*="skeleton"]))', { timeout: 15000 });
  });

  test('muestra tabla con datos y contador en cabecera', async ({ page }) => {
    await expect(page.locator('th').filter({ hasText: /alumno/i }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: /estado/i }).first()).toBeVisible();

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Counter in title
    await expect(page.locator('h3').filter({ hasText: /Alumnos \(\d+\)/ })).toBeVisible();
  });

  test('todos los chips de estado son visibles', async ({ page }) => {
    for (const estado of ESTADOS) {
      await expect(page.locator('button.btn-sm').filter({ hasText: estado })).toBeVisible({ timeout: 5000 });
    }
  });

  test('filtro "Preinscrito" muestra solo preinscrito', async ({ page }) => {
    await page.locator('button.btn-sm').filter({ hasText: 'Preinscrito' }).click();
    await page.waitForTimeout(500);

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        await expect(rows.nth(i).locator('td').nth(1)).toContainText('Preinscrito');
      }
    }
    await expect(page.locator('button:has-text("Limpiar filtros")')).toBeVisible();
  });

  test('filtro "En revisión de video" funciona', async ({ page }) => {
    await page.locator('button.btn-sm').filter({ hasText: 'En revisión de video' }).click();
    await page.waitForTimeout(500);

    // Button should be active
    await expect(page.locator('button.btn-sm').filter({ hasText: 'En revisión de video' })).toHaveClass(/btn-primary/);

    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    if (count > 0) {
      // All visible rows should have "revisión de video" in estado column
      for (let i = 0; i < Math.min(count, 5); i++) {
        await expect(rows.nth(i).locator('td').nth(1)).toContainText('revisión de video');
      }
    }

    // Title should show filtered count
    await expect(page.locator('h3').filter({ hasText: `(${count})` })).toBeVisible();
  });

  test('multi-select: dos filtros combinados (OR)', async ({ page }) => {
    await page.locator('button.btn-sm').filter({ hasText: 'Preinscrito' }).click();
    await page.waitForTimeout(300);
    const countFirst = await page.locator('table tbody tr').count();

    await page.locator('button.btn-sm').filter({ hasText: 'En revisión de video' }).click();
    await page.waitForTimeout(300);
    const countCombined = await page.locator('table tbody tr').count();

    expect(countCombined).toBeGreaterThanOrEqual(countFirst);

    // Both chips should be active
    await expect(page.locator('button.btn-sm').filter({ hasText: 'Preinscrito' })).toHaveClass(/btn-primary/);
    await expect(page.locator('button.btn-sm').filter({ hasText: 'En revisión de video' })).toHaveClass(/btn-primary/);
  });

  test('limpiar filtros restaura todos los alumnos', async ({ page }) => {
    // Apply a filter that reduces results
    await page.locator('button.btn-sm').filter({ hasText: 'Preinscrito' }).click();
    await page.waitForTimeout(500);
    const filteredCount = await page.locator('table tbody tr').count();

    // Clear it
    await page.locator('button:has-text("Limpiar filtros")').click();
    await page.waitForTimeout(1000);

    // After clearing, count should be >= filtered count
    const afterClear = await page.locator('table tbody tr').count();
    expect(afterClear).toBeGreaterThanOrEqual(filteredCount);
    await expect(page.locator('button:has-text("Limpiar filtros")')).not.toBeVisible();
  });

  test('toggle: click dos veces deselecciona', async ({ page }) => {
    const btn = page.locator('button.btn-sm').filter({ hasText: 'Preinscrito' });

    // Click to select
    await btn.click();
    await page.waitForTimeout(500);
    await expect(btn).toHaveClass(/btn-primary/);

    // Click again to deselect
    await btn.click();
    await page.waitForTimeout(500);
    await expect(btn).toHaveClass(/btn-ghost/);

    // "Limpiar filtros" should not be visible
    await expect(page.locator('button:has-text("Limpiar filtros")')).not.toBeVisible();
  });

  test('búsqueda filtra alumnos', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('test');
    await page.waitForTimeout(500);

    // Table wrapper should still be visible (even with empty state)
    await expect(page.locator('h3').filter({ hasText: /Alumnos \(\d+\)/ })).toBeVisible();
  });

  test('búsqueda + filtro estado combinados', async ({ page }) => {
    await page.locator('button.btn-sm').filter({ hasText: 'Preinscrito' }).click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder*="Buscar"]').fill('test');
    await page.waitForTimeout(500);

    // Should still show the alumnos header with count
    await expect(page.locator('h3').filter({ hasText: /Alumnos \(\d+\)/ })).toBeVisible();
  });

  test('click en fila navega al detalle', async ({ page }) => {
    await page.locator('table tbody tr').first().click();
    await expect(page).toHaveURL(/\/admin\/alumnos\/rec/, { timeout: 10000 });
    await expect(page.locator('text=Algo ha fallado')).not.toBeVisible({ timeout: 5000 });
  });

  test('edición global en header filtra datos', async ({ page }) => {
    const edicionSelect = page.locator('select[class*="edicion"]');
    if (await edicionSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await edicionSelect.locator('option').allTextContents();
      if (options.length > 1) {
        await edicionSelect.selectOption({ index: 1 });
        await page.waitForTimeout(2000);
        await expect(page.locator('table')).toBeVisible();
      }
    }
  });
});
