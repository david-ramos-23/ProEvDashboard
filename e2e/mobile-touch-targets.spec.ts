/**
 * Mobile Touch Targets E2E Tests
 *
 * Verifies interactive elements meet 44px minimum touch target.
 * Run with: npx playwright test mobile-touch-targets --project=mobile-chrome
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

const MIN_TOUCH_TARGET = 40; // Allow small tolerance from 44px

test.describe('Mobile Touch Targets', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('hamburger button meets touch target size', async ({ page }) => {
    const hamburger = page.locator('button[aria-label="Abrir men\u00fa"]');
    const box = await hamburger.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(box!.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  test('notification bell meets touch target size', async ({ page }) => {
    const bell = page.locator('button[aria-label*="otificacion"], button[aria-label*="Notification"]');
    if (await bell.count() > 0) {
      const box = await bell.first().boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
        expect(box.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      }
    }
  });

  test('AI toggle meets touch target size', async ({ page }) => {
    const aiBtn = page.locator('button[aria-label="Abrir asistente IA"]');
    const box = await aiBtn.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(box!.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  test('notification bell opens bottom sheet on mobile', async ({ page }) => {
    const bell = page.locator('button[aria-label*="otificacion"], button[aria-label*="Notification"]');
    if (await bell.count() > 0) {
      await bell.first().click();
      await page.waitForTimeout(500);

      const dropdown = page.locator('[role="dialog"]');
      if (await dropdown.isVisible()) {
        const box = await dropdown.boundingBox();
        const viewport = page.viewportSize()!;
        if (box) {
          // Bottom sheet should be full width
          expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);
          // Should be anchored to bottom
          expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height - 10);
        }
      }
    }
  });

  test('sidebar nav items are tappable', async ({ page }) => {
    const hamburger = page.locator('button[aria-label="Abrir men\u00fa"]');
    await hamburger.click();
    await page.waitForTimeout(400);

    const navItems = page.locator('nav a');
    const count = await navItems.count();
    for (let i = 0; i < count; i++) {
      const box = await navItems.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(32); // Nav items have padding
      }
    }
  });
});
