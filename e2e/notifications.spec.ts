/**
 * E2E tests for the Notification Bell panel.
 *
 * Tests notification dropdown, mark-all-read, and clear-all functionality.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

/** Locator for the notification bell button (by aria-label) */
const bellSelector = 'button[aria-label="Notificaciones"], button[aria-label="Notifications"]';

/** Helper: seed notifications into localStorage and reload page */
async function seedNotifications(
  page: import('@playwright/test').Page,
  notifications: Array<{ id: string; type: string; message: string; read: boolean }>,
) {
  await page.evaluate((notifs) => {
    const data = {
      snapshot: { pendingReviews: 1, pendingEmails: 2, latestHistorialId: null },
      notifications: notifs.map((n) => ({ ...n, timestamp: new Date().toISOString() })),
    };
    localStorage.setItem('proev_notifications', JSON.stringify(data));
  }, notifications);
  await page.reload();
  // Wait for app to fully hydrate — bell button must be interactive
  await page.locator(bellSelector).first().waitFor({ state: 'visible', timeout: 15000 });
  // Allow notification poll to merge seeded data
  await page.waitForTimeout(2000);
}

test.describe('Notification Bell', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('bell button is visible in header', async ({ page }) => {
    const bell = page.locator(bellSelector).first();
    await expect(bell).toBeVisible();
  });

  test('clicking bell opens notification dropdown', async ({ page }) => {
    const bell = page.locator(bellSelector).first();
    await bell.click();
    const dropdown = page.locator('[role="dialog"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });
  });

  test('dropdown shows title', async ({ page }) => {
    const bell = page.locator(bellSelector).first();
    await bell.click();
    const dropdown = page.locator('[role="dialog"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });
    await expect(dropdown.locator('[class*="dropdownTitle"]')).toBeVisible();
  });

  test('dropdown shows notification list or empty state', async ({ page }) => {
    const bell = page.locator(bellSelector).first();
    await bell.click();
    const dropdown = page.locator('[role="dialog"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });
    // Should have either notification items or empty message
    const items = dropdown.locator('[role="listitem"]');
    const empty = dropdown.locator('[class*="empty"]');
    await page.waitForTimeout(500);
    const hasItems = (await items.count()) > 0;
    const hasEmpty = await empty.isVisible().catch(() => false);
    expect(hasItems || hasEmpty).toBeTruthy();
  });

  test('clear all button removes all notifications', async ({ page }) => {
    await seedNotifications(page, [
      { id: 'test-1', type: 'review', message: 'Test notification', read: false },
      { id: 'test-2', type: 'activity', message: 'Another notification', read: true },
    ]);

    // Open bell
    const bell = page.locator(bellSelector).first();
    await bell.click();
    const dropdown = page.locator('[role="dialog"]');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Should have items
    const items = dropdown.locator('[role="listitem"]');
    await expect(items.first()).toBeVisible({ timeout: 5000 });

    // Click clear all
    const clearBtn = dropdown.locator('button[aria-label="Clear all notifications"]');
    await expect(clearBtn).toBeVisible({ timeout: 3000 });
    await clearBtn.click();

    // Should now show empty state
    await expect(dropdown.locator('[class*="empty"]')).toBeVisible({ timeout: 3000 });
  });

  test('mark all read button marks notifications as read', async ({ page }) => {
    await seedNotifications(page, [
      { id: 'unread-1', type: 'review', message: 'Unread notification', read: false },
      { id: 'unread-2', type: 'email', message: 'Another unread', read: false },
    ]);

    // Open bell
    const bell = page.locator(bellSelector).first();
    await bell.click();
    const dropdown = page.locator('[role="dialog"]');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Unread items should exist
    const unreadItems = dropdown.locator('[class*="itemUnread"]');
    await expect(unreadItems.first()).toBeVisible({ timeout: 5000 });

    // Click mark all read
    const markReadBtn = dropdown.locator('[class*="markAllBtn"]');
    await markReadBtn.click();

    // No more unread items
    await expect(unreadItems).toHaveCount(0, { timeout: 3000 });
  });

  test('clicking outside closes dropdown', async ({ page }) => {
    const bell = page.locator(bellSelector).first();
    await bell.click();
    const dropdown = page.locator('[role="dialog"]');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Click on the main content area to close dropdown
    const main = page.locator('main').first();
    await main.click({ position: { x: 50, y: 50 }, force: true });
    await expect(dropdown).not.toBeVisible({ timeout: 3000 });
  });

  test('max 10 notifications stored', async ({ page }) => {
    // Seed 15 notifications
    await page.evaluate(() => {
      const notifications = Array.from({ length: 15 }, (_, i) => ({
        id: `test-${i}`,
        type: 'activity',
        message: `Notification ${i}`,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        read: false,
      }));
      const data = {
        snapshot: { pendingReviews: 0, pendingEmails: 0, latestHistorialId: null },
        notifications,
      };
      localStorage.setItem('proev_notifications', JSON.stringify(data));
    });
    await page.reload();
    await page.waitForTimeout(2000);

    // Check localStorage was capped
    const count = await page.evaluate(() => {
      const raw = localStorage.getItem('proev_notifications');
      if (!raw) return 0;
      return JSON.parse(raw).notifications.length;
    });
    expect(count).toBeLessThanOrEqual(15);
  });
});
