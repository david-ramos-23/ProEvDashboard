/**
 * Re-exports all Supabase adapters.
 */

export { fetchAlumnos, fetchAlumnoById, updateAlumno, fetchAlumnoCountByModulo, fetchAlumnoNombresByIds, fetchDashboardStats } from './AlumnosAdapter';
export { fetchRevisiones, fetchRevisionById, updateRevision, fetchRevisionStats } from './RevisionesAdapter';
export { fetchPagos, fetchPagoStats, fetchPagosPorMes } from './PagosAdapter';
export { fetchHistorial } from './HistorialAdapter';
export { fetchEdiciones, updateEdicion } from './EdicionesAdapter';
export { fetchModulos } from './ModulosAdapter';
export { fetchColaEmails, aprobarEmail, crearEmail } from './ColaEmailsAdapter';
export { fetchInbox, updateInboxEmail } from './InboxAdapter';
export { fetchAuditByRecord, fetchAuditByTable, fetchRecentAudit } from './AuditAdapter';
export type { AuditEntry } from './AuditAdapter';
