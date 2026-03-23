/**
 * Adaptador Airtable para la tabla Historial.
 */

import { Historial } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, AirtableRecord } from './AirtableClient';

interface AirtableHistorialFields {
  'Descripcion Detallada'?: string;
  'Tipo de Accion'?: string;
  'Alumno Relacionado'?: string[];
  'Nombre del Alumno'?: string[];
  'Admin Responsable'?: string;
  'Origen del Evento'?: string;
  'Error Log'?: string;
  'Resumen Automatico del Evento'?: string;
  'Clasificacion AI de Importancia'?: string;
}

function mapToHistorial(record: AirtableRecord<AirtableHistorialFields>): Historial {
  const f = record.fields;
  return {
    id: record.id,
    createdTime: record.createdTime,
    descripcion: f['Descripcion Detallada'] || '',
    tipoAccion: f['Tipo de Accion'] || '',
    alumnoId: f['Alumno Relacionado']?.[0],
    alumnoNombre: f['Nombre del Alumno']?.[0],
    adminResponsable: f['Admin Responsable'],
    origenEvento: (f['Origen del Evento'] as Historial['origenEvento']) || 'Automatico',
    errorLog: f['Error Log'],
    resumenAutomatico: f['Resumen Automatico del Evento'],
    clasificacionImportancia: f['Clasificacion AI de Importancia'] as Historial['clasificacionImportancia'],
  };
}

export async function fetchHistorial(options?: {
  alumnoId?: string;
  maxRecords?: number;
}): Promise<Historial[]> {
  const formulas: string[] = [];
  if (options?.alumnoId) formulas.push(`FIND('${options.alumnoId}', ARRAYJOIN({Alumno Relacionado}))`);

  const records = await listRecords<AirtableHistorialFields>(AIRTABLE_TABLES.HISTORIAL, {
    filterByFormula: formulas.length > 0 ? formulas[0] : undefined,
    sort: [{ field: 'ID', direction: 'desc' }],
    maxRecords: options?.maxRecords || 50,
  });

  return records.map(mapToHistorial);
}
