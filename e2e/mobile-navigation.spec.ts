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
    // Sidebar exists but should not have sidebarOpen class
    await expect(sidebar).toBeAttached();
    const hasOpenClass = await sidebar.evaluate((el) =>
      el.className.includes('sidebarOpen')
    );
    expect(hasOpenClass).toBe(false);
  });

  test('hamburger button is visible', async ({ page }) => {
    const hamburger = page.locator('button[aria-label="Abrir men\u00fa"]');
    await expect(hamburger).toBeVisible();
  });

  test('clicking hamburger opens sidebar overlay', async ({ page }) => {
    const hamburger = page.locator('button[aria-label="Abrir men\u00fa"]');
    await hamburger.click();
    await page.waitForTimeout(500); // wait for slide animation

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

    // Sidebar should not have sidebarOpen class
    const sidebar = page.locator('aside');
    const hasOpenClass = await sidebar.evaluate((el) =>
      el.className.includes('sidebarOpen')
    );
    expect(hasOpenClass).toBe(false);
  });

  test('navigating closes sidebar', async ({ page }) => {
    const hamburger = page.locator('button[aria-label="Abrir men\u00fa"]');
    await hamburger.click();
    await page.waitForTimeout(500);

    // Click a different nav link (not current page)
    const navLinks = page.locator('nav a');
    const count = await navLinks.count();
    // Click the second link to force an actual route change
    const navLink = count > 1 ? navLinks.nth(1) : navLinks.first();
    await navLink.click();

    // Wait for sidebar to lose the sidebarOpen class
    await page.waitForFunction(() => {
      const aside = document.querySelector('aside');
      return aside && !aside.className.includes('sidebarOpen');
    }, { timeout: 3000 });
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
