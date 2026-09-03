/**
 * Adaptador Airtable para la tabla Onboarding (form). Read-only.
 */

import { Onboarding } from '@/types';
import { AIRTABLE_TABLES, ONBOARDING_FIELDS as F } from '@/utils/constants';
import { listRecords, AirtableRecord } from './AirtableClient';

/**
 * Upstream field names, verbatim. Two are misspelled at the source
 * ("Kind os T-Shirt?", "Languaje on the Welcome book?") and cannot be fixed:
 * the production PAT has no `schema:write`.
 */
interface AirtableOnboardingFields {
  'T-Shirt Size?'?: string;
  'Kind os T-Shirt?'?: string;
  'Name on the T-Shirt'?: string;
  'Languaje on the Welcome book?'?: string;
  'Do you give us permission to use your Instagram account in future posts related to the course content?\n*This includes the possibility of tagging you in photos, videos, or collaborations created during the event.'?: string;
  'Instagram username: (only if you selected "Yes")'?: string;
  'Timestamp'?: string;
  'Alumnos'?: string[];
  /** Lookup — returns an array. Not mapped; derivable by joining Alumnos. */
  'Email (from Alumnos)'?: string[];
}

function mapToOnboarding(record: AirtableRecord<AirtableOnboardingFields>): Onboarding {
  const f = record.fields;
  return {
    id: record.id,
    createdTime: record.createdTime,
    // Empty link array -> '' so this record can never match a real alumno id.
    alumnoId: f[F.ALUMNOS]?.[0] || '',
    alumnoNombre: undefined,
    tshirtSize: f[F.TSHIRT_SIZE],
    tshirtKind: f[F.TSHIRT_KIND],
    tshirtName: f[F.TSHIRT_NAME],
    welcomeBookLanguage: f[F.WELCOME_BOOK_LANGUAGE],
    instagramConsent: f[F.INSTAGRAM_CONSENT],
    instagramUsername: f[F.INSTAGRAM_USERNAME],
    submittedAt: f[F.TIMESTAMP] || record.createdTime,
  };
}

export async function fetchOnboarding(options?: {
  alumnoId?: string;
}): Promise<Onboarding[]> {
  // alumnoId is filtered CLIENT-SIDE: FIND({Alumnos}) resolves display names,
  // not record IDs (see HistorialAdapter.ts:45). For the same reason no
  // maxRecords is passed — listRecords slices before this filter would run.
  const records = await listRecords<AirtableOnboardingFields>(AIRTABLE_TABLES.ONBOARDING, {});

  const rows = records
    .map(mapToOnboarding)
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));

  return options?.alumnoId
    ? rows.filter(o => o.alumnoId === options.alumnoId)
    : rows;
}
