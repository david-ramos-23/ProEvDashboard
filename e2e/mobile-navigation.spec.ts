/**
 * Mobile Navigation E2E Tests
 *
 * Tests sidebar drawer, hamburger menu, and navigation on mobile viewports.
 * Run with: npx playwright test mobile-navigation --project=mobile-chrome
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('Mobile Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('sidebar is hidden by default', async ({ page }) => {
    const sidebar = page.locator('aside');
    // Sidebar exists but is off-screen (transform: translateX(-100%))
    await expect(sidebar).toBeAttached();
    const box = await sidebar.boundingBox();
    // Either not visible or positioned off-screen
    if (box) {
      expect(box.x + box.width).toBeLessThanOrEqual(0);
    }
  });

  test('hamburger button is visible', async ({ page }) => {
    const hamburger = page.locator('button[aria-label="Abrir men\u00fa"]');
    await expect(hamburger).toBeVisible();
  });

  test('clicking hamburger opens sidebar overlay', async ({ page }) => {
    const hamburger = page.locator('button[aria-label="Abrir men\u00fa"]');
    await hamburger.click();

    // Sidebar should now be visible
    const sidebar = page.locator('aside');
    const box = await sidebar.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
  });

  test('clicking backdrop closes sidebar', async ({ page }) => {
    const hamburger = page.locator('button[aria-label="Abrir men\u00fa"]');
    await hamburger.click();
    await page.waitForTimeout(400);

    // Click backdrop area (right side of viewport)
    const viewport = page.viewportSize()!;
    await page.mouse.click(viewport.width - 10, viewport.height / 2);
    await page.waitForTimeout(400);

    // Sidebar should be hidden again
    const sidebar = page.locator('aside');
    const box = await sidebar.boundingBox();
    if (box) {
      expect(box.x + box.width).toBeLessThanOrEqual(0);
    }
  });

  test('navigating closes sidebar', async ({ page }) => {
    const hamburger = page.locator('button[aria-label="Abrir men\u00fa"]');
    await hamburger.click();
    await page.waitForTimeout(400);

    // Click a nav link
    const navLink = page.locator('nav a').first();
    await navLink.click();
    await page.waitForTimeout(500);

    // Sidebar should be closed
    const sidebar = page.locator('aside');
    const box = await sidebar.boundingBox();
    if (box) {
      expect(box.x + box.width).toBeLessThanOrEqual(0);
    }
  });

  test('page title is visible in header', async ({ page }) => {
    const title = page.locator('h1');
    await expect(title).toBeVisible();
  });

  test('all nav links work correctly', async ({ page }) => {
    const hamburger = page.locator('button[aria-label="Abrir men\u00fa"]');
    const navLinks = page.locator('nav a');
    const count = await navLinks.count();

    for (let i = 0; i < count; i++) {
      await hamburger.click();
      await page.waitForTimeout(300);
      const link = navLinks.nth(i);
      const href = await link.getAttribute('href');
      await link.click();
      await page.waitForTimeout(500);
      expect(page.url()).toContain(href);
    }
  });
});
