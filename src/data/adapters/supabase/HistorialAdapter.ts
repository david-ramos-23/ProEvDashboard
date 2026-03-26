/**
 * Adaptador Supabase para la tabla Historial.
 */

import { Historial } from '@/types';
import { supabase } from './SupabaseClient';

function mapToHistorial(row: Record<string, unknown>): Historial {
  return {
    id: row.id as string,
    createdTime: row.created_at as string | undefined,
    descripcion: (row.descripcion as string) || '',
    tipoAccion: (row.tipo_accion as string) || '',
    alumnoId: row.alumno_id as string | undefined,
    alumnoNombre: row.alumno_nombre as string | undefined,
    adminResponsable: row.admin_responsable as string | undefined,
    origenEvento: (row.origen_evento as Historial['origenEvento']) || 'Automatico',
    errorLog: row.error_log as string | undefined,
    resumenAutomatico: row.resumen_automatico as string | undefined,
    clasificacionImportancia: row.clasificacion_importancia as Historial['clasificacionImportancia'],
  };
}

export async function fetchHistorial(options?: {
  alumnoId?: string;
  maxRecords?: number;
}): Promise<Historial[]> {
  let query = supabase
    .from('historial')
    .select(`
      *,
      alumnos ( nombre )
    `)
    .order('created_at', { ascending: false })
    .limit(options?.maxRecords || 50);

  if (options?.alumnoId) {
    query = query.eq('alumno_id', options.alumnoId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fetchHistorial: ${error.message}`);

  return (data || []).map((row: Record<string, unknown>) => {
    const alumno = row.alumnos as Record<string, unknown> | null;
    return mapToHistorial({
      ...row,
      alumno_nombre: alumno?.nombre,
    });
  });
}
