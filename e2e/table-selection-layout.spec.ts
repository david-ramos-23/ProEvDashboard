import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

/**
 * The bulk-selection UI must not move the page.
 *
 * The first attempt moved the actions into the table header, which removed most
 * of the jump but not all of it: `.btn-sm` carries `min-height: 44px` for touch
 * targets while the plain count header sits around 35px, so revealing the
 * actions still grew the header. This measures the real rendered geometry
 * instead of trusting the stylesheet.
 */
test.describe('bulk selection does not shift the layout', () => {
  test('table header keeps its height and position when a row is selected', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/alumnos');

    const header = page.locator('[class*="tableHeader"]').first();
    await header.waitFor({ state: 'visible', timeout: 15000 });

    const rowCheckbox = page.locator('tbody input[type="checkbox"]').first();
    await rowCheckbox.waitFor({ state: 'visible', timeout: 15000 });

    const before = await header.boundingBox();
    const tableBefore = await page.locator('tbody').first().boundingBox();

    await rowCheckbox.check();
    // Let the selection UI render before measuring again.
    await expect(page.locator('text=/\\d+ seleccionad/')).toBeVisible();

    const after = await header.boundingBox();
    const tableAfter = await page.locator('tbody').first().boundingBox();

    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(tableBefore).not.toBeNull();
    expect(tableAfter).not.toBeNull();

    // The header must not grow, and the table body must not move down.
    expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(tableAfter!.y - tableBefore!.y)).toBeLessThanOrEqual(1);
  });
});
