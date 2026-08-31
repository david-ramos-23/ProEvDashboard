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

    // Wait for the filtered result to settle rather than sleeping a fixed 1s.
    // Counts only real data rows: `tbody tr` also matches the empty-state row,
    // which made the skip below never trigger and the assertion fail against a
    // table that was, correctly, showing nothing.
    const rows = page.locator('tbody tr[data-row-id]');
    const empty = page.locator('text=/No hay emails/i');
    await expect(rows.first().or(empty)).toBeVisible({ timeout: 10000 });

    // If the dataset has no pending-approval email, SKIP — visibly — instead of
    // passing. Guarding the assertion behind `if (count > 0)` made this test
    // incapable of failing: deleting the approve button outright would still
    // have left it green, which is the opposite of what it exists for.
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'no pending-approval emails in the current dataset');

    // With rows present the button is not optional — every row under this filter
    // is PENDIENTE_APROBACION, and each must offer the row-level approve action
    // (see the ColaSection column definition in src/pages/admin/Inbox.tsx).
    //
    // Located by class, not by aria-label: that label is `t('common.approve')`,
    // which renders "Aprobar" or "Approve" depending on the active locale. A
    // literal Spanish selector would go red on an English run for no real reason.
    await expect(page.locator('tbody button.btn-success').first()).toBeVisible();
  });
});
