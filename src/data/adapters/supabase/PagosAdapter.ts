/**
 * Adaptador Supabase para la tabla Pagos.
 */

import { Pago, EstadoPago, PagoStats } from '@/types';
import { supabase } from './SupabaseClient';

function mapToPago(row: Record<string, unknown>): Pago {
  return {
    id: row.id as string,
    createdTime: row.created_at as string | undefined,
    alumnoId: (row.alumno_id as string) || '',
    alumnoNombre: row.alumno_nombre as string | undefined,
    linkPagoStripe: row.link_pago_stripe as string | undefined,
    importe: Number(row.importe) || 0,
    moneda: (row.moneda as Pago['moneda']) || 'EUR',
    estadoPago: (row.estado_pago as EstadoPago) || 'Pendiente',
    fechaPago: row.fecha_pago as string | undefined,
    idSesionStripe: row.id_sesion_stripe as string | undefined,
    linkRecibo: row.link_recibo as string | undefined,
    notasInternas: row.notas_internas as string | undefined,
    diasDesdePago: row.fecha_pago
      ? Math.floor((Date.now() - new Date(row.fecha_pago as string).getTime()) / 86400000)
      : undefined,
    mesPago: row.fecha_pago
      ? new Date(row.fecha_pago as string).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
      : undefined,
    resumenInteligente: row.resumen_inteligente as string | undefined,
    analisisRiesgo: row.analisis_riesgo as string | undefined,
  };
}

/** Lista pagos con filtros opcionales */
export async function fetchPagos(filters?: {
  estado?: EstadoPago;
  alumnoId?: string;
}): Promise<Pago[]> {
  let query = supabase
    .from('pagos')
    .select(`
      *,
      alumnos ( nombre )
    `)
    .order('fecha_pago', { ascending: false, nullsFirst: false });

  if (filters?.estado) {
    query = query.eq('estado_pago', filters.estado);
  }
  if (filters?.alumnoId) {
    query = query.eq('alumno_id', filters.alumnoId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fetchPagos: ${error.message}`);

  return (data || []).map((row: Record<string, unknown>) => {
    const alumno = row.alumnos as Record<string, unknown> | null;
    return mapToPago({
      ...row,
      alumno_nombre: alumno?.nombre,
    });
  });
}

/** Calcula estadísticas de pagos */
export async function fetchPagoStats(): Promise<PagoStats> {
  const { data, error } = await supabase
    .from('pagos')
    .select('estado_pago, importe');
  if (error) throw new Error(`fetchPagoStats: ${error.message}`);

  let totalRecaudado = 0;
  let pagosCompletados = 0;
  let pagosFallidos = 0;
  let pagosReembolsados = 0;

  (data || []).forEach((r: Record<string, unknown>) => {
    const estado = r.estado_pago as string;
    const importe = Number(r.importe) || 0;
    if (estado === 'Pagado') { totalRecaudado += importe; pagosCompletados++; }
    else if (estado === 'Fallido') pagosFallidos++;
    else if (estado === 'Reembolsado') pagosReembolsados++;
  });

  return { totalRecaudado, pagosCompletados, pagosFallidos, pagosReembolsados };
}

/** Agrupa pagos por mes para gráficos */
export async function fetchPagosPorMes(): Promise<{ mes: string; total: number }[]> {
  const { data, error } = await supabase
    .from('pagos')
    .select('estado_pago, importe, fecha_pago')
    .eq('estado_pago', 'Pagado');
  if (error) throw new Error(`fetchPagosPorMes: ${error.message}`);

  const porMes = new Map<string, number>();
  (data || []).forEach((r: Record<string, unknown>) => {
    const fecha = r.fecha_pago as string | null;
    const mes = fecha
      ? new Date(fecha).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
      : 'Sin fecha';
    porMes.set(mes, (porMes.get(mes) || 0) + (Number(r.importe) || 0));
  });

  return Array.from(porMes.entries()).map(([mes, total]) => ({ mes, total }));
}
