/**
 * Adaptador Supabase para la tabla Cola de Emails.
 */

import { ColaEmail, EstadoEmail } from '@/types';
import { supabase, withAudit } from './SupabaseClient';

function mapToColaEmail(row: Record<string, unknown>): ColaEmail {
  return {
    id: row.id as string,
    createdTime: row.created_at as string | undefined,
    alumnoId: (row.alumno_id as string) || '',
    alumnoNombre: (row.alumno_nombre as string) || (row.alumno_nombre_join as string) || undefined,
    tipo: (row.tipo as ColaEmail['tipo']) || 'informacion',
    asunto: row.asunto as string | undefined,
    mensaje: (row.mensaje as string) || '',
    estado: (row.estado as EstadoEmail) || 'Pendiente',
    descripcion: row.descripcion as string | undefined,
  };
}

export async function fetchColaEmails(filters?: { estado?: EstadoEmail; tipo?: string }): Promise<ColaEmail[]> {
  let query = supabase
    .from('cola_emails')
    .select(`
      *,
      alumnos ( nombre )
    `)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (filters?.estado) {
    query = query.eq('estado', filters.estado);
  }
  if (filters?.tipo) {
    query = query.eq('tipo', filters.tipo);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fetchColaEmails: ${error.message}`);

  return (data || []).map((row: Record<string, unknown>) => {
    const alumno = row.alumnos as Record<string, unknown> | null;
    return mapToColaEmail({
      ...row,
      alumno_nombre_join: alumno?.nombre,
    });
  });
}

export async function aprobarEmail(id: string): Promise<ColaEmail> {
  await withAudit(() =>
    supabase.from('cola_emails').update({ estado: 'Pendiente' }).eq('id', id)
  );

  const { data, error } = await supabase
    .from('cola_emails')
    .select('*, alumnos ( nombre )')
    .eq('id', id)
    .single();
  if (error) throw new Error(`aprobarEmail: ${error.message}`);

  const alumno = data.alumnos as Record<string, unknown> | null;
  return mapToColaEmail({ ...data, alumno_nombre_join: alumno?.nombre });
}

export async function crearEmail(emailData: {
  alumnoId: string;
  tipo: string;
  mensaje: string;
}): Promise<ColaEmail> {
  const { data, error } = await withAudit(async () => {
    const result = await supabase
      .from('cola_emails')
      .insert({
        alumno_id: emailData.alumnoId,
        tipo: emailData.tipo,
        mensaje: emailData.mensaje,
        estado: 'Pendiente',
      })
      .select('*, alumnos ( nombre )')
      .single();
    return result;
  });

  if (error) throw new Error(`crearEmail: ${(error as Error).message}`);

  const alumno = (data as Record<string, unknown>)?.alumnos as Record<string, unknown> | null;
  return mapToColaEmail({ ...(data as Record<string, unknown>), alumno_nombre_join: alumno?.nombre });
}
