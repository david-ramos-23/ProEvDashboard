/**
 * E2E tests for the AI Assistant panel.
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'andara14+test-dashboard-admin@gmail.com';

test.describe('AI Assistant', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
  });

  test('trigger button is visible in layout', async ({ page }) => {
    await expect(page.locator('button[aria-label="Abrir asistente IA"]')).toBeVisible({ timeout: 10000 });
  });

  test('clicking trigger opens the chat panel', async ({ page }) => {
    await page.locator('button[aria-label="Abrir asistente IA"]').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Asistente ProEv')).toBeVisible();
  });

  test('welcome screen shows suggestions', async ({ page }) => {
    await page.locator('button[aria-label="Abrir asistente IA"]').click();
    await expect(page.locator('[class*="suggestionBtn"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('close button closes the panel', async ({ page }) => {
    await page.locator('button[aria-label="Abrir asistente IA"]').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    await page.locator('button[aria-label="Cerrar"]').click();
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 3000 });
  });

  test('typing in input enables send button', async ({ page }) => {
    await page.locator('button[aria-label="Abrir asistente IA"]').click();
    await page.waitForSelector('[class*="input"]', { timeout: 5000 });
    const sendBtn = page.locator('button[aria-label="Enviar"]');
    await expect(sendBtn).toBeDisabled();
    await page.locator('textarea[placeholder*="Pregunta"]').fill('Hola');
    await expect(sendBtn).toBeEnabled();
  });
});
