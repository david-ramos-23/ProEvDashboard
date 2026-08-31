/**
 * Pure composition helpers for bulk (multi-recipient) email campaigns.
 * No side effects, no network — safe to unit test directly.
 */

import type { Alumno } from '@/types';
import { UI_TEMPLATE_OPTIONS } from './emailTemplates';

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
  filter: { edicionId?: string },
): { eligible: Alumno[]; sinEmail: Alumno[] } {
  // Filters by edition ID, matching Alumnos.tsx:150. NOT by name: the Airtable
  // adapter maps `edicionNombres` from a field that does not exist on the table
  // ("Nombre Edicion" — the API rejects it outright), so it is always empty and
  // a name filter silently matched nobody. `edicionIds` comes from the real
  // `Edicion` link field, and from `edicion_id` on the Supabase side.
  const candidates = filter.edicionId
    ? alumnos.filter((a) => (a.edicionIds ?? []).includes(filter.edicionId as string))
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
 * Derives the campaign types offered in bulk-composition mode from the `Tipo`
 * single-select options actually present on `Envios de Emails`.
 *
 * A campaign's `Tipo` is NOT the same thing as a compose template. Templates
 * (`UI_TEMPLATE_OPTIONS`) are a set of four canned message bodies; `Tipo` is the
 * campaign's category, and Airtable's select is the authority on which ones
 * exist. Iterating the templates and intersecting would drop every valid type
 * without a canned body — `informacion`, `bienvenida`, `felicitacion`,
 * `urgente` — leaving three of seven selectable.
 *
 * So: iterate the select, and borrow a template's label only when one happens to
 * share the name. A type added in the Airtable UI shows up here with no code
 * change, falling back to a per-type i18n key and finally to its raw value, so
 * an untranslated type is still offered rather than silently dropped.
 */
export function bulkTipoOptions(
  tipoOptions: string[],
): { key: string; labelKey: string }[] {
  const templateLabels = new Map(
    UI_TEMPLATE_OPTIONS.map((opt) => [opt.key as string, opt.labelKey]),
  );
  return tipoOptions.map((tipo) => ({
    key: tipo,
    labelKey: templateLabels.get(tipo) ?? `bulkCompose.tipos.${tipo}`,
  }));
}
