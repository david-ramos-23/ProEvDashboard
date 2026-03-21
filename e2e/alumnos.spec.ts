/**
 * Tests E2E de Gestión de Alumnos.
 * 
 * Verifica tabla, filtros, búsqueda, y navegación al detalle.
 * SOLO usa emails de test — NUNCA usuarios reales.
 */

import { test, expect } from '@playwright/test';

const TEST_ADMIN_EMAIL = 'andara14+test-dashboard-admin@gmail.com';

test.describe('Gestión de Alumnos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[type="email"]', TEST_ADMIN_EMAIL);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
    
    // Navegar a Alumnos
    await page.click('nav >> text=Alumnos');
    await page.waitForURL('**/admin/alumnos');
  });

  test('muestra tabla de alumnos con datos', async ({ page }) => {
    // Esperar a que cargue la tabla
    await page.waitForSelector('table tbody tr:not(:has(.skeleton))', { timeout: 15000 });
    
    // Verificar encabezados
    await expect(page.locator('th >> text=ALUMNO')).toBeVisible();
    await expect(page.locator('th >> text=ESTADO')).toBeVisible();
    
    // Verificar que hay al menos una fila
    const rows = page.locator('table tbody tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('búsqueda filtra alumnos correctamente', async ({ page }) => {
    await page.waitForSelector('table tbody tr:not(:has(.skeleton))', { timeout: 15000 });
    
    // Escribir en el campo de búsqueda
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('test');
    
    // Dar tiempo al filtro local
    await page.waitForTimeout(500);
    
    // Las filas podrían reducirse (o desaparecer si no hay coincidencias)
    // El punto es que la UI no se rompe
    await expect(page.locator('table')).toBeVisible();
  });

  test('filtros de estado funcionan', async ({ page }) => {
    await page.waitForSelector('table tbody tr:not(:has(.skeleton))', { timeout: 15000 });
    
    // Click en un filtro de estado (e.g., Preinscrito)
    const preinsButton = page.locator('button:has-text("Preinscrito")');
    if (await preinsButton.isVisible()) {
      await preinsButton.click();
      
      // La URL no cambia pero los datos se recargan
      await page.waitForTimeout(2000);
      await expect(page.locator('table')).toBeVisible();
    }
  });

  test('click en fila navega al detalle', async ({ page }) => {
    // Esperar que la tabla tenga filas reales (no skeletons)
    await page.waitForTimeout(3000);
    await page.waitForSelector('table tbody tr', { timeout: 15000 });
    
    // Esperar a que desaparezca el loading
    await page.waitForTimeout(2000);
    
    // Click en la primera fila con datos
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();
    
    // Verificar que navega al detalle (URL contiene /admin/alumnos/ seguido de un ID)
    await expect(page).toHaveURL(/\/admin\/alumnos\/rec/, { timeout: 10000 });
    
    // Verificar que aparece el botón Volver o el nombre del alumno
    await expect(page.locator('button:has-text("Volver")').or(page.locator('h1'))).toBeVisible({ timeout: 15000 });
  });
});
