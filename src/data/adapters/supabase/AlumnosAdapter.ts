/**
 * Adaptador Supabase para la tabla Alumnos.
 * Mismas signatures que el adaptador Airtable.
 */

import { Alumno, EstadoGeneral, DashboardStats } from '@/types';
import { ESTADO } from '@/utils/constants';
import { supabase, withAudit } from './SupabaseClient';

function mapToAlumno(row: Record<string, unknown>): Alumno {
  return {
    id: row.id as string,
    createdTime: row.created_at as string | undefined,
    nombre: (row.nombre as string) || '',
    email: (row.email as string) || '',
    telefono: row.telefono as string | undefined,
    estadoGeneral: (row.estado_general as EstadoGeneral) || 'Privado',
    idioma: row.idioma === 'Ingles' ? 'Ingles' : 'Espanol',
    moduloSolicitado: row.modulo_solicitado as string | undefined,
    modulosCompletados: row.modulos_completados as string[] | undefined,
    edicionId: row.edicion_id as string | undefined,
    edicion: row.edicion_nombre as string | undefined,
    fotoPerfil: row.foto_perfil as string | undefined,
    plazoRevision: row.plazo_revision as string | undefined,
    fechaPlazo: row.fecha_plazo as string | undefined,
    fechaPreinscripcion: row.fecha_preinscripcion as string | undefined,
    moduloReserva: row.modulo_reserva as string | undefined,
    fechaEntradaReserva: row.fecha_entrada_reserva as string | undefined,
    totalRevisiones: row.total_revisiones as number | undefined,
    ultimaFechaRevision: row.ultima_fecha_revision as string | undefined,
    estadoRevisionReciente: row.estado_revision_reciente as Alumno['estadoRevisionReciente'],
    totalPagos: row.total_pagos as number | undefined,
    importeTotalPagado: row.importe_total_pagado != null ? Number(row.importe_total_pagado) : undefined,
    fechaUltimoPago: row.fecha_ultimo_pago as string | undefined,
    puntuacionVideo: row.puntuacion_video as number | undefined,
    engagementScore: row.engagement_score != null ? Number(row.engagement_score) : undefined,
    resumenFeedbackIA: row.resumen_feedback_ia as string | undefined,
    siguienteAccionIA: row.siguiente_accion_ia as string | undefined,
    notasInternas: row.notas_internas as string | undefined,
    adminResponsable: row.admin_responsable as string | undefined,
    ultimaModificacion: row.updated_at as string | undefined,
  };
}

/** Lista todos los alumnos, con filtros opcionales */
export async function fetchAlumnos(filters?: {
  estado?: EstadoGeneral;
  edicionNombre?: string;
  modulo?: string;
  search?: string;
}): Promise<Alumno[]> {
  let query = supabase
    .from('alumnos_enriched')
    .select('*')
    .order('updated_at', { ascending: false });

  if (filters?.estado) {
    query = query.eq('estado_general', filters.estado);
  }
  if (filters?.edicionNombre) {
    query = query.eq('edicion_nombre', filters.edicionNombre);
  }
  if (filters?.modulo) {
    query = query.eq('modulo_solicitado', filters.modulo);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    query = query.or(`nombre.ilike.%${s}%,email.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fetchAlumnos: ${error.message}`);
  return (data || []).map(mapToAlumno);
}

/** Obtiene un alumno por su ID */
export async function fetchAlumnoById(id: string): Promise<Alumno> {
  const { data, error } = await supabase
    .from('alumnos_enriched')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(`fetchAlumnoById: ${error.message}`);
  return mapToAlumno(data);
}

/** Actualiza campos de un alumno */
export async function updateAlumno(
  id: string,
  updates: Partial<{
    estadoGeneral: EstadoGeneral;
    notasInternas: string;
    fechaPlazo: string;
  }>
): Promise<Alumno> {
  const fields: Record<string, unknown> = {};
  if (updates.estadoGeneral) fields.estado_general = updates.estadoGeneral;
  if (updates.notasInternas !== undefined) fields.notas_internas = updates.notasInternas;
  if (updates.fechaPlazo) fields.fecha_plazo = updates.fechaPlazo;

  const { error } = await withAudit(() =>
    supabase.from('alumnos').update(fields).eq('id', id)
  );
  if (error) throw new Error(`updateAlumno: ${(error as Error).message}`);

  return fetchAlumnoById(id);
}

/** Returns a count of alumnos per normalized module name */
export async function fetchAlumnoCountByModulo(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('alumnos')
    .select('modulo_solicitado')
    .not('modulo_solicitado', 'is', null)
    .neq('modulo_solicitado', '');

  if (error) throw new Error(`fetchAlumnoCountByModulo: ${error.message}`);

  const counts = new Map<string, number>();
  (data || []).forEach((r: Record<string, unknown>) => {
    const raw = r.modulo_solicitado as string;
    if (!raw) return;
    const key = raw.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

/** Fetches only the nombre for a set of alumno IDs */
export async function fetchAlumnoNombresByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from('alumnos')
    .select('id, nombre')
    .in('id', ids);
  if (error) throw new Error(`fetchAlumnoNombresByIds: ${error.message}`);
  return new Map((data || []).map((r: Record<string, unknown>) => [r.id as string, (r.nombre as string) || '']));
}

/** Calcula estadísticas del dashboard */
export async function fetchDashboardStats(options?: { edicionNombre?: string }): Promise<DashboardStats> {
  let query = supabase
    .from('alumnos_enriched')
    .select('estado_general, importe_total_pagado, engagement_score');

  if (options?.edicionNombre) {
    query = query.eq('edicion_nombre', options.edicionNombre);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fetchDashboardStats: ${error.message}`);

  const alumnos = data || [];

  const alumnosPorEstado = {} as Record<EstadoGeneral, number>;
  const allEstados = Object.values(ESTADO);
  allEstados.forEach(e => { alumnosPorEstado[e] = 0; });

  let ingresosTotales = 0;
  let engagementSum = 0;
  let engagementCount = 0;

  alumnos.forEach((f: Record<string, unknown>) => {
    const estado = (f.estado_general as EstadoGeneral) || 'Privado';
    alumnosPorEstado[estado] = (alumnosPorEstado[estado] || 0) + 1;
    ingresosTotales += Number(f.importe_total_pagado) || 0;
    if (f.engagement_score != null) {
      engagementSum += Number(f.engagement_score);
      engagementCount++;
    }
  });

  const engagementPromedio = engagementCount > 0 ? Math.round(engagementSum / engagementCount) : 0;

  return {
    totalAlumnos: alumnos.length,
    alumnosPorEstado,
    totalPagados: alumnosPorEstado[ESTADO.PAGADO] || 0,
    pendientesRevision: alumnosPorEstado[ESTADO.EN_REVISION] || 0,
    ingresosTotales,
    engagementPromedio,
  };
}
