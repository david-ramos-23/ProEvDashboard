/**
 * E2E tests for the Emails / Inbox page.
 *
 * The Emails page has two sections:
 * - "Bandeja" (inbox): received/sent emails, card list with inline expand
 * - "Cola de emails": outgoing email queue (4 sub-tabs)
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('Emails / Inbox', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/inbox');
  });

  test('renderiza el section switcher con Bandeja y Cola', async ({ page }) => {
    await expect(page.locator('button:has-text("Bandeja")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Cola de emails")')).toBeVisible({ timeout: 10000 });
  });

  test('Bandeja muestra filtros de estado', async ({ page }) => {
    // Make sure Bandeja is selected (default)
    await page.locator('button:has-text("Bandeja")').click();
    const filterRow = page.locator('[class*="filterRow"]').first();
    await expect(filterRow.locator('button:has-text("Todos")')).toBeVisible({ timeout: 10000 });
    await expect(filterRow.locator('button:has-text("Recibidos")')).toBeVisible();
    await expect(filterRow.locator('button:has-text("Enviados")')).toBeVisible();
  });

  test('Bandeja muestra input de búsqueda', async ({ page }) => {
    await page.locator('button:has-text("Bandeja")').click();
    await expect(page.locator('input[placeholder*="Buscar"]')).toBeVisible({ timeout: 10000 });
  });

  test('filtro Recibidos activa el botón', async ({ page }) => {
    await page.locator('button:has-text("Bandeja")').click();
    await page.waitForTimeout(1000);
    const filterRow = page.locator('[class*="filterRow"]').first();
    await filterRow.locator('button:has-text("Recibidos")').click();
    await expect(filterRow.locator('button:has-text("Recibidos")')).toHaveClass(/filterBtnActive/, { timeout: 3000 });
  });

  test('filtro Enviados activa el botón', async ({ page }) => {
    await page.locator('button:has-text("Bandeja")').click();
    await page.waitForTimeout(1000);
    const filterRow = page.locator('[class*="filterRow"]').first();
    await filterRow.locator('button:has-text("Enviados")').click();
    await expect(filterRow.locator('button:has-text("Enviados")')).toHaveClass(/filterBtnActive/, { timeout: 3000 });
  });

  test('expandir una tarjeta muestra el cuerpo del email', async ({ page }) => {
    await page.locator('button:has-text("Bandeja")').click();
    await page.waitForTimeout(3000); // wait for data
    const firstCard = page.locator('[class*="emailCardHeader"]').first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await expect(page.locator('[class*="expandedBody"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Cola de emails muestra las sub-tabs', async ({ page }) => {
    await page.locator('button:has-text("Cola de emails")').click();
    await expect(page.locator('button:has-text("Por aprobar")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("En cola")')).toBeVisible();
    await expect(page.locator('button:has-text("Enviados")')).toBeVisible();
    await expect(page.locator('button:has-text("Errores")')).toBeVisible();
  });

  test('Cola muestra filtros de tipo de email', async ({ page }) => {
    await page.locator('button:has-text("Cola de emails")').click();
    await page.waitForTimeout(2000);
    // Type filter chips should be visible
    await expect(page.locator('button:has-text("seguimiento")')).toBeVisible({ timeout: 10000 });
  });
});
