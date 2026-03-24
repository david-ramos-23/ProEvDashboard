/**
 * Adaptador Airtable para la tabla Inbox.
 */

import { InboxEmail } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, updateRecord, AirtableRecord, sanitizeForFormula } from './AirtableClient';

interface AirtableInboxFields {
  'messageId'?: string;
  'threadId'?: string;
  'Direccion'?: string;
  'De'?: string;
  'Para'?: string;
  'Asunto'?: string;
  'Contenido'?: string;
  'Contenido HTML'?: string;
  'Fecha'?: string;
  'Estado'?: string;
  'Tipo Consulta'?: string;
  'Requiere Atencion'?: boolean;
  'Resumen AI'?: string;
  'Respuesta Sugerida'?: string;
  'Respuesta Final'?: string;
  'Respuesta Enviada'?: boolean;
  'Alumno'?: string[];
  'Ultima Modificacion'?: string;
}

function mapToInbox(record: AirtableRecord<AirtableInboxFields>): InboxEmail {
  const f = record.fields;
  return {
    id: record.id,
    createdTime: record.createdTime,
    de: f['De'] || '',
    para: f['Para'] || '',
    asunto: f['Asunto'] || '',
    contenido: f['Contenido'] || '',
    contenidoHtml: f['Contenido HTML'],
    direccion: (f['Direccion'] as InboxEmail['direccion']) || 'Recibido',
    estado: (f['Estado'] as InboxEmail['estado']) || 'Nuevo',
    fecha: f['Fecha'],
    alumnoId: f['Alumno']?.[0],
    messageId: f['messageId'],
    threadId: f['threadId'],
    resumenIA: f['Resumen AI'],
    tipoConsulta: f['Tipo Consulta'],
    requiereAtencion: f['Requiere Atencion'],
    respuestaSugerida: f['Respuesta Sugerida'],
    respuestaFinal: f['Respuesta Final'],
    respuestaEnviada: f['Respuesta Enviada'],
    ultimaModificacion: f['Ultima Modificacion'],
  };
}

export async function fetchInbox(filters?: {
  estado?: string;
  direccion?: string;
  requiereAtencion?: boolean;
  alumnoId?: string;
  maxRecords?: number;
}): Promise<InboxEmail[]> {
  const formulas: string[] = [];
  if (filters?.estado) formulas.push(`{Estado} = '${sanitizeForFormula(filters.estado)}'`);
  if (filters?.direccion) formulas.push(`{Direccion} = '${sanitizeForFormula(filters.direccion)}'`);
  if (filters?.requiereAtencion) formulas.push(`{Requiere Atencion} = TRUE()`);
  if (filters?.alumnoId) formulas.push(`FIND('${sanitizeForFormula(filters.alumnoId)}', ARRAYJOIN({Alumno}))`);

  const filterByFormula = formulas.length > 0
    ? (formulas.length === 1 ? formulas[0] : `AND(${formulas.join(', ')})`)
    : undefined;

  const records = await listRecords<AirtableInboxFields>(AIRTABLE_TABLES.INBOX, {
    filterByFormula,
    sort: [{ field: 'Fecha', direction: 'desc' }],
    maxRecords: filters?.maxRecords || 100,
  });
  return records.map(mapToInbox);
}

export async function updateInboxEmail(id: string, updates: {
  estado?: string;
  respuestaFinal?: string;
}): Promise<InboxEmail> {
  const fields: Partial<AirtableInboxFields> = {};
  if (updates.estado) fields['Estado'] = updates.estado;
  if (updates.respuestaFinal !== undefined) fields['Respuesta Final'] = updates.respuestaFinal;
  const record = await updateRecord<AirtableInboxFields>(AIRTABLE_TABLES.INBOX, id, fields);
  return mapToInbox(record);
}
