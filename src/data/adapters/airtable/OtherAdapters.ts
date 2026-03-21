/**
 * Adaptador Airtable para Historial, Ediciones, Módulos, Cola de Emails e Inbox.
 */

import { Historial, Edicion, Modulo, ColaEmail, InboxEmail, EstadoEmail } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, getRecord, updateRecord, createRecord, AirtableRecord } from './AirtableClient';

// ============================================================
// HISTORIAL
// ============================================================

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

// ============================================================
// EDICIONES
// ============================================================

interface AirtableEdicionFields {
  'Nombre'?: string;
  'Estado'?: string;
  'Es Edicion Activa'?: boolean;
  'Fecha Inicio Inscripcion'?: string;
  'Fecha Fin Inscripcion'?: string;
  'Fecha Inicio Curso'?: string;
  'Fecha Fin Curso'?: string;
  'Modulos Disponibles'?: string[];
  'Notas'?: string;
  'Es Prelanzamiento'?: boolean;
  'Fecha Apertura Publica'?: string;
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
    notas: f['Notas'],
    esPrelanzamiento: f['Es Prelanzamiento'],
    fechaAperturaPublica: f['Fecha Apertura Publica'],
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
  updates: Partial<{ esEdicionActiva: boolean; estado: string; notas: string }>
): Promise<Edicion> {
  const fields: Partial<AirtableEdicionFields> = {};
  if (updates.esEdicionActiva !== undefined) fields['Es Edicion Activa'] = updates.esEdicionActiva;
  if (updates.estado) fields['Estado'] = updates.estado;
  if (updates.notas !== undefined) fields['Notas'] = updates.notas;

  const record = await updateRecord<AirtableEdicionFields>(AIRTABLE_TABLES.EDICIONES, id, fields);
  return mapToEdicion(record);
}

// ============================================================
// MÓDULOS
// ============================================================

interface AirtableModuloFields {
  'ID'?: string;
  'Nombre'?: string;
  'Capacidad'?: number;
  'Precio Online'?: number;
  'Activo'?: boolean;
  'Reserva Prelanzamiento'?: number;
}

function mapToModulo(record: AirtableRecord<AirtableModuloFields>): Modulo {
  const f = record.fields;
  return {
    id: record.id,
    createdTime: record.createdTime,
    moduloId: f['ID'] || '',
    nombre: f['Nombre'] || '',
    capacidad: f['Capacidad'] || 20,
    precioOnline: f['Precio Online'],
    activo: f['Activo'] || false,
    reservaPrelanzamiento: f['Reserva Prelanzamiento'],
  };
}

export async function fetchModulos(): Promise<Modulo[]> {
  const records = await listRecords<AirtableModuloFields>(AIRTABLE_TABLES.MODULOS, {
    filterByFormula: '{Activo} = TRUE()',
  });
  return records.map(mapToModulo);
}

// ============================================================
// COLA DE EMAILS
// ============================================================

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

/** Aprueba un email cambiando su estado de "Pendiente Aprobacion" a "Pendiente" */
export async function aprobarEmail(id: string): Promise<ColaEmail> {
  const record = await updateRecord<AirtableColaEmailFields>(AIRTABLE_TABLES.COLA_EMAILS, id, {
    'Estado': 'Pendiente',
  });
  return mapToColaEmail(record);
}

/** Crea un email en la cola */
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

// ============================================================
// INBOX
// ============================================================

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
