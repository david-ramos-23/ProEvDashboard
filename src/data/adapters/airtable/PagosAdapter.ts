/**
 * Adaptador Airtable para la tabla Pagos.
 */

import { Pago, EstadoPago, PagoStats } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, AirtableRecord, sanitizeForFormula } from './AirtableClient';
import { fetchAlumnoNombresByIds } from './AlumnosAdapter';

interface AirtablePagoFields {
  'Alumno'?: string[];
  'Link Pago Stripe'?: string;
  'Importe'?: number;
  'Moneda'?: string;
  'Estado de Pago'?: string;
  'Fecha de Pago'?: string;
  'ID Sesión Stripe'?: string;
  'Link Recibo'?: string;
  'Notas Internas'?: string;
  'Días desde Pago'?: number;
  'Mes de Pago'?: string;
  'Resumen Inteligente del Pago'?: string | { state: string; value: string | null };
  'Análisis de Riesgo de Pago'?: string | { state: string; value: string | null };
}

/** Airtable almacena el estado como 'Completado'; lo normalizamos a 'Pagado' internamente */
function normalizeEstadoPago(raw: string | undefined): EstadoPago {
  if (raw === 'Completado') return 'Pagado';
  return (raw as EstadoPago) || 'Pendiente';
}

function mapToPago(record: AirtableRecord<AirtablePagoFields>): Pago {
  const f = record.fields;
  const resumen = f['Resumen Inteligente del Pago'];
  const analisis = f['Análisis de Riesgo de Pago'];
  return {
    id: record.id,
    createdTime: record.createdTime,
    alumnoId: f['Alumno']?.[0] || '',
    linkPagoStripe: f['Link Pago Stripe'],
    importe: f['Importe'] || 0,
    moneda: (f['Moneda'] as Pago['moneda']) || 'EUR',
    estadoPago: normalizeEstadoPago(f['Estado de Pago']),
    fechaPago: f['Fecha de Pago'],
    idSesionStripe: f['ID Sesión Stripe'],
    linkRecibo: f['Link Recibo'],
    notasInternas: f['Notas Internas'],
    diasDesdePago: f['Días desde Pago'],
    mesPago: f['Mes de Pago'],
    resumenInteligente: typeof resumen === 'string' ? resumen : undefined,
    analisisRiesgo: typeof analisis === 'string' ? analisis : undefined,
  };
}

const TABLE = AIRTABLE_TABLES.PAGOS;

/** Lista pagos con filtros opcionales */
export async function fetchPagos(filters?: {
  estado?: EstadoPago;
  alumnoId?: string;
}): Promise<Pago[]> {
  const formulas: string[] = [];
  if (filters?.estado) {
    // 'Pagado' se almacena como 'Completado' en Airtable; buscamos ambos por compatibilidad
    const estadoQuery = filters.estado === 'Pagado'
      ? `OR({Estado de Pago} = 'Pagado', {Estado de Pago} = 'Completado')`
      : `{Estado de Pago} = '${sanitizeForFormula(filters.estado)}'`;
    formulas.push(estadoQuery);
  }
  if (filters?.alumnoId) formulas.push(`FIND('${sanitizeForFormula(filters.alumnoId)}', ARRAYJOIN({Alumno}))`);

  const filterByFormula = formulas.length > 0
    ? (formulas.length === 1 ? formulas[0] : `AND(${formulas.join(', ')})`)
    : undefined;

  const records = await listRecords<AirtablePagoFields>(TABLE, {
    filterByFormula,
    sort: [{ field: 'Fecha de Pago', direction: 'desc' }],
  });

  const pagos = records.map(mapToPago);

  // Enrich with alumno names
  const alumnoIds = [...new Set(pagos.map(p => p.alumnoId).filter((id): id is string => !!id))];
  if (alumnoIds.length > 0) {
    const nombreMap = await fetchAlumnoNombresByIds(alumnoIds);
    pagos.forEach(p => { if (p.alumnoId) p.alumnoNombre = nombreMap.get(p.alumnoId); });
  }

  return pagos;
}

/** Calcula estadísticas de pagos */
/** Calcula estadísticas de pagos — solo descarga los campos necesarios */
export async function fetchPagoStats(): Promise<PagoStats> {
  const records = await listRecords<Pick<AirtablePagoFields, 'Estado de Pago' | 'Importe'>>(TABLE, {
    fields: ['Estado de Pago', 'Importe'],
  });

  let totalRecaudado = 0;
  let pagosCompletados = 0;
  let pagosFallidos = 0;
  let pagosReembolsados = 0;

  records.forEach(r => {
    const estado = normalizeEstadoPago(r.fields['Estado de Pago']);
    const importe = r.fields['Importe'] || 0;
    if (estado === 'Pagado') { totalRecaudado += importe; pagosCompletados++; }
    else if (estado === 'Fallido') pagosFallidos++;
    else if (estado === 'Reembolsado') pagosReembolsados++;
  });

  return { totalRecaudado, pagosCompletados, pagosFallidos, pagosReembolsados };
}

/** Agrupa pagos por mes para gráficos — solo descarga los campos necesarios */
export async function fetchPagosPorMes(): Promise<{ mes: string; total: number }[]> {
  const records = await listRecords<Pick<AirtablePagoFields, 'Estado de Pago' | 'Importe' | 'Mes de Pago' | 'Fecha de Pago'>>(TABLE, {
    filterByFormula: `OR({Estado de Pago} = 'Pagado', {Estado de Pago} = 'Completado')`,
    fields: ['Estado de Pago', 'Importe', 'Mes de Pago', 'Fecha de Pago'],
  });

  const porMes = new Map<string, number>();
  records.forEach(r => {
    const f = r.fields;
    const mes = f['Mes de Pago'] || (f['Fecha de Pago'] ? new Date(f['Fecha de Pago']!).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }) : 'Sin fecha');
    porMes.set(mes, (porMes.get(mes) || 0) + (f['Importe'] || 0));
  });

  return Array.from(porMes.entries()).map(([mes, total]) => ({ mes, total }));
}
