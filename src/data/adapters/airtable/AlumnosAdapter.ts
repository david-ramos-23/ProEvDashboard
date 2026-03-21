/**
 * Adaptador Airtable para la tabla Alumnos.
 * 
 * Implementa IAlumnoRepository traduciendo entre el schema de Airtable
 * (nombres de campos con espacios/acentos) y los tipos TypeScript.
 */

import { Alumno, EstadoGeneral, DashboardStats } from '@/types';
import { AIRTABLE_TABLES } from '@/utils/constants';
import { listRecords, getRecord, updateRecord, AirtableRecord } from './AirtableClient';

/** Campos de Airtable tal como vienen del API (con nombres originales) */
interface AirtableAlumnoFields {
  'Nombre'?: string;
  'Email'?: string;
  'Phone Number'?: string;
  'Estado General'?: EstadoGeneral;
  'Idioma'?: string;
  'Modulo Solicitado'?: string;
  'Modulos Completados'?: string;
  'Edicion'?: string[];
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
  'Resumen Feedback Video (AI)'?: string;
  'Siguiente Accion Recomendada (AI)'?: string;
  'Notas Internas'?: string;
  'Admin Responsable'?: string;
  'Ultima Modificacion'?: string;
}

/** Convierte un registro Airtable → tipo Alumno */
function mapToAlumno(record: AirtableRecord<AirtableAlumnoFields>): Alumno {
  const f = record.fields;
  return {
    id: record.id,
    createdTime: record.createdTime,
    nombre: f['Nombre'] || '',
    email: f['Email'] || '',
    telefono: f['Phone Number'],
    estadoGeneral: f['Estado General'] || 'Privado',
    idioma: (f['Idioma'] === 'Ingles' ? 'Ingles' : 'Espanol'),
    moduloSolicitado: f['Modulo Solicitado'],
    modulosCompletados: (() => {
      const mc = f['Modulos Completados'];
      if (!mc) return undefined;
      if (Array.isArray(mc)) return mc;
      if (typeof mc === 'string') return mc.split(',').map(s => s.trim());
      return undefined;
    })(),
    edicionId: f['Edicion']?.[0],
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
    resumenFeedbackIA: f['Resumen Feedback Video (AI)'],
    siguienteAccionIA: f['Siguiente Accion Recomendada (AI)'],
    notasInternas: f['Notas Internas'],
    adminResponsable: f['Admin Responsable'],
    ultimaModificacion: f['Ultima Modificacion'],
  };
}

const TABLE = AIRTABLE_TABLES.ALUMNOS;

// ============================================================
// API pública
// ============================================================

/** Lista todos los alumnos, con filtros opcionales */
export async function fetchAlumnos(filters?: {
  estado?: EstadoGeneral;
  edicionId?: string;
  modulo?: string;
  search?: string;
}): Promise<Alumno[]> {
  const formulas: string[] = [];

  if (filters?.estado) {
    formulas.push(`{Estado General} = '${filters.estado}'`);
  }
  if (filters?.edicionId) {
    formulas.push(`FIND('${filters.edicionId}', ARRAYJOIN({Edicion}))`);
  }
  if (filters?.modulo) {
    formulas.push(`{Modulo Solicitado} = '${filters.modulo}'`);
  }
  if (filters?.search) {
    const s = filters.search.replace(/'/g, "\\'");
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
  }>
): Promise<Alumno> {
  const fields: Partial<AirtableAlumnoFields> = {};
  if (updates.estadoGeneral) fields['Estado General'] = updates.estadoGeneral;
  if (updates.notasInternas !== undefined) fields['Notas Internas'] = updates.notasInternas;
  if (updates.fechaPlazo) fields['Fecha Plazo'] = updates.fechaPlazo;

  const record = await updateRecord<AirtableAlumnoFields>(TABLE, id, fields);
  return mapToAlumno(record);
}

/** Calcula estadísticas del dashboard */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const alumnos = await fetchAlumnos();

  const alumnosPorEstado = {} as Record<EstadoGeneral, number>;
  const estados: EstadoGeneral[] = [
    'Privado', 'Preinscrito', 'En revision de video', 'Aprobado', 'Rechazado',
    'Pendiente de pago', 'Reserva', 'Pagado', 'Finalizado', 'Plazo Vencido', 'Pago Fallido'
  ];
  estados.forEach(e => { alumnosPorEstado[e] = 0; });
  alumnos.forEach(a => { alumnosPorEstado[a.estadoGeneral]++; });

  const ingresosTotales = alumnos.reduce((sum, a) => sum + (a.importeTotalPagado || 0), 0);
  const scores = alumnos.filter(a => a.engagementScore != null).map(a => a.engagementScore!);
  const engagementPromedio = scores.length > 0
    ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
    : 0;

  return {
    totalAlumnos: alumnos.length,
    alumnosPorEstado,
    totalPagados: alumnosPorEstado['Pagado'] || 0,
    pendientesRevision: alumnosPorEstado['En revision de video'] || 0,
    ingresosTotales,
    engagementPromedio,
  };
}
