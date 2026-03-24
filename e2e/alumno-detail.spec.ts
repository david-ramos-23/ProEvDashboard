/**
 * E2E tests for the AlumnoDetail page.
 * Navigates to the first alumno in the list and verifies the detail view.
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'andara14+test-dashboard-admin@gmail.com';

test.describe('AlumnoDetail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
    await page.goto('/admin/alumnos');
    await page.waitForURL('**/admin/alumnos');
    // Wait for table to load and click first real row
    await page.waitForTimeout(4000);
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();
    await page.waitForURL(/\/admin\/alumnos\/rec/, { timeout: 10000 });
  });

  test('shows alumno header with name and back button', async ({ page }) => {
    await expect(page.locator('button:has-text("Volver")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows quick stats bar', async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator('[class*="quickStats"]')).toBeVisible({ timeout: 10000 });
  });

  test('tab navigation works — info tab is default', async ({ page }) => {
    await page.waitForTimeout(2000);
    const infoTab = page.locator('button:has-text("Info")').or(page.locator('[class*="tabActive"]')).first();
    await expect(infoTab).toBeVisible({ timeout: 10000 });
  });

  test('clicking revisiones tab loads without crash', async ({ page }) => {
    await page.waitForTimeout(2000);
    const revTab = page.locator('button:has-text("Revisiones")');
    if (await revTab.isVisible()) {
      await revTab.click();
      await page.waitForTimeout(3000);
      // Revisiones tab content or empty state should be visible
      await expect(page.locator('[class*="tabContent"]')).toBeVisible();
    }
  });

  test('clicking pagos tab loads without crash', async ({ page }) => {
    await page.waitForTimeout(2000);
    const pagosTab = page.locator('button:has-text("Pagos")');
    if (await pagosTab.isVisible()) {
      await pagosTab.click();
      await page.waitForTimeout(3000);
      await expect(page.locator('[class*="tabContent"]')).toBeVisible();
    }
  });

  test('back button returns to alumnos list', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Volver")').click();
    await page.waitForURL('**/admin/alumnos', { timeout: 5000 });
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  });
});
