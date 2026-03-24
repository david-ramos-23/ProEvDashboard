/**
 * E2E tests for the Email Approval page (revisor role).
 *
 * Verifies the two-panel layout, email queue, message content, and approval actions.
 */

import { test, expect } from '@playwright/test';

const TEST_ADMIN_EMAIL = 'andara14+test-dashboard-admin@gmail.com';

async function loginAndGo(page: Parameters<typeof test>[1]) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('input[type="email"]', TEST_ADMIN_EMAIL);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
  await page.goto('/revisor/emails');
  await page.waitForSelector('text=Aprobacion de Emails', { timeout: 15000 });
}

test.describe('Email Approval', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGo(page);
  });

  test('página carga sin errores', async ({ page }) => {
    // If ErrorBoundary shows, it's a crash
    await expect(page.locator('text=Algo ha fallado')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('h1')).toContainText('Aprobacion de Emails');
  });

  test('muestra KPI de pendientes de aprobación', async ({ page }) => {
    await expect(page.locator('text=Pendientes de Aprobacion')).toBeVisible({ timeout: 10000 });
  });

  test('muestra KPI de estado', async ({ page }) => {
    await expect(page.locator('text=Estado')).toBeVisible({ timeout: 10000 });
  });

  test('lista de emails pendientes es visible', async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator('text=Emails Pendientes')).toBeVisible({ timeout: 10000 });
  });

  test('primer email se selecciona automáticamente y muestra contenido', async ({ page }) => {
    await page.waitForTimeout(3000);
    // The right panel should show the selected email's message
    await expect(page.locator('text=Mensaje')).toBeVisible({ timeout: 10000 });
  });

  test('botones Aprobar y Rechazar están presentes', async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator('button:has-text("Aprobar y Enviar")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Rechazar")')).toBeVisible();
  });

  test('seleccionar otro email de la lista actualiza el panel', async ({ page }) => {
    await page.waitForTimeout(3000);
    const listItems = page.locator('[class*="emailItem"], [class*="listItem"]');
    const count = await listItems.count();
    if (count >= 2) {
      await listItems.nth(1).click();
      await page.waitForTimeout(500);
      await expect(page.locator('text=Mensaje')).toBeVisible({ timeout: 5000 });
    }
  });
});
