/**
 * E2E tests for the dark/light theme toggle.
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'andara14+test-dashboard-admin@gmail.com';

test.describe('Theme Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
  });

  test('theme toggle button is visible in header', async ({ page }) => {
    const toggleBtn = page.locator('button[title*="modo"]');
    await expect(toggleBtn).toBeVisible({ timeout: 10000 });
  });

  test('clicking theme toggle switches data-theme attribute', async ({ page }) => {
    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    const toggleBtn = page.locator('button[title*="modo"]');
    await toggleBtn.click();
    await page.waitForTimeout(200);
    const newTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(newTheme).not.toBe(initialTheme);
  });

  test('theme preference persists after page reload', async ({ page }) => {
    const toggleBtn = page.locator('button[title*="modo"]');
    await toggleBtn.click();
    await page.waitForTimeout(200);
    const themeAfterToggle = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    await page.reload();
    await page.waitForTimeout(500);
    const themeAfterReload = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(themeAfterReload).toBe(themeAfterToggle);
  });
});
