/**
 * Adaptador Supabase para la tabla Ediciones.
 */

import { Edicion } from '@/types';
import { supabase, withAudit } from './SupabaseClient';

function mapToEdicion(row: Record<string, unknown>): Edicion {
  return {
    id: row.id as string,
    createdTime: row.created_at as string | undefined,
    nombre: (row.nombre as string) || '',
    estado: (row.estado as Edicion['estado']) || 'Planificada',
    esEdicionActiva: (row.es_edicion_activa as boolean) || false,
    fechaInicioInscripcion: row.fecha_inicio_inscripcion as string | undefined,
    fechaFinInscripcion: row.fecha_fin_inscripcion as string | undefined,
    fechaInicioCurso: row.fecha_inicio_curso as string | undefined,
    fechaFinCurso: row.fecha_fin_curso as string | undefined,
    modulosDisponibles: row.modulos_disponibles as string[] | undefined,
  };
}

export async function fetchEdiciones(): Promise<Edicion[]> {
  const { data, error } = await supabase
    .from('ediciones')
    .select('*')
    .order('fecha_inicio_inscripcion', { ascending: false });
  if (error) throw new Error(`fetchEdiciones: ${error.message}`);
  return (data || []).map(mapToEdicion);
}

export async function updateEdicion(
  id: string,
  updates: Partial<{ esEdicionActiva: boolean; estado: string }>
): Promise<Edicion> {
  const fields: Record<string, unknown> = {};
  if (updates.esEdicionActiva !== undefined) fields.es_edicion_activa = updates.esEdicionActiva;
  if (updates.estado) fields.estado = updates.estado;

  await withAudit(() =>
    supabase.from('ediciones').update(fields).eq('id', id)
  );

  const { data, error } = await supabase
    .from('ediciones')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(`updateEdicion: ${error.message}`);
  return mapToEdicion(data);
}
