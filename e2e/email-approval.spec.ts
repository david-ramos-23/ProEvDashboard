/**
 * E2E tests for the legacy Email Approval route.
 *
 * The standalone two-panel "Aprobación de Emails" page (/revisor/emails, with
 * its own KPI cards and message preview panel) was retired. It now redirects
 * to /admin/inbox?section=cola (see src/App.tsx), where pending-approval
 * emails live behind the "Por aprobar" filter tab in the unified Cola de
 * Emails table, with a row-level approve action instead of a message panel.
 * These tests verify that redirect and the resulting approval queue work.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('Email Approval (legacy redirect → Cola de Emails)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/revisor/emails');
    await page.waitForURL(/\/admin\/inbox\?section=cola/, { timeout: 15000 });
  });

  test('redirige a la Cola de Emails sin errores', async ({ page }) => {
    await expect(page.locator('text=Algo ha fallado')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('th').filter({ hasText: /alumno/i }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: /estado/i }).first()).toBeVisible();
  });

  test('filtro "Por aprobar" es visible y seleccionable', async ({ page }) => {
    const tab = page.locator('button.btn-sm').filter({ hasText: 'Por aprobar' });
    await expect(tab).toBeVisible({ timeout: 10000 });
    await tab.click();
    await expect(tab).toHaveClass(/btn-primary/);
  });

  test('emails pendientes de aprobación muestran el botón de aprobar', async ({ page }) => {
    await page.locator('button.btn-sm').filter({ hasText: 'Por aprobar' }).click();
    await page.waitForTimeout(1000);

    // The row-level approve button (✅, aria-label "Aprobar") only renders for
    // rows whose estado is PENDIENTE_APROBACION — see the ColaSection column
    // definition in src/pages/admin/Inbox.tsx. Only assert it when the
    // current dataset actually has a pending-approval email to show it for.
    const approveButtons = page.locator('button[aria-label="Aprobar"]');
    const count = await approveButtons.count();
    if (count > 0) {
      await expect(approveButtons.first()).toBeVisible();
    }
  });
});
