import type { Edicion } from '@/types';

/**
 * Returns the edition name whose date window contains fechaPago.
 * When windows overlap, picks the narrowest (most specific) window.
 * Robust fix: add Edicion link to Pagos table in Airtable + n8n Stripe workflow.
 */
export function resolveEdicionByDate(
  fechaPago: string | null | undefined,
  ediciones: Edicion[],
): string | null {
  if (!fechaPago) return null;
  const payDate = new Date(fechaPago);
  const matches: Array<{ nombre: string; duration: number }> = [];
  for (const ed of ediciones) {
    const start = ed.fechaInicioInscripcion ?? ed.fechaInicioCurso;
    const end = ed.fechaFinCurso ?? ed.fechaFinInscripcion;
    if (!start || !end) continue;
    const s = new Date(start);
    const e = new Date(end);
    if (payDate >= s && payDate <= e) {
      matches.push({ nombre: ed.nombre, duration: e.getTime() - s.getTime() });
    }
  }
  if (!matches.length) return null;
  return matches.sort((a, b) => a.duration - b.duration)[0].nombre;
}

/**
 * Filters payments to those belonging to a specific edition using date-window inference.
 * Payments without a date are excluded from specific editions (they appear only in the
 * all-editions view). This replaces the `|| !p.fechaPago` pattern that inflated counts.
 *
 * TODO(tech-debt): add an Edicion linked-record field to the Pagos table in the n8n
 * Stripe workflow so this inference is not needed.
 */
export function pagosDeEdicion<T extends { fechaPago?: string | null }>(
  pagos: T[],
  ediciones: Edicion[],
  selectedNombre: string | null,
): T[] {
  if (!selectedNombre) return pagos;
  return pagos.filter(p => resolveEdicionByDate(p.fechaPago ?? null, ediciones) === selectedNombre);
}
