/**
 * Adaptador Supabase para la tabla Modulos.
 * Uses the modulos_enriched view which includes inscritos count.
 */

import { Modulo } from '@/types';
import { supabase } from './SupabaseClient';

function mapToModulo(row: Record<string, unknown>): Modulo {
  return {
    id: row.id as string,
    createdTime: row.created_at as string | undefined,
    moduloId: (row.modulo_id as string) || '',
    nombre: (row.nombre as string) || '',
    precioOnline: row.precio_online != null ? Number(row.precio_online) : undefined,
    activo: (row.activo as boolean) || false,
    capacidad: row.capacidad as number | undefined,
    inscritos: (row.inscritos as number) || 0,
    reservaPrelanzamiento: row.reserva_prelanzamiento as number | undefined,
  };
}

export async function fetchModulos(): Promise<Modulo[]> {
  const { data, error } = await supabase
    .from('modulos_enriched')
    .select('*')
    .eq('activo', true);
  if (error) throw new Error(`fetchModulos: ${error.message}`);
  return (data || []).map(mapToModulo);
}
