/**
 * Adaptador Airtable para la tabla Envios de Emails (campañas de envío masivo).
 *
 * `crearEnvio` es el único punto de escritura para nuevas campañas y SIEMPRE escribe
 * Estado: 'Borrador' — el campo no es parametrizable desde el llamador. La transición a
 * 'Pendiente' (el único estado que el fan-out de n8n recoge) vive en `enviarEnvio`, el
 * único símbolo del repo capaz de escribir ese valor.
 */

import { EnvioEmail, EstadoEnvio, TipoEmail } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, getRecord, updateRecord, createRecord, deleteRecord, AirtableRecord, sanitizeForFormula } from './AirtableClient';

interface AirtableEnvioEmailFields {
  'Nombre'?: string;
  'Alumnos'?: string[];
  'Tipo'?: string;
  'Mensaje'?: string;
  'Estado'?: EstadoEnvio;
  'Descripcion'?: string;
  'Total Emails'?: number;
  'Emails Creados'?: number;
  'Fecha Completado'?: string;
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

function mapToEnvioEmail(record: AirtableRecord<AirtableEnvioEmailFields>): EnvioEmail {
  const f = record.fields;
  return {
    id: record.id,
    createdTime: record.createdTime,
    nombre: coerceToString(f['Nombre'] as unknown) || '',
    alumnosIds: f['Alumnos'] || [],
    tipo: ((coerceToString(f['Tipo'] as unknown) || 'informacion') as TipoEmail),
    mensaje: coerceToString(f['Mensaje'] as unknown) || '',
    descripcion: coerceToString(f['Descripcion'] as unknown),
    estado: f['Estado'] || 'Borrador',
    totalEmails: f['Total Emails'],
    emailsCreados: f['Emails Creados'],
    fechaCompletado: coerceToString(f['Fecha Completado'] as unknown),
  };
}

export async function fetchEnviosEmails(filters?: { estados?: EstadoEnvio[] }): Promise<EnvioEmail[]> {
  let filterByFormula: string | undefined;
  if (filters?.estados?.length) {
    const parts = filters.estados.map(e => `{Estado} = '${sanitizeForFormula(e)}'`);
    filterByFormula = parts.length > 1 ? `OR(${parts.join(', ')})` : parts[0];
  }

  const records = await listRecords<AirtableEnvioEmailFields>(AIRTABLE_TABLES.ENVIOS_EMAILS, {
    filterByFormula,
    sort: [{ field: 'Ultima Modificacion', direction: 'desc' }],
  });

  return records.map(mapToEnvioEmail);
}

/**
 * Creates a new campaign. ALWAYS writes Estado: 'Borrador' — this is the only
 * property that keeps this slice non-sending by construction, not a policy choice
 * left up to the caller.
 */
export async function crearEnvio(data: {
  nombre: string;
  alumnosIds: string[];
  tipo: string;
  mensaje: string;
  descripcion?: string;
}): Promise<EnvioEmail> {
  const record = await createRecord<AirtableEnvioEmailFields>(AIRTABLE_TABLES.ENVIOS_EMAILS, {
    'Nombre': data.nombre,
    'Alumnos': data.alumnosIds,
    'Tipo': data.tipo,
    'Mensaje': data.mensaje,
    ...(data.descripcion ? { 'Descripcion': data.descripcion } : {}),
    'Estado': 'Borrador',
    'Total Emails': data.alumnosIds.length,
  });
  return mapToEnvioEmail(record);
}

/**
 * Updates campaign composition fields. `Estado` is deliberately absent from this
 * input type — no edit can promote a draft to a sendable state through this function.
 */
export async function actualizarEnvio(id: string, updates: {
  nombre?: string;
  alumnosIds?: string[];
  tipo?: string;
  mensaje?: string;
  descripcion?: string;
}): Promise<EnvioEmail> {
  const record = await updateRecord<AirtableEnvioEmailFields>(AIRTABLE_TABLES.ENVIOS_EMAILS, id, {
    ...(updates.nombre !== undefined ? { 'Nombre': updates.nombre } : {}),
    ...(updates.alumnosIds !== undefined ? { 'Alumnos': updates.alumnosIds } : {}),
    ...(updates.tipo !== undefined ? { 'Tipo': updates.tipo } : {}),
    ...(updates.mensaje !== undefined ? { 'Mensaje': updates.mensaje } : {}),
    ...(updates.descripcion !== undefined ? { 'Descripcion': updates.descripcion } : {}),
    ...(updates.alumnosIds !== undefined ? { 'Total Emails': updates.alumnosIds.length } : {}),
  });
  return mapToEnvioEmail(record);
}

/**
 * Transitions a campaign from Borrador to Pendiente — the only symbol in the repo
 * capable of writing 'Pendiente', which makes the campaign eligible for the n8n
 * fan-out at its next poll. Reads the record first and rejects if it is not
 * currently Borrador — an idempotency guard against two users sending the same
 * shared draft, not a lock.
 */
export async function enviarEnvio(id: string): Promise<EnvioEmail> {
  const current = await getRecord<AirtableEnvioEmailFields>(AIRTABLE_TABLES.ENVIOS_EMAILS, id);
  if (current.fields['Estado'] !== 'Borrador') {
    throw new Error(
      `enviarEnvio: campaign ${id} is '${current.fields['Estado']}', expected 'Borrador'`
    );
  }
  const record = await updateRecord<AirtableEnvioEmailFields>(AIRTABLE_TABLES.ENVIOS_EMAILS, id, {
    'Estado': 'Pendiente',
  });
  return mapToEnvioEmail(record);
}

/** Deletes a draft campaign (hard delete en Airtable). */
export async function eliminarEnvio(id: string): Promise<void> {
  await deleteRecord(AIRTABLE_TABLES.ENVIOS_EMAILS, id);
}
