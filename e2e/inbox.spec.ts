/**
 * E2E tests for the Inbox page.
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'andara14+test-dashboard-admin@gmail.com';

async function loginAndGo(page: Parameters<typeof test>[1], path: string) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
  await page.goto(path);
}

test.describe('Inbox', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGo(page, '/admin/inbox');
  });

  test('renders filter bar and search input', async ({ page }) => {
    await expect(page.locator('button:has-text("Todos")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[placeholder*="Buscar"]')).toBeVisible();
  });

  test('estado filter chips are visible', async ({ page }) => {
    await expect(page.locator('button:has-text("Nuevo")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Respondido")')).toBeVisible();
    await expect(page.locator('button:has-text("Archivado")')).toBeVisible();
  });

  test('direction filters change active state', async ({ page }) => {
    await page.locator('button:has-text("Recibidos")').click();
    await expect(page.locator('button:has-text("Recibidos")')).toHaveClass(/filterBtnActive/, { timeout: 3000 });
  });

  test('search input filters visible emails', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.locator('input[placeholder*="Buscar"]').fill('test');
    await page.waitForTimeout(500);
    await expect(page.locator('[class*="cardList"]')).toBeVisible();
  });

  test('expanding a card shows email body if emails exist', async ({ page }) => {
    await page.waitForTimeout(3000);
    const firstCard = page.locator('[class*="emailCardHeader"]').first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await expect(page.locator('[class*="expandedBody"]')).toBeVisible({ timeout: 5000 });
    }
  });
});
