/**
 * Adaptador Supabase para la tabla Revisiones de Video.
 */

import { RevisionVideo, EstadoRevision } from '@/types';
import { supabase, withAudit } from './SupabaseClient';

function mapToRevision(row: Record<string, unknown>): RevisionVideo {
  return {
    id: row.id as string,
    createdTime: row.created_at as string | undefined,
    alumnoId: (row.alumno_id as string) || '',
    alumnoNombre: row.alumno_nombre as string | undefined,
    revisorResponsable: row.revisor_responsable as string | undefined,
    fechaRevision: row.fecha_revision as string | undefined,
    videoEnviado: row.video_enviado as string | undefined,
    redesSociales: row.redes_sociales as string | undefined,
    usuariosRRSS: row.usuarios_rrss as string | undefined,
    estadoRevision: (row.estado_revision as EstadoRevision) || 'Pendiente',
    puntuacion: row.puntuacion as number | undefined,
    feedback: row.feedback as string | undefined,
    notasInternas: row.notas_internas as string | undefined,
    ultimaActualizacion: row.updated_at as string | undefined,
    diasDesdeEnvio: row.created_at
      ? Math.floor((Date.now() - new Date(row.created_at as string).getTime()) / 86400000)
      : undefined,
    estadoGeneralAlumno: row.estado_general_alumno as RevisionVideo['estadoGeneralAlumno'],
    resumenInteligente: row.resumen_inteligente as string | undefined,
    clasificacionAutomatica: row.clasificacion_automatica as string | undefined,
  };
}

/** Lista revisiones, opcionalmente filtradas por estado o alumnoId */
export async function fetchRevisiones(filters?: {
  estado?: EstadoRevision;
  alumnoId?: string;
}): Promise<RevisionVideo[]> {
  // Use a join to get alumno name and estado_general
  let query = supabase
    .from('revisiones_video')
    .select(`
      *,
      alumnos!inner ( nombre, estado_general )
    `)
    .order('fecha_revision', { ascending: true });

  if (filters?.estado) {
    query = query.eq('estado_revision', filters.estado);
  }
  if (filters?.alumnoId) {
    query = query.eq('alumno_id', filters.alumnoId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fetchRevisiones: ${error.message}`);

  return (data || []).map((row: Record<string, unknown>) => {
    const alumno = row.alumnos as Record<string, unknown> | null;
    return mapToRevision({
      ...row,
      alumno_nombre: alumno?.nombre,
      estado_general_alumno: alumno?.estado_general,
    });
  });
}

/** Obtiene una revisión por ID */
export async function fetchRevisionById(id: string): Promise<RevisionVideo> {
  const { data, error } = await supabase
    .from('revisiones_video')
    .select(`
      *,
      alumnos ( nombre, estado_general )
    `)
    .eq('id', id)
    .single();
  if (error) throw new Error(`fetchRevisionById: ${error.message}`);

  const alumno = data.alumnos as Record<string, unknown> | null;
  return mapToRevision({
    ...data,
    alumno_nombre: alumno?.nombre,
    estado_general_alumno: alumno?.estado_general,
  });
}

/** Actualiza una revisión (estado, puntuación, feedback, notas) */
export async function updateRevision(
  id: string,
  updates: Partial<{
    estadoRevision: EstadoRevision;
    puntuacion: number;
    feedback: string;
    notasInternas: string;
  }>
): Promise<RevisionVideo> {
  const fields: Record<string, unknown> = {};
  if (updates.estadoRevision) fields.estado_revision = updates.estadoRevision;
  if (updates.puntuacion != null) fields.puntuacion = updates.puntuacion;
  if (updates.feedback !== undefined) fields.feedback = updates.feedback;
  if (updates.notasInternas !== undefined) fields.notas_internas = updates.notasInternas;

  await withAudit(() =>
    supabase.from('revisiones_video').update(fields).eq('id', id)
  );

  return fetchRevisionById(id);
}

/** Cuenta revisiones por estado */
export async function fetchRevisionStats(): Promise<{
  pendientes: number;
  revisadasHoy: number;
  total: number;
}> {
  const { data, error } = await supabase
    .from('revisiones_video')
    .select('estado_revision, fecha_revision');
  if (error) throw new Error(`fetchRevisionStats: ${error.message}`);

  const today = new Date().toISOString().split('T')[0];
  let pendientes = 0;
  let revisadasHoy = 0;

  (data || []).forEach((r: Record<string, unknown>) => {
    if (r.estado_revision === 'Pendiente') pendientes++;
    if ((r.fecha_revision as string)?.startsWith(today)) revisadasHoy++;
  });

  return { pendientes, revisadasHoy, total: (data || []).length };
}
