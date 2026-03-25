/**
 * E2E tests for the AlumnoDetail page.
 * Navigates to the first alumno in the list and verifies the detail view.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('AlumnoDetail', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/alumnos');
    await page.waitForURL('**/admin/alumnos');
    // Wait for table to load and click first real row
    await page.waitForTimeout(4000);
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();
    await page.waitForURL(/\/admin\/alumnos\/rec/, { timeout: 10000 });
  });

  test('carga sin errores (no CharAt crash)', async ({ page }) => {
    // The ErrorBoundary should NOT be triggered
    await expect(page.locator('text=Algo ha fallado')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=alumno.nombre.charAt')).not.toBeVisible();
  });

  test('muestra el nombre del alumno y el botón Volver', async ({ page }) => {
    await expect(page.locator('button:has-text("Volver")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[class*="name"]')).toBeVisible();
  });

  test('muestra avatar con inicial del nombre', async ({ page }) => {
    await page.waitForTimeout(2000);
    const avatar = page.locator('[class*="avatar"]');
    await expect(avatar).toBeVisible({ timeout: 10000 });
    // Avatar should contain a single uppercase letter
    const text = await avatar.textContent();
    expect(text?.trim()).toMatch(/^[A-Z]$/);
  });

  test('muestra quick stats (módulo, idioma, engagement)', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.locator('[class*="quickStats"]')).toBeVisible({ timeout: 10000 });
  });

  test('el tab Información está activo por defecto', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.locator('[class*="tabActive"]')).toBeVisible({ timeout: 10000 });
  });

  test('tab Revisiones carga sin crash', async ({ page }) => {
    await page.waitForTimeout(2000);
    const revTab = page.locator('button:has-text("Revisiones")');
    if (await revTab.isVisible()) {
      await revTab.click();
      await page.waitForTimeout(3000);
      await expect(page.locator('text=Algo ha fallado')).not.toBeVisible();
      await expect(page.locator('[class*="tabContent"]')).toBeVisible();
    }
  });

  test('tab Pagos carga sin crash', async ({ page }) => {
    await page.waitForTimeout(2000);
    const pagosTab = page.locator('button:has-text("Pagos")');
    if (await pagosTab.isVisible()) {
      await pagosTab.click();
      await page.waitForTimeout(3000);
      await expect(page.locator('text=Algo ha fallado')).not.toBeVisible();
      await expect(page.locator('[class*="tabContent"]')).toBeVisible();
    }
  });

  test('tab Historial carga sin crash', async ({ page }) => {
    await page.waitForTimeout(2000);
    const histTab = page.locator('button:has-text("Historial")');
    if (await histTab.isVisible()) {
      await histTab.click();
      await page.waitForTimeout(3000);
      await expect(page.locator('text=Algo ha fallado')).not.toBeVisible();
    }
  });

  test('tab IA Insights carga sin crash', async ({ page }) => {
    await page.waitForTimeout(2000);
    const iaTab = page.locator('button:has-text("IA")');
    if (await iaTab.isVisible()) {
      await iaTab.click();
      await page.waitForTimeout(2000);
      await expect(page.locator('text=Algo ha fallado')).not.toBeVisible();
    }
  });

  test('botón Volver regresa a la lista de alumnos', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Volver")').click();
    await page.waitForURL('**/admin/alumnos', { timeout: 5000 });
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  });
});
