/**
 * Adaptador Airtable para la tabla Historial.
 */

import { Historial } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, AirtableRecord } from './AirtableClient';

interface AirtableHistorialFields {
  'Descripción Detallada'?: string;
  'Tipo de Acción'?: string;
  'Alumno'?: string[];
  'Origen del Evento'?: string;
  'Error Log'?: string;
  'Resumen Automático del Evento'?: string | { state: string; value: string | null };
  'Clasificación AI de Importancia'?: string | { state: string; value: string | null };
}

function mapToHistorial(record: AirtableRecord<AirtableHistorialFields>): Historial {
  const f = record.fields;
  const resumen = f['Resumen Automático del Evento'];
  const clasificacion = f['Clasificación AI de Importancia'];
  return {
    id: record.id,
    createdTime: record.createdTime,
    descripcion: f['Descripción Detallada'] || '',
    tipoAccion: f['Tipo de Acción'] || '',
    alumnoId: f['Alumno']?.[0],
    alumnoNombre: undefined,
    origenEvento: (f['Origen del Evento'] as Historial['origenEvento']) || 'Automatico',
    errorLog: f['Error Log'],
    resumenAutomatico: typeof resumen === 'string' ? resumen : undefined,
    clasificacionImportancia: typeof clasificacion === 'string'
      ? clasificacion as Historial['clasificacionImportancia']
      : undefined,
  };
}

export async function fetchHistorial(options?: {
  alumnoId?: string;
  maxRecords?: number;
}): Promise<Historial[]> {
  const formulas: string[] = [];
  if (options?.alumnoId) formulas.push(`FIND('${options.alumnoId}', ARRAYJOIN({Alumno}))`);

  const records = await listRecords<AirtableHistorialFields>(AIRTABLE_TABLES.HISTORIAL, {
    filterByFormula: formulas.length > 0 ? formulas[0] : undefined,
    sort: [{ field: 'ID', direction: 'desc' }],
    maxRecords: options?.maxRecords || 50,
  });

  return records.map(mapToHistorial);
}
