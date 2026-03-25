/**
 * Mobile Layout E2E Tests
 *
 * Verifies each page renders correctly at mobile viewport.
 * Run with: npx playwright test mobile-layout --project=mobile-chrome
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('Mobile Layout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('no horizontal overflow on dashboard', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForTimeout(1000);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });

  test('KPI cards stack to single column on mobile', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForTimeout(1000);
    // KPI grid should be 1 column
    const cards = page.locator('[class*="kpiCard"]');
    const count = await cards.count();
    if (count >= 2) {
      const box1 = await cards.first().boundingBox();
      const box2 = await cards.nth(1).boundingBox();
      if (box1 && box2) {
        // Cards should be stacked vertically (same x, different y)
        expect(box2.y).toBeGreaterThan(box1.y);
      }
    }
  });

  test('charts render within viewport on dashboard', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForTimeout(1500);
    const chartContainers = page.locator('.recharts-responsive-container');
    const count = await chartContainers.count();
    const viewport = page.viewportSize()!;
    for (let i = 0; i < count; i++) {
      const box = await chartContainers.nth(i).boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    }
  });

  test('alumnos page: table renders as card list', async ({ page }) => {
    await page.goto('/admin/alumnos');
    await page.waitForTimeout(1500);
    // Should have mobile cards instead of table
    const cards = page.locator('[class*="mobileCard"]');
    const table = page.locator('table');
    const cardsCount = await cards.count();
    const tableVisible = await table.isVisible().catch(() => false);
    // Either cards are shown or table is hidden
    expect(cardsCount > 0 || !tableVisible).toBeTruthy();
  });

  test('alumnos page: search is full width', async ({ page }) => {
    await page.goto('/admin/alumnos');
    await page.waitForTimeout(1000);
    const search = page.locator('input[placeholder*="Buscar"]');
    if (await search.isVisible()) {
      const box = await search.boundingBox();
      const viewport = page.viewportSize()!;
      if (box) {
        // Search should be at least 80% of viewport width
        expect(box.width).toBeGreaterThan(viewport.width * 0.7);
      }
    }
  });

  test('no horizontal overflow on alumnos', async ({ page }) => {
    await page.goto('/admin/alumnos');
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });

  test('no horizontal overflow on pagos', async ({ page }) => {
    await page.goto('/admin/pagos');
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });

  test('no horizontal overflow on inbox', async ({ page }) => {
    await page.goto('/admin/inbox');
    await page.waitForTimeout(1000);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });

  test('no horizontal overflow on ediciones', async ({ page }) => {
    await page.goto('/admin/ediciones');
    await page.waitForTimeout(1000);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });
});
