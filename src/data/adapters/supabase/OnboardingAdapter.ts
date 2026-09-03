/**
 * Adaptador Supabase para la tabla onboarding. Read-only.
 */

import { Onboarding } from '@/types';
import { supabase } from './SupabaseClient';

function mapToOnboarding(row: Record<string, unknown>): Onboarding {
  return {
    id: row.id as string,
    createdTime: row.created_at as string | undefined,
    alumnoId: (row.alumno_id as string) || '',
    alumnoNombre: row.alumno_nombre as string | undefined,
    tshirtSize: row.tshirt_size as string | undefined,
    tshirtKind: row.tshirt_kind as string | undefined,
    tshirtName: row.tshirt_name as string | undefined,
    welcomeBookLanguage: row.welcome_book_language as string | undefined,
    instagramConsent: row.instagram_consent as string | undefined,
    instagramUsername: row.instagram_username as string | undefined,
    submittedAt: (row.timestamp_form as string | undefined) ?? (row.created_at as string | undefined),
  };
}

export async function fetchOnboarding(options?: {
  alumnoId?: string;
}): Promise<Onboarding[]> {
  let query = supabase
    .from('onboarding')
    .select(`
      *,
      alumnos ( nombre )
    `)
    .order('timestamp_form', { ascending: false, nullsFirst: false });

  // Supabase CAN filter server-side (alumno_id is a real UUID FK, unlike the
  // Airtable link). Kept behind the same option so both adapters are drop-in
  // interchangeable; the hook does not pass it (see design D-A1).
  if (options?.alumnoId) {
    query = query.eq('alumno_id', options.alumnoId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fetchOnboarding: ${error.message}`);

  return (data || []).map((row: Record<string, unknown>) => {
    const alumno = row.alumnos as Record<string, unknown> | null;
    return mapToOnboarding({ ...row, alumno_nombre: alumno?.nombre });
  });
}
