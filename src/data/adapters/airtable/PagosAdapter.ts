/**
 * Adaptador Airtable para la tabla Pagos.
 */

import { Pago, EstadoPago, PagoStats } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, AirtableRecord } from './AirtableClient';

interface AirtablePagoFields {
  'Alumno'?: string[];
  'Nombre del Alumno'?: string[];
  'Link Pago Stripe'?: string;
  'Importe'?: number;
  'Moneda'?: string;
  'Estado de Pago'?: EstadoPago;
  'Fecha de Pago'?: string;
  'ID Sesión Stripe'?: string;
  'Link Recibo'?: string;
  'Notas Internas'?: string;
  'Días desde Pago'?: number;
  'Mes de Pago'?: string;
  'Resumen Inteligente del Pago'?: any;
  'Análisis de Riesgo de Pago'?: any;
}

function mapToPago(record: AirtableRecord<AirtablePagoFields>): Pago {
  const f = record.fields;
  return {
    id: record.id,
    createdTime: record.createdTime,
    alumnoId: f['Alumno']?.[0] || '',
    alumnoNombre: f['Nombre del Alumno']?.[0],
    linkPagoStripe: f['Link Pago Stripe'],
    importe: f['Importe'] || 0,
    moneda: (f['Moneda'] as Pago['moneda']) || 'EUR',
    estadoPago: f['Estado de Pago'] || 'Pendiente',
    fechaPago: f['Fecha de Pago'],
    idSesionStripe: f['ID Sesión Stripe'],
    linkRecibo: f['Link Recibo'],
    notasInternas: f['Notas Internas'],
    diasDesdePago: f['Días desde Pago'],
    mesPago: f['Mes de Pago'],
    resumenInteligente: typeof f['Resumen Inteligente del Pago'] === 'string' ? f['Resumen Inteligente del Pago'] : undefined,
    analisisRiesgo: typeof f['Análisis de Riesgo de Pago'] === 'string' ? f['Análisis de Riesgo de Pago'] : undefined,
  };
}

const TABLE = AIRTABLE_TABLES.PAGOS;

/** Lista pagos con filtros opcionales */
export async function fetchPagos(filters?: {
  estado?: EstadoPago;
  alumnoId?: string;
}): Promise<Pago[]> {
  const formulas: string[] = [];
  if (filters?.estado) formulas.push(`{Estado de Pago} = '${filters.estado}'`);
  if (filters?.alumnoId) formulas.push(`FIND('${filters.alumnoId}', ARRAYJOIN({Alumno}))`);

  const filterByFormula = formulas.length > 0
    ? (formulas.length === 1 ? formulas[0] : `AND(${formulas.join(', ')})`)
    : undefined;

  const records = await listRecords<AirtablePagoFields>(TABLE, {
    filterByFormula,
    sort: [{ field: 'Fecha de Pago', direction: 'desc' }],
  });

  return records.map(mapToPago);
}

/** Calcula estadísticas de pagos */
export async function fetchPagoStats(): Promise<PagoStats> {
  const pagos = await fetchPagos();

  return {
    totalRecaudado: pagos
      .filter(p => p.estadoPago === 'Pagado')
      .reduce((sum, p) => sum + p.importe, 0),
    pagosCompletados: pagos.filter(p => p.estadoPago === 'Pagado').length,
    pagosFallidos: pagos.filter(p => p.estadoPago === 'Fallido').length,
    pagosReembolsados: pagos.filter(p => p.estadoPago === 'Reembolsado').length,
  };
}

/** Agrupa pagos por mes para gráficos */
export async function fetchPagosPorMes(): Promise<{ mes: string; total: number }[]> {
  const pagos = await fetchPagos({ estado: 'Pagado' });

  const porMes = new Map<string, number>();
  pagos.forEach(p => {
    const mes = p.mesPago || (p.fechaPago ? new Date(p.fechaPago).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }) : 'Sin fecha');
    porMes.set(mes, (porMes.get(mes) || 0) + p.importe);
  });

  return Array.from(porMes.entries()).map(([mes, total]) => ({ mes, total }));
}
