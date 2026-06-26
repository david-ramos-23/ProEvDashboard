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
