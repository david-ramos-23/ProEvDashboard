/**
 * Visual / layout tests for the Login page.
 *
 * Verifies hero video, form elements, and Google Sign-In button
 * render correctly.
 */

import { test, expect } from '@playwright/test';

test.describe('Login Page — Visual & Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  });

  test('hero video element is present with correct attributes', async ({ page }) => {
    const video = page.locator('video');
    await expect(video).toBeAttached();
    await expect(video).toHaveAttribute('autoplay', '');
    await expect(video).toHaveAttribute('loop', '');
    const isMuted = await video.evaluate((v: HTMLVideoElement) => v.muted);
    expect(isMuted).toBe(true);
    const src = await video.getAttribute('src');
    expect(src).toContain('hero-completo.mp4');
  });

  test('video overlay dims the background', async ({ page }) => {
    const overlay = page.locator('[class*="videoOverlay"]');
    await expect(overlay).toBeAttached();
  });

  test('login card shows logo, title, email form', async ({ page }) => {
    await expect(page.locator('img[alt="FOCUS Dance Studio"]')).toBeVisible();
    await expect(page.locator('text=PROEV')).toBeVisible();
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Google Sign-In container is present', async ({ page }) => {
    const gsiContainer = page.locator('[class*="googleBtn"]');
    await expect(gsiContainer).toBeAttached();
  });

  test('submit button and GSI container have same width', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]');
    const gsiContainer = page.locator('[class*="googleBtn"]');

    const submitWidth = await submitBtn.evaluate((el) => el.offsetWidth);
    const gsiWidth = await gsiContainer.evaluate((el) => el.offsetWidth);

    expect(Math.abs(submitWidth - gsiWidth)).toBeLessThanOrEqual(30);
  });
});
