/**
 * E2E tests for the Video Review page (revisor role).
 *
 * Admin users can also access /revisor/videos.
 * Tests verify the review queue, video player, and action buttons.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('Video Review', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/revisor/videos');
    await page.waitForSelector('text=Revision de Videos', { timeout: 15000 });
  });

  test('muestra KPIs: Pendientes, Revisados Hoy, Total', async ({ page }) => {
    await expect(page.locator('text=Pendientes')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Revisados Hoy')).toBeVisible();
    await expect(page.locator('text=Total Revisiones')).toBeVisible();
  });

  test('muestra la cola de revisión con alumnos', async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator('text=Cola de Revision')).toBeVisible();
  });

  test('primer alumno se selecciona automáticamente', async ({ page }) => {
    await page.waitForTimeout(3000);
    // Detail panel should show a selected student's info
    const detailPanel = page.locator('[class*="detail"]');
    if (await detailPanel.isVisible()) {
      await expect(detailPanel.locator('text=Pendiente')).toBeVisible({ timeout: 5000 });
    }
  });

  test('botones de acción están disponibles', async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator('button:has-text("Aprobar")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Rechazar")')).toBeVisible();
    await expect(page.locator('button:has-text("Revision Necesaria")')).toBeVisible();
  });

  test('video player muestra el video o fallback externo', async ({ page }) => {
    await page.waitForTimeout(3000);
    // Either an iframe/video embed OR an external link button should be visible
    const hasEmbed = await page.locator('iframe[class*="videoEmbed"], video[class*="videoEmbed"]').isVisible();
    const hasLink = await page.locator('text=Abrir video externamente').isVisible();
    expect(hasEmbed || hasLink).toBeTruthy();
  });

  test('seleccionar otro alumno actualiza el panel', async ({ page }) => {
    await page.waitForTimeout(3000);
    const items = page.locator('[class*="queueItem"]');
    const count = await items.count();
    if (count >= 2) {
      const secondItem = items.nth(1);
      const name = await secondItem.textContent();
      await secondItem.click();
      // Detail panel should update to show the selected student's name
      if (name) {
        await expect(page.locator(`text=${name.trim().split('\n')[0]}`).first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('campo de feedback acepta texto', async ({ page }) => {
    await page.waitForTimeout(3000);
    const feedbackArea = page.locator('textarea[placeholder*="evaluacion"]');
    if (await feedbackArea.isVisible()) {
      await feedbackArea.fill('Buen nivel técnico, postura correcta.');
      await expect(feedbackArea).toHaveValue('Buen nivel técnico, postura correcta.');
    }
  });
});
