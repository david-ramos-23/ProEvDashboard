/**
 * Pure composition helpers for bulk (multi-recipient) email campaigns.
 * No side effects, no network — safe to unit test directly.
 */

import type { Alumno } from '@/types';
import { UI_TEMPLATE_OPTIONS, type TemplateKey } from './emailTemplates';

/**
 * Resolves the recipient cohort for a bulk campaign.
 *
 * Edition filtering happens here (in memory) rather than server-side because
 * Airtable's ARRAYJOIN over multipleRecordLinks only resolves the first linked
 * record — a student in two editions would silently vanish from a server-side
 * filter on the second edition (see AlumnosAdapter.ts fetchAlumnos).
 *
 * Students with no email on file are partitioned into `sinEmail` and excluded
 * from `eligible` — such a recipient would produce a queue row that can never
 * deliver, breaking "Emails Creados === Total Emails" as the campaign success
 * signal.
 */
export function resolveRecipients(
  alumnos: Alumno[],
  filter: { edicionNombre?: string },
): { eligible: Alumno[]; sinEmail: Alumno[] } {
  const candidates = filter.edicionNombre
    ? alumnos.filter((a) => (a.edicionNombres ?? []).includes(filter.edicionNombre as string))
    : alumnos;

  const eligible: Alumno[] = [];
  const sinEmail: Alumno[] = [];
  for (const alumno of candidates) {
    if (alumno.email && alumno.email.trim()) {
      eligible.push(alumno);
    } else {
      sinEmail.push(alumno);
    }
  }
  return { eligible, sinEmail };
}

/**
 * Derives the templates offered in bulk-composition mode from the `Tipo`
 * single-select options actually present on `Envios de Emails` — never a
 * hardcoded exclusion list. A template with no matching `Tipo` option
 * (currently `libre`) is hidden until the option exists, then reappears with
 * zero code change.
 */
export function bulkTemplateOptions(
  tipoOptions: string[],
): { key: TemplateKey; labelKey: string }[] {
  const available = new Set(tipoOptions);
  return UI_TEMPLATE_OPTIONS.filter((opt) => available.has(opt.key));
}
