/**
 * E2E tests for the AI Assistant panel.
 *
 * The assistant is a fixed right-column panel (360px) toggled by the ✦ button in the header.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('AI Assistant', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('botón ✦ de toggle es visible en el header', async ({ page }) => {
    await expect(page.locator('button[aria-label="Abrir asistente IA"]')).toBeVisible({ timeout: 10000 });
  });

  test('clicking toggle abre el panel lateral', async ({ page }) => {
    await page.locator('button[aria-label="Abrir asistente IA"]').click();
    await expect(page.locator('[role="complementary"][aria-label*="Asistente"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Asistente ProEv')).toBeVisible();
  });

  test('la pantalla de bienvenida muestra sugerencias', async ({ page }) => {
    await page.locator('button[aria-label="Abrir asistente IA"]').click();
    await expect(page.locator('[class*="suggestionBtn"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('botón de cerrar cierra el panel', async ({ page }) => {
    await page.locator('button[aria-label="Abrir asistente IA"]').click();
    const panel = page.locator('[role="complementary"]');
    await expect(panel).toHaveClass(/panelOpen/, { timeout: 5000 });
    // Close by clicking the backdrop
    await page.locator('[class*="backdropOpen"]').click();
    // Panel should lose the panelOpen class (slide-out animation)
    await expect(panel).not.toHaveClass(/panelOpen/, { timeout: 5000 });
  });

  test('escribir en el input habilita el botón de enviar', async ({ page }) => {
    await page.locator('button[aria-label="Abrir asistente IA"]').click();
    await page.waitForSelector('textarea[placeholder*="Pregunta"]', { timeout: 5000 });
    const sendBtn = page.locator('button[aria-label="Enviar"]');
    await expect(sendBtn).toBeDisabled();
    await page.locator('textarea[placeholder*="Pregunta"]').fill('Hola');
    await expect(sendBtn).toBeEnabled();
  });

  test('el panel empuja el contenido (no se superpone)', async ({ page }) => {
    // Check the spacer div expands when panel is open
    const spacer = page.locator('[class*="aiSpacer"]');
    const widthBefore = await spacer.evaluate(el => (el as HTMLElement).offsetWidth);
    await page.locator('button[aria-label="Abrir asistente IA"]').click();
    await page.waitForTimeout(400); // allow CSS transition
    const widthAfter = await spacer.evaluate(el => (el as HTMLElement).offsetWidth);
    expect(widthAfter).toBeGreaterThan(widthBefore);
  });
});
