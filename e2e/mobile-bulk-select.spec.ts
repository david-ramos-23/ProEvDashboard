import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

/**
 * Row selection must work at every width.
 *
 * Below 767px DataTable renders cards instead of the table, and that renderer
 * had no notion of `selectable` — no student could be picked and the bulk email
 * entry point did not exist on a phone.
 *
 * This file matches `testMatch: /mobile-/`, so it also runs in the `tablet`
 * project — an iPad Mini at 768px, one pixel above the breakpoint, which gets
 * the DESKTOP table. Rather than exclude that project, the test resolves the
 * layout it is actually looking at and asserts the same behaviour either way:
 * selection is supposed to work in both.
 */
test.describe('bulk selection across layouts', () => {
  test('a row can be selected without navigating, and the bulk action appears', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/alumnos');

    const cards = page.locator('[class*="mobileCard"][data-row-id]');
    const rows = page.locator('tbody tr[data-row-id]');

    // Wait for whichever layout this viewport renders.
    await expect(cards.first().or(rows.first())).toBeVisible({ timeout: 15000 });

    const usesCards = (await cards.count()) > 0;
    const firstItem = usesCards ? cards.first() : rows.first();

    const checkbox = firstItem.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();

    await checkbox.check();

    // Selecting must NOT navigate — the row/card tap target opens the detail.
    await expect(page).toHaveURL(/\/admin\/alumnos$/);

    // And the bulk action must be reachable from the table header.
    await expect(page.locator('text=/\\d+ seleccionad/')).toBeVisible();
    await expect(page.getByRole('button', { name: /env[íi]o masivo|masivo/i })).toBeVisible();
  });
});
