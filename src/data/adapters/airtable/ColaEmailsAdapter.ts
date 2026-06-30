/**
 * Adaptador Airtable para la tabla Cola de Emails.
 */

import { ColaEmail, EstadoEmail } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, updateRecord, createRecord, deleteRecord, AirtableRecord, sanitizeForFormula } from './AirtableClient';
import { fetchAlumnoNombresByIds } from './AlumnosAdapter';

interface AirtableColaEmailFields {
  'Alumno'?: string[];
  'Nombre del Alumno'?: string[];
  'Tipo'?: string;
  'Asunto Generado'?: string;
  'Mensaje'?: string;
  'Estado'?: EstadoEmail;
  'Descripcion'?: string;
}

/**
 * Safely coerces an Airtable field value to string, handling cases where a
 * lookup/rollup field unexpectedly returns an array instead of a scalar.
 */
function coerceToString(val: unknown): string | undefined {
  if (val == null) return undefined;
  if (Array.isArray(val)) return val[0] != null ? String(val[0]) : undefined;
  return String(val);
}

function mapToColaEmail(record: AirtableRecord<AirtableColaEmailFields>): ColaEmail {
  const f = record.fields;
  const rawTipo = coerceToString(f['Tipo'] as unknown);
  return {
    id: record.id,
    createdTime: record.createdTime,
    alumnoId: f['Alumno']?.[0] || '',
    alumnoNombre: f['Nombre del Alumno']?.[0],
    tipo: ((rawTipo || 'informacion') as ColaEmail['tipo']),
    asunto: coerceToString(f['Asunto Generado'] as unknown),
    mensaje: coerceToString(f['Mensaje'] as unknown) || '',
    estado: f['Estado'] || 'Pendiente',
    descripcion: coerceToString(f['Descripcion'] as unknown),
  };
}

export async function fetchColaEmails(filters?: { estado?: EstadoEmail; estados?: EstadoEmail[]; tipo?: string }): Promise<ColaEmail[]> {
  const formulas: string[] = [];
  if (filters?.estados?.length) {
    const parts = filters.estados.map(e => `{Estado} = '${sanitizeForFormula(e)}'`);
    formulas.push(parts.length > 1 ? `OR(${parts.join(', ')})` : parts[0]);
  } else if (filters?.estado) {
    formulas.push(`{Estado} = '${sanitizeForFormula(filters.estado)}'`);
  }
  if (filters?.tipo) formulas.push(`LOWER({Tipo}) = '${sanitizeForFormula(filters.tipo.toLowerCase())}'`);
  // Always exclude soft-deleted emails
  formulas.push(`{Estado} != 'Eliminado'`);

  const filterByFormula = formulas.length > 1
    ? `AND(${formulas.join(', ')})`
    : formulas[0];

  const records = await listRecords<AirtableColaEmailFields>(AIRTABLE_TABLES.COLA_EMAILS, {
    filterByFormula,
    sort: [{ field: 'Ultima Modificacion', direction: 'desc' }],
  });

  const emails = records.map(mapToColaEmail);

  // Enrich alumno names as fallback if lookup field is empty
  const needsEnrichment = emails.filter(e => !e.alumnoNombre && e.alumnoId);
  if (needsEnrichment.length > 0) {
    const ids = [...new Set(needsEnrichment.map(e => e.alumnoId).filter((id): id is string => !!id))];
    const nombreMap = await fetchAlumnoNombresByIds(ids);
    emails.forEach(e => {
      if (!e.alumnoNombre && e.alumnoId) e.alumnoNombre = nombreMap.get(e.alumnoId);
    });
  }

  return emails;
}

export async function aprobarEmail(id: string): Promise<ColaEmail> {
  const record = await updateRecord<AirtableColaEmailFields>(AIRTABLE_TABLES.COLA_EMAILS, id, {
    'Estado': 'Pendiente',
  });
  return mapToColaEmail(record);
}

/** Elimina un email de la Cola (hard delete en Airtable). */
export async function eliminarEmail(id: string): Promise<void> {
  await deleteRecord(AIRTABLE_TABLES.COLA_EMAILS, id);
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
