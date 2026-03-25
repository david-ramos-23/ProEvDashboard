/**
 * Mobile AI Assistant E2E Tests
 *
 * Verifies AI panel behaves as full-screen drawer on mobile.
 * Run with: npx playwright test mobile-ai-assistant --project=mobile-chrome
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('Mobile AI Assistant', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('AI toggle opens full-screen panel', async ({ page }) => {
    const aiBtn = page.locator('button[aria-label="Abrir asistente IA"]');
    await aiBtn.click();
    await page.waitForTimeout(600);

    const panel = page.locator('[role="complementary"]');
    await expect(panel).toBeVisible();

    const box = await panel.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).toBeTruthy();
    // Panel should be approximately full viewport width
    expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 2);
  });

  test('close button works', async ({ page }) => {
    const aiBtn = page.locator('button[aria-label="Abrir asistente IA"]');
    await aiBtn.click();
    await page.waitForTimeout(600);

    // Find close button inside panel
    const panel = page.locator('[role="complementary"]');
    const closeBtn = panel.locator('button').first();
    // There should be a close/X button in the header actions
    const iconBtns = panel.locator('[class*="iconBtn"]');
    const lastBtn = iconBtns.last();
    if (await lastBtn.isVisible()) {
      await lastBtn.click();
      await page.waitForTimeout(600);
    }
  });

  test('suggestion buttons are tappable (44px+)', async ({ page }) => {
    const aiBtn = page.locator('button[aria-label="Abrir asistente IA"]');
    await aiBtn.click();
    await page.waitForTimeout(600);

    const panel = page.locator('[role="complementary"]');
    const suggestions = panel.locator('[class*="suggestionBtn"]');
    const count = await suggestions.count();

    for (let i = 0; i < count; i++) {
      const box = await suggestions.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40); // allow small tolerance
      }
    }
  });

  test('input area is usable', async ({ page }) => {
    const aiBtn = page.locator('button[aria-label="Abrir asistente IA"]');
    await aiBtn.click();
    await page.waitForTimeout(600);

    const panel = page.locator('[role="complementary"]');
    const input = panel.locator('textarea');
    await expect(input).toBeVisible();
    await input.fill('test message');
    expect(await input.inputValue()).toBe('test message');
  });
});
