/**
 * Adaptador Airtable para la tabla Revisiones de Video.
 */

import { RevisionVideo, EstadoRevision } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, getRecord, updateRecord, AirtableRecord, sanitizeForFormula } from './AirtableClient';
import { fetchAlumnoMetaByIds, fetchAlumnoIdsByEdicion } from './AlumnosAdapter';

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

/** Lista revisiones, opcionalmente filtradas por estado y/o edición */
export async function fetchRevisiones(filters?: {
  estado?: EstadoRevision;
  alumnoId?: string;
  edicionNombre?: string;
}): Promise<RevisionVideo[]> {
  const formulas: string[] = [];
  if (filters?.estado) formulas.push(`{Estado de Revisión} = '${sanitizeForFormula(filters.estado)}'`);
  if (filters?.alumnoId) formulas.push(`FIND('${sanitizeForFormula(filters.alumnoId)}', ARRAYJOIN({Alumno}))`);

  const filterByFormula = formulas.length > 0
    ? (formulas.length === 1 ? formulas[0] : `AND(${formulas.join(', ')})`)
    : undefined;

  const records = await listRecords<AirtableRevisionFields>(TABLE, {
    filterByFormula,
    sort: [{ field: 'Fecha de Revisión', direction: 'asc' }],
  });

  const revisiones = records.map(mapToRevision);

  // Enrich with alumno metadata from Alumnos table
  const alumnoIds = [...new Set(revisiones.map(r => r.alumnoId).filter((id): id is string => !!id))];
  if (alumnoIds.length > 0) {
    const metaMap = await fetchAlumnoMetaByIds(alumnoIds);
    revisiones.forEach(r => {
      if (r.alumnoId) {
        const meta = metaMap.get(r.alumnoId);
        if (meta) {
          r.alumnoNombre = meta.nombre;
          r.tipoAlumno = meta.tipoAlumno;
          r.moduloSolicitado = meta.moduloSolicitado;
          r.parejaAsignada = meta.parejaAsignada;
        }
      }
    });
  }

  if (filters?.edicionNombre) {
    const idSet = await fetchAlumnoIdsByEdicion(filters.edicionNombre);
    return revisiones.filter(r => !r.alumnoId || idSet.has(r.alumnoId));
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
  if (updates.estadoRevision) {
    fields['Estado de Revisión'] = updates.estadoRevision;
    if (updates.estadoRevision !== 'Pendiente') {
      fields['Fecha de Revisión'] = new Date().toISOString().split('T')[0];
    }
  }
  if (updates.puntuacion != null) fields['Puntuacion'] = updates.puntuacion;
  if (updates.feedback !== undefined) fields['Feedback'] = updates.feedback;
  if (updates.notasInternas !== undefined) fields['Notas Internas'] = updates.notasInternas;

  const record = await updateRecord<AirtableRevisionFields>(TABLE, id, fields);
  return mapToRevision(record);
}

/** Cuenta revisiones por estado — solo descarga los campos necesarios */
export async function fetchRevisionStats(edicionNombre?: string): Promise<{
  pendientes: number;
  revisadasHoy: number;
  total: number;
}> {
  const records = await listRecords<{ 'Estado de Revisión'?: string; 'Fecha de Revisión'?: string; 'Alumno'?: string[] }>(TABLE, {
    fields: ['Estado de Revisión', 'Fecha de Revisión', 'Alumno'],
  });

  let workingRecords = records;
  if (edicionNombre) {
    const idSet = await fetchAlumnoIdsByEdicion(edicionNombre);
    workingRecords = records.filter(r => {
      const alumnoId = r.fields['Alumno']?.[0];
      return !alumnoId || idSet.has(alumnoId);
    });
  }

  const today = new Date().toISOString().split('T')[0];
  let pendientes = 0;
  let revisadasHoy = 0;
  workingRecords.forEach(r => {
    if (r.fields['Estado de Revisión'] === 'Pendiente') pendientes++;
    if (r.fields['Fecha de Revisión']?.startsWith(today)) revisadasHoy++;
  });

  return { pendientes, revisadasHoy, total: workingRecords.length };
}
