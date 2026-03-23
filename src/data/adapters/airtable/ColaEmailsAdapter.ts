/**
 * Adaptador Airtable para la tabla Cola de Emails.
 */

import { ColaEmail, EstadoEmail } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, updateRecord, createRecord, AirtableRecord } from './AirtableClient';

interface AirtableColaEmailFields {
  'Alumno'?: string[];
  'Nombre del Alumno'?: string[];
  'Tipo'?: string;
  'Asunto Generado'?: string;
  'Mensaje'?: string;
  'Estado'?: EstadoEmail;
  'Descripcion'?: string;
}

function mapToColaEmail(record: AirtableRecord<AirtableColaEmailFields>): ColaEmail {
  const f = record.fields;
  return {
    id: record.id,
    createdTime: record.createdTime,
    alumnoId: f['Alumno']?.[0] || '',
    alumnoNombre: f['Nombre del Alumno']?.[0],
    tipo: (f['Tipo'] as ColaEmail['tipo']) || 'informacion',
    asunto: f['Asunto Generado'],
    mensaje: f['Mensaje'] || '',
    estado: f['Estado'] || 'Pendiente',
    descripcion: f['Descripcion'],
  };
}

export async function fetchColaEmails(filters?: { estado?: EstadoEmail }): Promise<ColaEmail[]> {
  const formulas: string[] = [];
  if (filters?.estado) formulas.push(`{Estado} = '${filters.estado}'`);

  const records = await listRecords<AirtableColaEmailFields>(AIRTABLE_TABLES.COLA_EMAILS, {
    filterByFormula: formulas.length > 0 ? formulas[0] : undefined,
    sort: [{ field: 'Ultima Modificacion', direction: 'desc' }],
    maxRecords: 100,
  });

  return records.map(mapToColaEmail);
}

export async function aprobarEmail(id: string): Promise<ColaEmail> {
  const record = await updateRecord<AirtableColaEmailFields>(AIRTABLE_TABLES.COLA_EMAILS, id, {
    'Estado': 'Pendiente',
  });
  return mapToColaEmail(record);
}

export async function crearEmail(data: {
  alumnoId: string;
  tipo: string;
  mensaje: string;
}): Promise<ColaEmail> {
  const record = await createRecord<AirtableColaEmailFields>(AIRTABLE_TABLES.COLA_EMAILS, {
    'Alumno': [data.alumnoId],
    'Tipo': data.tipo,
    'Mensaje': data.mensaje,
    'Estado': 'Pendiente',
  });
  return mapToColaEmail(record);
}
