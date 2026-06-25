import type { Edicion } from '@/types';

/**
 * Returns the edition name whose date window contains fechaPago.
 * Window: fechaInicioInscripcion → fechaFinCurso (widest span).
 * Falls back to fechaInicioCurso as start if no inscripcion date.
 * Heuristic — assumes edition windows don't overlap.
 * Robust fix: add Edicion link to Pagos table in Airtable + n8n Stripe workflow.
 */
export function resolveEdicionByDate(
  fechaPago: string | null | undefined,
  ediciones: Edicion[],
): string | null {
  if (!fechaPago) return null;
  const payDate = new Date(fechaPago);
  for (const ed of ediciones) {
    const start = ed.fechaInicioInscripcion ?? ed.fechaInicioCurso;
    const end = ed.fechaFinCurso ?? ed.fechaFinInscripcion;
    if (!start || !end) continue;
    if (payDate >= new Date(start) && payDate <= new Date(end)) return ed.nombre;
  }
  return null;
}
