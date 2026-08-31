import type { EstadoGeneral } from '@/types';
import { ESTADOS_FUERA_DE_ENGAGEMENT } from '@/utils/constants';

export interface EngagementInput {
  estado: EstadoGeneral;
  score: number | null | undefined;
}

/**
 * Average engagement score for the dashboard KPI.
 *
 * Students in `ESTADOS_FUERA_DE_ENGAGEMENT` are skipped: they are neither
 * active students nor prospects, so including them would move the KPI without
 * saying anything about engagement. Students with no score are skipped too, so
 * a missing value does not count as a zero.
 *
 * Shared by the Airtable and Supabase adapters so both report the same number.
 */
export function promedioEngagement(alumnos: readonly EngagementInput[]): number {
  const scores = alumnos
    .filter(a => a.score != null && !ESTADOS_FUERA_DE_ENGAGEMENT.includes(a.estado))
    .map(a => Number(a.score));

  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length);
}
