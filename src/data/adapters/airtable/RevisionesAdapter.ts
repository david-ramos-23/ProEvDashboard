/**
 * Adaptador Airtable para la tabla Revisiones de Video.
 */

import { RevisionVideo, EstadoRevision } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, getRecord, updateRecord, AirtableRecord } from './AirtableClient';
import { fetchAlumnoNombresByIds } from './AlumnosAdapter';

interface AirtableRevisionFields {
  'Alumno'?: string[];
  'Revisor Responsable'?: string;
  'Fecha de Revisión'?: string;
  'Video Enviado'?: string;
  'Redes Sociales'?: string;
  'Usuarios RRSS'?: string;
  'Estado de Revisión'?: EstadoRevision;
  'Puntuacion'?: number;
  'Feedback'?: string;
  'Notas Internas'?: string;
  'Última Actualización'?: string;
  'Días desde Envío de Video hasta Revisión'?: number;
  'Estado General del Alumno'?: string[];
  'Resumen Inteligente de Feedback'?: string | object;
  'Clasificación Automática de Video'?: string | object;
}

function mapToRevision(record: AirtableRecord<AirtableRevisionFields>): RevisionVideo {
  const f = record.fields;
  const resumen = f['Resumen Inteligente de Feedback'];
  const clasificacion = f['Clasificación Automática de Video'];
  return {
    id: record.id,
    createdTime: record.createdTime,
    alumnoId: f['Alumno']?.[0] || '',
    alumnoNombre: undefined,
    revisorResponsable: f['Revisor Responsable'],
    fechaRevision: f['Fecha de Revisión'],
    videoEnviado: f['Video Enviado'],
    redesSociales: f['Redes Sociales'],
    usuariosRRSS: f['Usuarios RRSS'],
    estadoRevision: f['Estado de Revisión'] || 'Pendiente',
    puntuacion: f['Puntuacion'],
    feedback: f['Feedback'],
    notasInternas: f['Notas Internas'],
    ultimaActualizacion: f['Última Actualización'],
    diasDesdeEnvio: f['Días desde Envío de Video hasta Revisión'],
    estadoGeneralAlumno: f['Estado General del Alumno']?.[0] as RevisionVideo['estadoGeneralAlumno'],
    resumenInteligente: typeof resumen === 'string' ? resumen : undefined,
    clasificacionAutomatica: typeof clasificacion === 'string' ? clasificacion : undefined,
  };
}

const TABLE = AIRTABLE_TABLES.REVISIONES_VIDEO;

/** Lista revisiones, opcionalmente filtradas por estado */
export async function fetchRevisiones(filters?: {
  estado?: EstadoRevision;
  alumnoId?: string;
}): Promise<RevisionVideo[]> {
  const formulas: string[] = [];
  if (filters?.estado) formulas.push(`{Estado de Revisión} = '${filters.estado}'`);
  if (filters?.alumnoId) formulas.push(`FIND('${filters.alumnoId}', ARRAYJOIN({Alumno}))`);

  const filterByFormula = formulas.length > 0
    ? (formulas.length === 1 ? formulas[0] : `AND(${formulas.join(', ')})`)
    : undefined;

  const records = await listRecords<AirtableRevisionFields>(TABLE, {
    filterByFormula,
    sort: [{ field: 'Fecha de Revisión', direction: 'asc' }],
  });

  const revisiones = records.map(mapToRevision);

  // Enrich alumno names from Alumnos table
  const alumnoIds = [...new Set(revisiones.map(r => r.alumnoId).filter((id): id is string => !!id))];
  if (alumnoIds.length > 0) {
    const nombreMap = await fetchAlumnoNombresByIds(alumnoIds);
    revisiones.forEach(r => { if (r.alumnoId) r.alumnoNombre = nombreMap.get(r.alumnoId); });
  }

  return revisiones;
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
  if (updates.estadoRevision) fields['Estado de Revisión'] = updates.estadoRevision;
  if (updates.puntuacion != null) fields['Puntuacion'] = updates.puntuacion;
  if (updates.feedback !== undefined) fields['Feedback'] = updates.feedback;
  if (updates.notasInternas !== undefined) fields['Notas Internas'] = updates.notasInternas;

  const record = await updateRecord<AirtableRevisionFields>(TABLE, id, fields);
  return mapToRevision(record);
}

/** Cuenta revisiones por estado — solo descarga los campos necesarios */
export async function fetchRevisionStats(): Promise<{
  pendientes: number;
  revisadasHoy: number;
  total: number;
}> {
  const records = await listRecords<{ 'Estado de Revisión'?: string; 'Fecha de Revisión'?: string }>(TABLE, {
    fields: ['Estado de Revisión', 'Fecha de Revisión'],
  });
  const today = new Date().toISOString().split('T')[0];

  let pendientes = 0;
  let revisadasHoy = 0;
  records.forEach(r => {
    if (r.fields['Estado de Revisión'] === 'Pendiente') pendientes++;
    if (r.fields['Fecha de Revisión']?.startsWith(today)) revisadasHoy++;
  });

  return { pendientes, revisadasHoy, total: records.length };
}
