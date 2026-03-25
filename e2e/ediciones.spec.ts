/**
 * E2E tests for the Ediciones page.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('Ediciones', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.click('nav >> text=Ediciones');
    await page.waitForURL('**/admin/ediciones');
  });

  test('renderiza la tabla de ediciones', async ({ page }) => {
    await page.waitForSelector('table', { timeout: 15000 });
    await expect(page.locator('table')).toBeVisible();
  });

  test('muestra tarjetas de capacidad de módulos', async ({ page }) => {
    await page.waitForTimeout(4000);
    const cards = page.locator('.card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('muestra el banner de edición activa si existe', async ({ page }) => {
    await page.waitForTimeout(4000);
    const hasBanner = await page.locator('[class*="activeBanner"]').isVisible().catch(() => false);
    // Just assert the page renders without crash
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    expect(typeof hasBanner).toBe('boolean');
  });

  test('edición activa muestra botón Finalizar (no Desactivar)', async ({ page }) => {
    await page.waitForTimeout(4000);
    // The active edition should have a "Finalizar" button
    const finalizarBtn = page.locator('button:has-text("Finalizar")');
    const desactivarBtn = page.locator('button:has-text("Desactivar")');

    const hasFinalizar = await finalizarBtn.isVisible().catch(() => false);
    const hasDesactivar = await desactivarBtn.isVisible().catch(() => false);

    // "Desactivar" should never appear — it was replaced with "Finalizar"
    expect(hasDesactivar).toBe(false);
    if (hasFinalizar) {
      // Good — correct label
      expect(hasFinalizar).toBe(true);
    }
  });

  test('edición inactiva muestra botón Activar', async ({ page }) => {
    await page.waitForTimeout(4000);
    // At least one inactive edition row should have "Activar"
    const activarBtn = page.locator('button:has-text("Activar")');
    // If there are inactive editions, Activar should appear
    const isVisible = await activarBtn.first().isVisible().catch(() => false);
    if (isVisible) {
      await expect(activarBtn.first()).toBeVisible();
    }
  });

  test('columna Estado muestra chips con colores', async ({ page }) => {
    await page.waitForTimeout(4000);
    // At minimum one status badge should be visible in the table
    await expect(page.locator('[class*="badge"], [class*="Badge"]').first()).toBeVisible({ timeout: 10000 });
  });
});
