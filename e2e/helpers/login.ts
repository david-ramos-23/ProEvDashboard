/**
 * Shared E2E login helper for magic-link dev flow.
 */
import { Page } from '@playwright/test';

export const TEST_ADMIN_EMAIL = 'andara14+test-dashboard-admin@gmail.com';

export async function loginAsAdmin(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Fill email and submit (magic link flow)
  await page.fill('input[type="email"]', TEST_ADMIN_EMAIL);
  await page.click('button[type="submit"]');

  // Wait for dev verify button (appears in "sent" state)
  const devBtn = page.locator('button:has-text("[DEV]")');
  await devBtn.waitFor({ state: 'visible', timeout: 10000 });
  await devBtn.click();

  // Wait for dashboard
  await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
}
