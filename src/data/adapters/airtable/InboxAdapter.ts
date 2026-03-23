/**
 * Adaptador Airtable para la tabla Inbox.
 */

import { InboxEmail } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, AirtableRecord } from './AirtableClient';

interface AirtableInboxFields {
  'De'?: string;
  'Para'?: string;
  'Asunto'?: string;
  'Contenido'?: string;
  'Direccion'?: string;
  'Estado'?: string;
  'Alumno'?: string[];
  'Nombre del Alumno'?: string[];
  'Message ID'?: string;
  'Thread ID'?: string;
  'Resumen AI'?: string;
  'Tipo Consulta'?: string;
  'Requiere Atencion'?: boolean;
  'Respuesta Sugerida'?: string;
  'Respuesta Final'?: string;
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
    direccion: (f['Direccion'] as InboxEmail['direccion']) || 'Recibido',
    estado: (f['Estado'] as InboxEmail['estado']) || 'Nuevo',
    alumnoId: f['Alumno']?.[0],
    alumnoNombre: f['Nombre del Alumno']?.[0],
    messageId: f['Message ID'],
    threadId: f['Thread ID'],
    resumenIA: f['Resumen AI'],
    tipoConsulta: f['Tipo Consulta'],
    requiereAtencion: f['Requiere Atencion'],
    respuestaSugerida: f['Respuesta Sugerida'],
    respuestaFinal: f['Respuesta Final'],
  };
}

export async function fetchInbox(options?: { maxRecords?: number }): Promise<InboxEmail[]> {
  const records = await listRecords<AirtableInboxFields>(AIRTABLE_TABLES.INBOX, {
    sort: [{ field: 'Timestamp', direction: 'desc' }],
    maxRecords: options?.maxRecords || 50,
  });
  return records.map(mapToInbox);
}
