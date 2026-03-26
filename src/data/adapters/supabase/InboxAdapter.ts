/**
 * Adaptador Supabase para la tabla Inbox.
 */

import { InboxEmail } from '@/types';
import { supabase, withAudit } from './SupabaseClient';

function mapToInbox(row: Record<string, unknown>): InboxEmail {
  return {
    id: row.id as string,
    createdTime: row.created_at as string | undefined,
    de: (row.de as string) || '',
    para: (row.para as string) || '',
    asunto: (row.asunto as string) || '',
    contenido: (row.contenido as string) || '',
    contenidoHtml: row.contenido_html as string | undefined,
    direccion: (row.direccion as InboxEmail['direccion']) || 'Recibido',
    estado: (row.estado as InboxEmail['estado']) || 'Nuevo',
    fecha: row.fecha as string | undefined,
    alumnoId: row.alumno_id as string | undefined,
    messageId: row.message_id as string | undefined,
    threadId: row.thread_id as string | undefined,
    resumenIA: row.resumen_ia as string | undefined,
    tipoConsulta: row.tipo_consulta as string | undefined,
    requiereAtencion: row.requiere_atencion as boolean | undefined,
    respuestaSugerida: row.respuesta_sugerida as string | undefined,
    respuestaFinal: row.respuesta_final as string | undefined,
    respuestaEnviada: row.respuesta_enviada as boolean | undefined,
    ultimaModificacion: row.updated_at as string | undefined,
  };
}

export async function fetchInbox(filters?: {
  estado?: string;
  direccion?: string;
  requiereAtencion?: boolean;
  alumnoId?: string;
  maxRecords?: number;
}): Promise<InboxEmail[]> {
  let query = supabase
    .from('inbox')
    .select('*')
    .order('fecha', { ascending: false, nullsFirst: false })
    .limit(filters?.maxRecords || 100);

  if (filters?.estado) {
    query = query.eq('estado', filters.estado);
  }
  if (filters?.direccion) {
    query = query.eq('direccion', filters.direccion);
  }
  if (filters?.requiereAtencion) {
    query = query.eq('requiere_atencion', true);
  }
  if (filters?.alumnoId) {
    query = query.eq('alumno_id', filters.alumnoId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fetchInbox: ${error.message}`);
  return (data || []).map(mapToInbox);
}

export async function updateInboxEmail(id: string, updates: {
  estado?: string;
  respuestaFinal?: string;
}): Promise<InboxEmail> {
  const fields: Record<string, unknown> = {};
  if (updates.estado) fields.estado = updates.estado;
  if (updates.respuestaFinal !== undefined) fields.respuesta_final = updates.respuestaFinal;

  await withAudit(() =>
    supabase.from('inbox').update(fields).eq('id', id)
  );

  const { data, error } = await supabase
    .from('inbox')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(`updateInboxEmail: ${error.message}`);
  return mapToInbox(data);
}
