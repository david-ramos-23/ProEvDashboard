/**
 * Visual / layout tests for the Login page.
 *
 * Verifies hero video, form elements, and Google Sign-In button
 * render correctly without layout shifts.
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
    // 'muted' is a DOM property in React, check via evaluate
    const isMuted = await video.evaluate((v: HTMLVideoElement) => v.muted);
    expect(isMuted).toBe(true);
    // src should point to the hero video
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

    // Container should have overflow:hidden to prevent GSI shift
    const overflow = await gsiContainer.evaluate(
      (el) => getComputedStyle(el).overflow,
    );
    expect(overflow).toBe('hidden');
  });

  test('GSI container has rounded corner covers (pseudo-elements)', async ({ page }) => {
    const gsiContainer = page.locator('[class*="googleBtn"]');
    await expect(gsiContainer).toBeAttached();

    // ::before and ::after should exist for corner covers
    const hasPseudos = await gsiContainer.evaluate((el) => {
      const before = getComputedStyle(el, '::before');
      const after = getComputedStyle(el, '::after');
      return {
        beforeContent: before.content,
        afterContent: after.content,
        beforeZ: before.zIndex,
        afterZ: after.zIndex,
      };
    });

    // Pseudo-elements should have content (not 'none')
    expect(hasPseudos.beforeContent).not.toBe('none');
    expect(hasPseudos.afterContent).not.toBe('none');
    // They should be above the iframe (z-index: 2)
    expect(hasPseudos.beforeZ).toBe('2');
    expect(hasPseudos.afterZ).toBe('2');
  });

  test('GSI iframe stays within container after async render', async ({ page }) => {
    const gsiContainer = page.locator('[class*="googleBtn"]');
    const iframe = gsiContainer.locator('iframe');

    // GSI may not render iframe in all environments (needs valid client_id + domain)
    // Skip gracefully if no iframe appears
    const iframeCount = await iframe.count();
    if (iframeCount === 0) {
      test.skip();
      return;
    }

    // Wait for GSI to finish async re-renders
    await page.waitForTimeout(2000);

    const bounds = await gsiContainer.evaluate((container) => {
      const cRect = container.getBoundingClientRect();
      const iframeEl = container.querySelector('iframe');
      if (!iframeEl) return null;
      const iRect = iframeEl.getBoundingClientRect();
      return {
        overflowLeft: cRect.left - iRect.left,
        overflowRight: iRect.right - cRect.right,
      };
    });

    if (!bounds) {
      test.skip();
      return;
    }

    // With overflow:hidden, visual overflow is clipped even if iframe shifts
    // But margin:0 !important + MutationObserver should keep it contained
    expect(bounds.overflowLeft).toBeLessThanOrEqual(2);
    expect(bounds.overflowRight).toBeLessThanOrEqual(2);
  });

  test('submit button and GSI container have same width', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]');
    const gsiContainer = page.locator('[class*="googleBtn"]');

    const submitWidth = await submitBtn.evaluate((el) => el.offsetWidth);
    const gsiWidth = await gsiContainer.evaluate((el) => el.offsetWidth);

    // They should be within 30px of each other
    expect(Math.abs(submitWidth - gsiWidth)).toBeLessThanOrEqual(30);
  });
});
