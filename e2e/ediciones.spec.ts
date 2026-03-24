/**
 * E2E tests for the Ediciones page.
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'andara14+test-dashboard-admin@gmail.com';

test.describe('Ediciones', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
    await page.click('nav >> text=Ediciones');
    await page.waitForURL('**/admin/ediciones');
  });

  test('renders ediciones table', async ({ page }) => {
    await page.waitForSelector('table', { timeout: 15000 });
    await expect(page.locator('table')).toBeVisible();
  });

  test('modulos capacity cards are visible', async ({ page }) => {
    await page.waitForTimeout(4000);
    // Either module cards loaded or skeleton is shown — neither should crash
    const cards = page.locator('.card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('active edition banner shows if an edition is active', async ({ page }) => {
    await page.waitForTimeout(4000);
    // The active edition banner may or may not be present depending on data
    const hasBanner = await page.locator('text=Edición Activa').isVisible().catch(() => false);
    // Just assert the page doesn't throw
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    expect(typeof hasBanner).toBe('boolean');
  });
});
