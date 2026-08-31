/**
 * E2E tests for the Comunicaciones section (Inbox.tsx) — lists bulk campaigns
 * and enforces the "Pendiente is the point of no return" spec requirement:
 * edit/discard are visible only for Borrador; every other state is view-only.
 *
 * The list request (GET to the Airtable proxy for `Envios de Emails`) is
 * intercepted and fulfilled with two fixed records — this suite never reads
 * or writes real data, matching the convention in bulk-compose.spec.ts.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

const ENVIOS_EMAILS_TABLE_ID = 'tblsh8KaCMQ8KoKeU';

const BORRADOR_RECORD = {
  id: 'recBorradorTest',
  createdTime: new Date().toISOString(),
  fields: {
    'Nombre': 'Campaña E2E Borrador',
    'Alumnos': ['rec1', 'rec2'],
    'Tipo': 'informacion',
    'Mensaje': 'Mensaje de prueba',
    'Estado': 'Borrador',
    'Total Emails': 2,
  },
};

const PENDIENTE_RECORD = {
  id: 'recPendienteTest',
  createdTime: new Date().toISOString(),
  fields: {
    'Nombre': 'Campaña E2E Pendiente',
    'Alumnos': ['rec3', 'rec4', 'rec5'],
    'Tipo': 'informacion',
    'Mensaje': 'Ya enviada',
    'Estado': 'Pendiente',
    'Total Emails': 3,
  },
};

// Supabase (PostgREST) row shape — used when this dev environment runs
// VITE_DATA_SOURCE=supabase, mirroring the snake_case columns EnviosEmailsAdapter reads.
const SUPABASE_ROWS = [
  {
    id: 'uuid-borrador-test',
    created_at: new Date().toISOString(),
    nombre: 'Campaña E2E Borrador',
    alumnos_ids: ['rec1', 'rec2'],
    tipo: 'informacion',
    mensaje: 'Mensaje de prueba',
    estado: 'Borrador',
    total_emails: 2,
  },
  {
    id: 'uuid-pendiente-test',
    created_at: new Date().toISOString(),
    nombre: 'Campaña E2E Pendiente',
    alumnos_ids: ['rec3', 'rec4', 'rec5'],
    tipo: 'informacion',
    mensaje: 'Ya enviada',
    estado: 'Pendiente',
    total_emails: 3,
  },
];

test.describe('Comunicaciones section', () => {
  test.beforeEach(async ({ page }) => {
    const fulfillAirtable = async (route: import('@playwright/test').Route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ records: [BORRADOR_RECORD, PENDIENTE_RECORD] }),
      });
    };
    await page.route(`**/api/airtable/${ENVIOS_EMAILS_TABLE_ID}*`, fulfillAirtable);
    await page.route(`**/v0/*/${ENVIOS_EMAILS_TABLE_ID}*`, fulfillAirtable);

    // Supabase path — this dev environment's default backend
    await page.route('**/rest/v1/envios_emails*', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SUPABASE_ROWS),
      });
    });

    await loginAsAdmin(page);
    await page.goto('/admin/inbox');
    await page.locator(`button:has-text("Comunicaciones")`).click();
  });

  test('lista un borrador con botón de enviar', async ({ page }) => {
    const row = page.locator('tr', { hasText: 'Campaña E2E Borrador' });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.locator('button:has-text("Enviar")')).toBeVisible();
    await expect(row.locator('button:has-text("Editar")')).toBeVisible();
    await expect(row.locator('button:has-text("Descartar")')).toBeVisible();
  });

  test('una campaña Pendiente no muestra editar, descartar ni enviar', async ({ page }) => {
    const row = page.locator('tr', { hasText: 'Campaña E2E Pendiente' });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.locator('button:has-text("Enviar")')).toHaveCount(0);
    await expect(row.locator('button:has-text("Editar")')).toHaveCount(0);
    await expect(row.locator('button:has-text("Descartar")')).toHaveCount(0);
    await expect(row.locator('text=Solo lectura')).toBeVisible();
  });
});
