/**
 * Adaptador Airtable para la tabla Alumnos.
 * 
 * Implementa IAlumnoRepository traduciendo entre el schema de Airtable
 * (nombres de campos con espacios/acentos) y los tipos TypeScript.
 */

import { Alumno, EstadoGeneral, DashboardStats } from '@/types';
import { AIRTABLE_TABLES, ESTADO, FIELD } from '@/utils/constants';
import { listRecords, getRecord, updateRecord, AirtableRecord, sanitizeForFormula } from './AirtableClient';

/** Campos de Airtable tal como vienen del API (con nombres originales) */
interface AirtableAlumnoFields {
  'Nombre'?: string;
  'Email'?: string;
  'Phone Number'?: string;
  'Estado General'?: EstadoGeneral;
  'Idioma'?: string;
  'Modulo Solicitado'?: string;
  'Modules'?: string[];
  'Edicion'?: string[];
  'Nombre Edicion'?: string[];
  'Foto de Perfil'?: Array<{ url: string }>;
  'Plazo Revision'?: string;
  'Fecha Plazo'?: string;
  'Fecha Preinscripcion'?: string;
  'Modulo Reserva'?: string;
  'Fecha Entrada Reserva'?: string;
  'Total Revisiones de Video'?: number;
  'Ultima Fecha de Revision de Video'?: string;
  'Estado de Revision Mas Reciente'?: string;
  'Total Pagos Realizados'?: number;
  'Importe Total Pagado'?: number;
  'Fecha Ultimo Pago'?: string;
  'Puntuacion Video'?: number;
  'Engagement Score'?: number;
  'Resumen Feedback Video (AI)'?: any;
  'Siguiente Accion Recomendada (AI)'?: any;
  'Notas Internas'?: string;
  'Admin Responsable'?: string;
  'Ultima Modificacion'?: string;
  'Total Pagos Fallidos'?: number;
  'Dias en Estado Actual'?: number;
  'Dias desde Ultimo Evento'?: number;
  'Rol'?: string[];
  'Pareja Email'?: string;
  'Pareja (Link)'?: string[];
}

/** Convierte un registro Airtable → tipo Alumno */
function mapToAlumno(record: AirtableRecord<AirtableAlumnoFields>): Alumno {
  const f = record.fields;
  return {
    id: record.id,
    createdTime: record.createdTime,
    nombre: Array.isArray(f['Nombre']) ? (f['Nombre'][0] || '') : (f['Nombre'] || ''),
    email: Array.isArray(f['Email']) ? (f['Email'][0] || '') : (f['Email'] || ''),
    telefono: f['Phone Number'],
    estadoGeneral: f['Estado General'] || ESTADO.PRIVADO,
    idioma: (f['Idioma'] === 'Ingles' ? 'Ingles' : 'Espanol'),
    moduloSolicitado: f['Modulo Solicitado'],
    modulosCompletados: f['Modules'],
    edicionId: f['Edicion']?.[0],
    edicion: f['Nombre Edicion']?.[0],
    fotoPerfil: f['Foto de Perfil']?.[0]?.url,
    plazoRevision: f['Plazo Revision'],
    fechaPlazo: f['Fecha Plazo'],
    fechaPreinscripcion: f['Fecha Preinscripcion'],
    moduloReserva: f['Modulo Reserva'],
    fechaEntradaReserva: f['Fecha Entrada Reserva'],
    totalRevisiones: f['Total Revisiones de Video'],
    ultimaFechaRevision: f['Ultima Fecha de Revision de Video'],
    estadoRevisionReciente: f['Estado de Revision Mas Reciente'] as Alumno['estadoRevisionReciente'],
    totalPagos: f['Total Pagos Realizados'],
    importeTotalPagado: f['Importe Total Pagado'],
    fechaUltimoPago: f['Fecha Ultimo Pago'],
    puntuacionVideo: f['Puntuacion Video'],
    engagementScore: f['Engagement Score'],
    resumenFeedbackIA: typeof f['Resumen Feedback Video (AI)'] === 'string' ? f['Resumen Feedback Video (AI)'] : undefined,
    siguienteAccionIA: typeof f['Siguiente Accion Recomendada (AI)'] === 'string' ? f['Siguiente Accion Recomendada (AI)'] : undefined,
    notasInternas: f['Notas Internas'],
    adminResponsable: f['Admin Responsable'],
    ultimaModificacion: f['Ultima Modificacion'],
    parejaAsignada: f['Pareja Email'] ?? undefined,
    parejaRecordId: Array.isArray(f['Pareja (Link)']) ? f['Pareja (Link)'][0] : undefined,
    tipoAlumno: Array.isArray(f['Rol']) ? f['Rol']?.[0] : undefined,
  };
}

const TABLE = AIRTABLE_TABLES.ALUMNOS;

// ============================================================
// API pública
// ============================================================

/** Lista todos los alumnos, con filtros opcionales */
export async function fetchAlumnos(filters?: {
  estado?: EstadoGeneral;
  edicionNombre?: string;
  modulo?: string;
  search?: string;
}): Promise<Alumno[]> {
  const formulas: string[] = [];

  if (filters?.estado) {
    formulas.push(`{Estado General} = '${sanitizeForFormula(filters.estado)}'`);
  }
  if (filters?.edicionNombre) {
    formulas.push(`FIND('${sanitizeForFormula(filters.edicionNombre)}', ARRAYJOIN({Edicion}))`);
  }
  if (filters?.modulo) {
    formulas.push(`{Modulo Solicitado} = '${sanitizeForFormula(filters.modulo)}'`);
  }
  if (filters?.search) {
    const s = sanitizeForFormula(filters.search);
    formulas.push(
      `OR(FIND(LOWER('${s}'), LOWER({Nombre})), FIND(LOWER('${s}'), LOWER({Email})))`
    );
  }

  const filterByFormula = formulas.length > 0
    ? (formulas.length === 1 ? formulas[0] : `AND(${formulas.join(', ')})`)
    : undefined;

  const records = await listRecords<AirtableAlumnoFields>(TABLE, {
    filterByFormula,
    sort: [{ field: 'Ultima Modificacion', direction: 'desc' }],
  });

  return records.map(mapToAlumno);
}

/** Obtiene un alumno por su ID */
export async function fetchAlumnoById(id: string): Promise<Alumno> {
  const record = await getRecord<AirtableAlumnoFields>(TABLE, id);
  return mapToAlumno(record);
}

/** Actualiza campos de un alumno */
export async function updateAlumno(
  id: string,
  updates: Partial<{
    estadoGeneral: EstadoGeneral;
    notasInternas: string;
    fechaPlazo: string;
    parejaAsignada: string;
    parejaRecordId?: string;
  }>
): Promise<Alumno> {
  const fields: Partial<AirtableAlumnoFields> = {};
  if (updates.estadoGeneral) fields['Estado General'] = updates.estadoGeneral;
  if (updates.notasInternas !== undefined) fields['Notas Internas'] = updates.notasInternas;
  if (updates.fechaPlazo) fields['Fecha Plazo'] = updates.fechaPlazo;
  if (updates.parejaAsignada !== undefined) fields['Pareja Email'] = updates.parejaAsignada;
  if (updates.parejaRecordId !== undefined) fields['Pareja (Link)'] = updates.parejaRecordId ? [updates.parejaRecordId] : [];

  const record = await updateRecord<AirtableAlumnoFields>(TABLE, id, fields);
  return mapToAlumno(record);
}

/** Strips accents and lowercases — used for fuzzy module name matching */
function normalizeStr(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/**
 * Returns a count of alumnos per normalized module name (Modulo Solicitado).
 * Used by ModulosAdapter to compute inscritos counts since the Modulos table
 * has no Inscritos field.
 */
export async function fetchAlumnoCountByModulo(): Promise<Map<string, number>> {
  const records = await listRecords<{ 'Modulo Solicitado'?: string }>(TABLE, {
    filterByFormula: "{Modulo Solicitado} != ''",
    fields: ['Modulo Solicitado'],
  });
  const counts = new Map<string, number>();
  records.forEach(r => {
    const raw = r.fields['Modulo Solicitado'];
    if (!raw) return;
    const key = normalizeStr(raw);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

/**
 * Fetches only the Nombre field for a set of alumno record IDs.
 * Used by other adapters to enrich their records with alumno names.
 */
export async function fetchAlumnoNombresByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const formula = ids.length === 1
    ? `RECORD_ID() = '${ids[0]}'`
    : `OR(${ids.map(id => `RECORD_ID() = '${id}'`).join(', ')})`;
  const records = await listRecords<{ 'Nombre'?: string }>(TABLE, {
    filterByFormula: formula,
    fields: ['Nombre'],
    maxRecords: ids.length,
  });
  return new Map(records.map(r => [r.id, r.fields['Nombre'] || '']));
}

/**
 * Returns the set of alumno record IDs that belong to a given edition.
 * Used by other adapters to filter their records by edition client-side.
 */
export async function fetchAlumnoIdsByEdicion(edicionNombre: string): Promise<Set<string>> {
  const records = await listRecords<{ 'Edicion'?: string[] }>(TABLE, {
    filterByFormula: `FIND('${sanitizeForFormula(edicionNombre)}', ARRAYJOIN({Edicion}))`,
  });
  return new Set(records.map(r => r.id));
}

interface AlumnoMeta {
  nombre: string;
  tipoAlumno?: string;
  moduloSolicitado?: string;
  parejaAsignada?: string;
}

/**
 * Fetches nombre + metadata fields for a set of alumno record IDs.
 * Processes in chunks of 100 to stay within Airtable formula limits.
 */
export async function fetchAlumnoMetaByIds(ids: string[]): Promise<Map<string, AlumnoMeta>> {
  if (ids.length === 0) return new Map();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));

  const map = new Map<string, AlumnoMeta>();
  for (const chunk of chunks) {
    const formula = chunk.length === 1
      ? `RECORD_ID() = '${chunk[0]}'`
      : `OR(${chunk.map(id => `RECORD_ID() = '${id}'`).join(', ')})`;
    const records = await listRecords<AirtableAlumnoFields>(TABLE, { filterByFormula: formula });
    records.forEach(r => {
      const f = r.fields;
      map.set(r.id, {
        nombre: (Array.isArray(f['Nombre']) ? f['Nombre'][0] : f['Nombre']) as string || '',
        tipoAlumno: Array.isArray(f['Rol']) ? f['Rol']?.[0] : undefined,
        moduloSolicitado: f['Modulo Solicitado'] ?? undefined,
        parejaAsignada: f['Pareja Email'] ?? undefined,
      });
    });
  }
  return map;
}

/** Calcula estadísticas del dashboard — solo descarga los campos necesarios */
export async function fetchDashboardStats(options?: { edicionNombre?: string }): Promise<DashboardStats> {
  const filterByFormula = options?.edicionNombre
    ? `FIND('${sanitizeForFormula(options.edicionNombre)}', ARRAYJOIN({Edicion}))`
    : undefined;
  const records = await listRecords<Pick<AirtableAlumnoFields, 'Estado General' | 'Importe Total Pagado' | 'Engagement Score'>>(TABLE, {
    fields: [FIELD.ESTADO_GENERAL, FIELD.IMPORTE_TOTAL_PAGADO, FIELD.ENGAGEMENT_SCORE],
    filterByFormula,
  });
  const alumnos = records.map(r => r.fields);

  const alumnosPorEstado = {} as Record<EstadoGeneral, number>;
  const allEstados = Object.values(ESTADO);
  allEstados.forEach(e => { alumnosPorEstado[e] = 0; });

  let ingresosTotales = 0;
  let engagementSum = 0;
  let engagementCount = 0;

  alumnos.forEach(f => {
    const estado = (f[FIELD.ESTADO_GENERAL] || ESTADO.PRIVADO) as EstadoGeneral;
    alumnosPorEstado[estado] = (alumnosPorEstado[estado] || 0) + 1;
    ingresosTotales += f[FIELD.IMPORTE_TOTAL_PAGADO] || 0;
    if (f[FIELD.ENGAGEMENT_SCORE] != null) {
      engagementSum += f[FIELD.ENGAGEMENT_SCORE]!;
      engagementCount++;
    }
  });

  const engagementPromedio = engagementCount > 0 ? Math.round(engagementSum / engagementCount) : 0;

  return {
    totalAlumnos: alumnos.length,
    alumnosPorEstado,
    totalPagados: alumnosPorEstado[ESTADO.PAGADO] || 0,
    pendientesRevision: alumnosPorEstado[ESTADO.EN_REVISION] || 0,
    ingresosTotales,
    engagementPromedio,
  };
}
