/**
 * Adaptador Airtable para la tabla Revisiones de Video.
 */

import { RevisionVideo, EstadoRevision } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, getRecord, updateRecord, AirtableRecord } from './AirtableClient';

interface AirtableRevisionFields {
  'Alumno'?: string[];
  'Nombre del Alumno'?: string[];
  'Revisor Responsable'?: string;
  'Fecha de Revision'?: string;
  'Video Enviado'?: string;
  'Redes Sociales'?: string;
  'Usuarios RRSS'?: string;
  'Estado de Revision'?: EstadoRevision;
  'Puntuacion'?: number;
  'Feedback'?: string;
  'Notas Internas'?: string;
  'Ultima Actualizacion'?: string;
  'Dias desde Envio hasta Revision'?: number;
  'Estado General del Alumno'?: string[];
  'Resumen Inteligente de Feedback'?: string;
  'Clasificacion Automatica de Video'?: string;
}

function mapToRevision(record: AirtableRecord<AirtableRevisionFields>): RevisionVideo {
  const f = record.fields;
  return {
    id: record.id,
    createdTime: record.createdTime,
    alumnoId: f['Alumno']?.[0] || '',
    alumnoNombre: f['Nombre del Alumno']?.[0],
    revisorResponsable: f['Revisor Responsable'],
    fechaRevision: f['Fecha de Revision'],
    videoEnviado: f['Video Enviado'],
    redesSociales: f['Redes Sociales'],
    usuariosRRSS: f['Usuarios RRSS'],
    estadoRevision: f['Estado de Revision'] || 'Pendiente',
    puntuacion: f['Puntuacion'],
    feedback: f['Feedback'],
    notasInternas: f['Notas Internas'],
    ultimaActualizacion: f['Ultima Actualizacion'],
    diasDesdeEnvio: f['Dias desde Envio hasta Revision'],
    estadoGeneralAlumno: f['Estado General del Alumno']?.[0] as RevisionVideo['estadoGeneralAlumno'],
    resumenInteligente: f['Resumen Inteligente de Feedback'],
    clasificacionAutomatica: f['Clasificacion Automatica de Video'],
  };
}

const TABLE = AIRTABLE_TABLES.REVISIONES_VIDEO;

/** Lista revisiones, opcionalmente filtradas por estado */
export async function fetchRevisiones(filters?: {
  estado?: EstadoRevision;
  alumnoId?: string;
}): Promise<RevisionVideo[]> {
  const formulas: string[] = [];
  if (filters?.estado) formulas.push(`{Estado de Revision} = '${filters.estado}'`);
  if (filters?.alumnoId) formulas.push(`FIND('${filters.alumnoId}', ARRAYJOIN({Alumno}))`);

  const filterByFormula = formulas.length > 0
    ? (formulas.length === 1 ? formulas[0] : `AND(${formulas.join(', ')})`)
    : undefined;

  const records = await listRecords<AirtableRevisionFields>(TABLE, {
    filterByFormula,
    sort: [{ field: 'Fecha de Revision', direction: 'asc' }],
  });

  return records.map(mapToRevision);
}

/** Obtiene una revisión por ID */
export async function fetchRevisionById(id: string): Promise<RevisionVideo> {
  const record = await getRecord<AirtableRevisionFields>(TABLE, id);
  return mapToRevision(record);
}

/** Actualiza una revisión (estado, puntuación, feedback, notas) */
export async function updateRevision(
  id: string,
  updates: Partial<{
    estadoRevision: EstadoRevision;
    puntuacion: number;
    feedback: string;
    notasInternas: string;
  }>
): Promise<RevisionVideo> {
  const fields: Partial<AirtableRevisionFields> = {};
  if (updates.estadoRevision) fields['Estado de Revision'] = updates.estadoRevision;
  if (updates.puntuacion != null) fields['Puntuacion'] = updates.puntuacion;
  if (updates.feedback !== undefined) fields['Feedback'] = updates.feedback;
  if (updates.notasInternas !== undefined) fields['Notas Internas'] = updates.notasInternas;

  const record = await updateRecord<AirtableRevisionFields>(TABLE, id, fields);
  return mapToRevision(record);
}

/** Cuenta revisiones por estado */
export async function fetchRevisionStats(): Promise<{
  pendientes: number;
  revisadasHoy: number;
  total: number;
}> {
  const allRevisiones = await fetchRevisiones();
  const today = new Date().toISOString().split('T')[0];

  return {
    pendientes: allRevisiones.filter(r => r.estadoRevision === 'Pendiente').length,
    revisadasHoy: allRevisiones.filter(r => r.fechaRevision?.startsWith(today)).length,
    total: allRevisiones.length,
  };
}
