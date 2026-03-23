/**
 * Adaptador Airtable para la tabla Ediciones.
 */

import { Edicion } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, updateRecord, AirtableRecord } from './AirtableClient';

interface AirtableEdicionFields {
  'Nombre'?: string;
  'Estado'?: string;
  'Es Edicion Activa'?: boolean;
  'Fecha Inicio Inscripcion'?: string;
  'Fecha Fin Inscripcion'?: string;
  'Fecha Inicio Curso'?: string;
  'Fecha Fin Curso'?: string;
  'Modulos Disponibles'?: string[];
}

function mapToEdicion(record: AirtableRecord<AirtableEdicionFields>): Edicion {
  const f = record.fields;
  return {
    id: record.id,
    createdTime: record.createdTime,
    nombre: f['Nombre'] || '',
    estado: (f['Estado'] as Edicion['estado']) || 'Planificada',
    esEdicionActiva: f['Es Edicion Activa'] || false,
    fechaInicioInscripcion: f['Fecha Inicio Inscripcion'],
    fechaFinInscripcion: f['Fecha Fin Inscripcion'],
    fechaInicioCurso: f['Fecha Inicio Curso'],
    fechaFinCurso: f['Fecha Fin Curso'],
    modulosDisponibles: f['Modulos Disponibles'],
  };
}

export async function fetchEdiciones(): Promise<Edicion[]> {
  const records = await listRecords<AirtableEdicionFields>(AIRTABLE_TABLES.EDICIONES, {
    sort: [{ field: 'Fecha Inicio Inscripcion', direction: 'desc' }],
  });
  return records.map(mapToEdicion);
}

export async function updateEdicion(
  id: string,
  updates: Partial<{ esEdicionActiva: boolean; estado: string }>
): Promise<Edicion> {
  const fields: Partial<AirtableEdicionFields> = {};
  if (updates.esEdicionActiva !== undefined) fields['Es Edicion Activa'] = updates.esEdicionActiva;
  if (updates.estado) fields['Estado'] = updates.estado;

  const record = await updateRecord<AirtableEdicionFields>(AIRTABLE_TABLES.EDICIONES, id, fields);
  return mapToEdicion(record);
}
