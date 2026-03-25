/**
 * Mobile Login E2E Tests
 *
 * Verifies login page works correctly on mobile viewports.
 * Run with: npx playwright test mobile-login --project=mobile-chrome
 */

import { test, expect } from '@playwright/test';

test.describe('Mobile Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('login card fills screen on mobile', async ({ page }) => {
    await page.waitForTimeout(500);
    const viewport = page.viewportSize()!;

    // Card or container should fill the viewport width
    const card = page.locator('[class*="card"]').first();
    if (await card.isVisible()) {
      const box = await card.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);
      }
    }
  });

  test('email input does not trigger iOS zoom (font-size >= 16px)', async ({ page }) => {
    const input = page.locator('input[type="email"]');
    await expect(input).toBeVisible();

    const fontSize = await input.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).fontSize)
    );
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  test('submit button is large and tappable', async ({ page }) => {
    const btn = page.locator('button[type="submit"]');
    await expect(btn).toBeVisible();

    const box = await btn.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('video background is hidden on mobile', async ({ page }) => {
    await page.waitForTimeout(500);
    const video = page.locator('video');
    if (await video.count() > 0) {
      const display = await video.evaluate((el) =>
        window.getComputedStyle(el).display
      );
      expect(display).toBe('none');
    }
  });

  test('no horizontal overflow on login page', async ({ page }) => {
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });

  test('Google Sign-In button fits within viewport', async ({ page }) => {
    await page.waitForTimeout(1000);
    const gsiContainer = page.locator('[class*="googleBtn"]');
    if (await gsiContainer.isVisible()) {
      const box = await gsiContainer.boundingBox();
      const viewport = page.viewportSize()!;
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    }
  });
});
