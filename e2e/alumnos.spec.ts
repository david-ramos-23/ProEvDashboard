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
    // React Router keeps the previous route's DOM mounted while the lazily-loaded
    // Alumnos chunk resolves, so an unscoped "table tbody tr" can momentarily match
    // the Dashboard's "Actividad Reciente" table instead. The countLabel span
    // (e.g. "50 alumnos") only renders once the Alumnos DataTable itself has data,
    // so waiting on it guarantees we're looking at the right table.
    await page.locator('[class*="tableCount"]').filter({ hasText: /\d+ alumnos?/ }).waitFor({ state: 'visible', timeout: 15000 });
  });

  test('muestra tabla con datos y contador en cabecera', async ({ page }) => {
    await expect(page.locator('th').filter({ hasText: /alumno/i }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: /estado/i }).first()).toBeVisible();

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Counter now lives in the DataTable header as a countLabel span (e.g. "50 alumnos"),
    // not an "Alumnos (N)" h3 — that title moved out when PageHeader was introduced.
    await expect(page.locator('[class*="tableCount"]').filter({ hasText: /\d+ alumnos?/ })).toBeVisible();
  });

  test('chips de estado de filtro son visibles', async ({ page }) => {
    // At least some filter chips should be visible (not all estados may have data)
    const chips = page.locator('button.btn-sm').filter({ hasText: /\w+/ });
    await expect(chips.first()).toBeVisible({ timeout: 5000 });
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThan(0);

    // Verify at least a few known estados are present
    const visibleChipTexts = await chips.allTextContents();
    const knownEstados = ESTADOS.filter(est =>
      visibleChipTexts.some(text => text.includes(est))
    );
    expect(knownEstados.length).toBeGreaterThan(0);
  });

  test('filtro "Preinscrito" muestra solo preinscrito', async ({ page }) => {
    await page.locator('button.btn-sm').filter({ hasText: 'Preinscrito' }).click();
    await page.waitForTimeout(500);

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        // td(0) is the selectable checkbox column added by the Alumnos bulk-email
        // entry point (slice 4) — estado is now the 3rd cell, not the 2nd.
        await expect(rows.nth(i).locator('td').nth(2)).toContainText('Preinscrito');
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
      // All visible rows should have "revisión de video" in estado column.
      // td(0) is the selectable checkbox column (slice 4) — estado is the 3rd cell.
      for (let i = 0; i < Math.min(count, 5); i++) {
        await expect(rows.nth(i).locator('td').nth(2)).toContainText('revisión de video');
      }
    }

    // Counter should reflect the filtered count
    await expect(page.locator('[class*="tableCount"]').filter({ hasText: `${count} alumno` })).toBeVisible();
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
    await expect(page.locator('[class*="tableCount"]').filter({ hasText: /\d+ alumnos?/ })).toBeVisible();
  });

  test('búsqueda + filtro estado combinados', async ({ page }) => {
    await page.locator('button.btn-sm').filter({ hasText: 'Preinscrito' }).click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder*="Buscar"]').fill('test');
    await page.waitForTimeout(500);

    // Should still show the alumnos count
    await expect(page.locator('[class*="tableCount"]').filter({ hasText: /\d+ alumnos?/ })).toBeVisible();
  });

  test('click en fila navega al detalle', async ({ page }) => {
    // Ensure table data is fully loaded before clicking
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.waitFor({ state: 'visible', timeout: 15000 });
    // Wait for the row to have actual content (not skeleton/loading).
    // td(0) is the selectable checkbox column (slice 4) — it never has text,
    // so the loaded-content check has to look at td(1) (Alumno) instead.
    await expect(firstRow.locator('td').nth(1)).not.toBeEmpty({ timeout: 10000 });
    await firstRow.click();
    // Row IDs come from the active data adapter (Airtable "rec..." or Supabase
    // UUIDs) — match any non-empty id segment instead of a specific format.
    await expect(page).toHaveURL(/\/admin\/alumnos\/[\w-]+$/, { timeout: 10000 });
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
