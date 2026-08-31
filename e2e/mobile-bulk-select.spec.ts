import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

/**
 * Below 767px DataTable renders cards instead of the table, and that renderer
 * had no notion of `selectable` — so no student could be picked and the bulk
 * email entry point simply did not exist on a phone.
 */
test.describe('bulk selection on mobile', () => {
  test('a card can be selected and the bulk action appears', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/alumnos');

    const firstCard = page.locator('[class*="mobileCard"][data-row-id]').first();
    await firstCard.waitFor({ state: 'visible', timeout: 15000 });

    const checkbox = firstCard.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();

    await checkbox.check();

    // Selecting must NOT navigate — the card's own tap target opens the detail.
    await expect(page).toHaveURL(/\/admin\/alumnos$/);

    // And the bulk action must now be reachable.
    await expect(page.locator('text=/\\d+ seleccionad/')).toBeVisible();
    await expect(page.getByRole('button', { name: /env[íi]o masivo|masivo/i })).toBeVisible();
  });
});
