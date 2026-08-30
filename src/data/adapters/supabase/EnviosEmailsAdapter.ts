/**
 * Adaptador Supabase para la tabla Envios de Emails (campañas de envío masivo).
 *
 * Twin of `airtable/EnviosEmailsAdapter.ts` — same exported signatures. `crearEnvio`
 * ALWAYS writes estado: 'Borrador', same non-negotiable property as the Airtable twin.
 */

import { EnvioEmail, EstadoEnvio, TipoEmail } from '@/types';
import { supabase, withAudit } from './SupabaseClient';

/** Supabase returns SQL NULL as `null`; Airtable simply omits the field (→ undefined). Normalize
 * both to `undefined` so the two mappers produce an identical `EnvioEmail` shape. */
function nullToUndefined<T>(val: T | null | undefined): T | undefined {
  return val == null ? undefined : val;
}

function mapToEnvioEmail(row: Record<string, unknown>): EnvioEmail {
  return {
    id: row.id as string,
    createdTime: nullToUndefined(row.created_at as string | null),
    nombre: (row.nombre as string) || '',
    alumnosIds: (row.alumnos_ids as string[]) || [],
    tipo: (row.tipo as TipoEmail) || 'informacion',
    mensaje: (row.mensaje as string) || '',
    descripcion: nullToUndefined(row.descripcion as string | null),
    estado: (row.estado as EstadoEnvio) || 'Borrador',
    totalEmails: nullToUndefined(row.total_emails as number | null),
    emailsCreados: nullToUndefined(row.emails_creados as number | null),
    fechaCompletado: nullToUndefined(row.fecha_completado as string | null),
  };
}

export async function fetchEnviosEmails(filters?: { estados?: EstadoEnvio[] }): Promise<EnvioEmail[]> {
  let query = supabase
    .from('envios_emails')
    .select('*')
    .order('updated_at', { ascending: false });

  if (filters?.estados?.length) {
    query = query.in('estado', filters.estados);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fetchEnviosEmails: ${error.message}`);

  return (data || []).map((row: Record<string, unknown>) => mapToEnvioEmail(row));
}

/**
 * Creates a new campaign. ALWAYS writes estado: 'Borrador' — mirrors the Airtable twin's
 * non-negotiable draft-first guarantee.
 */
export async function crearEnvio(data: {
  nombre: string;
  alumnosIds: string[];
  tipo: string;
  mensaje: string;
  descripcion?: string;
}): Promise<EnvioEmail> {
  const { data: row, error } = await withAudit(async () => {
    const result = await supabase
      .from('envios_emails')
      .insert({
        nombre: data.nombre,
        alumnos_ids: data.alumnosIds,
        tipo: data.tipo,
        mensaje: data.mensaje,
        descripcion: data.descripcion,
        estado: 'Borrador',
        total_emails: data.alumnosIds.length,
      })
      .select('*')
      .single();
    return result;
  });

  if (error) throw new Error(`crearEnvio: ${(error as Error).message}`);
  return mapToEnvioEmail(row as Record<string, unknown>);
}

/**
 * Updates campaign composition fields. `estado` is deliberately absent from this
 * input type — mirrors the Airtable twin.
 */
export async function actualizarEnvio(id: string, updates: {
  nombre?: string;
  alumnosIds?: string[];
  tipo?: string;
  mensaje?: string;
  descripcion?: string;
}): Promise<EnvioEmail> {
  const patch: Record<string, unknown> = {};
  if (updates.nombre !== undefined) patch.nombre = updates.nombre;
  if (updates.alumnosIds !== undefined) {
    patch.alumnos_ids = updates.alumnosIds;
    patch.total_emails = updates.alumnosIds.length;
  }
  if (updates.tipo !== undefined) patch.tipo = updates.tipo;
  if (updates.mensaje !== undefined) patch.mensaje = updates.mensaje;
  if (updates.descripcion !== undefined) patch.descripcion = updates.descripcion;

  const { data: row, error } = await withAudit(async () => {
    const result = await supabase
      .from('envios_emails')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    return result;
  });

  if (error) throw new Error(`actualizarEnvio: ${(error as Error).message}`);
  return mapToEnvioEmail(row as Record<string, unknown>);
}

/** Deletes a draft campaign. */
export async function eliminarEnvio(id: string): Promise<void> {
  const { error } = await supabase
    .from('envios_emails')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`eliminarEnvio: ${error.message}`);
}
