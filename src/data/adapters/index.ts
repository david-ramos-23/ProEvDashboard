/**
 * Data adapter barrel export.
 *
 * Switches between Airtable and Supabase adapters based on VITE_DATA_SOURCE env var.
 * Default: 'airtable' (production stays on Airtable until cutover).
 *
 * Set VITE_DATA_SOURCE=supabase in .env.local to use Supabase during development/testing.
 *
 * Uses Vite's build-time dead-code elimination: when VITE_DATA_SOURCE !== 'supabase',
 * the Supabase imports are never reached and tree-shaken out of production bundles.
 */

const useSupabase = import.meta.env.VITE_DATA_SOURCE === 'supabase';

// Lazy-load the correct adapter set. Vite statically analyzes import() paths,
// so both sets are available but only the active one is included in the main chunk.
// The inactive adapter set ends up in a separate chunk that is never loaded at runtime.

async function loadAdapters() {
  if (useSupabase) {
    const [alumnos, revisiones, pagos, historial, ediciones, modulos, colaEmails, inbox] = await Promise.all([
      import('./supabase/AlumnosAdapter'),
      import('./supabase/RevisionesAdapter'),
      import('./supabase/PagosAdapter'),
      import('./supabase/HistorialAdapter'),
      import('./supabase/EdicionesAdapter'),
      import('./supabase/ModulosAdapter'),
      import('./supabase/ColaEmailsAdapter'),
      import('./supabase/InboxAdapter'),
    ]);
    return { alumnos, revisiones, pagos, historial, ediciones, modulos, colaEmails, inbox };
  }
  const [alumnos, revisiones, pagos, historial, ediciones, modulos, colaEmails, inbox] = await Promise.all([
    import('./airtable/AlumnosAdapter'),
    import('./airtable/RevisionesAdapter'),
    import('./airtable/PagosAdapter'),
    import('./airtable/HistorialAdapter'),
    import('./airtable/EdicionesAdapter'),
    import('./airtable/ModulosAdapter'),
    import('./airtable/ColaEmailsAdapter'),
    import('./airtable/InboxAdapter'),
  ]);
  return { alumnos, revisiones, pagos, historial, ediciones, modulos, colaEmails, inbox };
}

// Singleton promise — adapters load once on first access
let adaptersPromise: ReturnType<typeof loadAdapters> | null = null;
function getAdapters() {
  if (!adaptersPromise) adaptersPromise = loadAdapters();
  return adaptersPromise;
}

// --- Alumnos ---
export async function fetchAlumnos(...args: Parameters<typeof import('./airtable/AlumnosAdapter').fetchAlumnos>) {
  return (await getAdapters()).alumnos.fetchAlumnos(...args);
}
export async function fetchAlumnoById(...args: Parameters<typeof import('./airtable/AlumnosAdapter').fetchAlumnoById>) {
  return (await getAdapters()).alumnos.fetchAlumnoById(...args);
}
export async function updateAlumno(...args: Parameters<typeof import('./airtable/AlumnosAdapter').updateAlumno>) {
  return (await getAdapters()).alumnos.updateAlumno(...args);
}
export async function fetchAlumnoCountByModulo(...args: Parameters<typeof import('./airtable/AlumnosAdapter').fetchAlumnoCountByModulo>) {
  return (await getAdapters()).alumnos.fetchAlumnoCountByModulo(...args);
}
export async function fetchAlumnoNombresByIds(...args: Parameters<typeof import('./airtable/AlumnosAdapter').fetchAlumnoNombresByIds>) {
  return (await getAdapters()).alumnos.fetchAlumnoNombresByIds(...args);
}
export async function fetchDashboardStats(...args: Parameters<typeof import('./airtable/AlumnosAdapter').fetchDashboardStats>) {
  return (await getAdapters()).alumnos.fetchDashboardStats(...args);
}

// --- Revisiones ---
export async function fetchRevisiones(...args: Parameters<typeof import('./airtable/RevisionesAdapter').fetchRevisiones>) {
  return (await getAdapters()).revisiones.fetchRevisiones(...args);
}
export async function fetchRevisionById(...args: Parameters<typeof import('./airtable/RevisionesAdapter').fetchRevisionById>) {
  return (await getAdapters()).revisiones.fetchRevisionById(...args);
}
export async function updateRevision(...args: Parameters<typeof import('./airtable/RevisionesAdapter').updateRevision>) {
  return (await getAdapters()).revisiones.updateRevision(...args);
}
export async function fetchRevisionStats(edicionNombre?: string) {
  return (await getAdapters()).revisiones.fetchRevisionStats(edicionNombre);
}

// --- Pagos ---
export async function fetchPagos(...args: Parameters<typeof import('./airtable/PagosAdapter').fetchPagos>) {
  return (await getAdapters()).pagos.fetchPagos(...args);
}
export async function fetchPagoStats(...args: Parameters<typeof import('./airtable/PagosAdapter').fetchPagoStats>) {
  return (await getAdapters()).pagos.fetchPagoStats(...args);
}
export async function fetchPagosPorMes(...args: Parameters<typeof import('./airtable/PagosAdapter').fetchPagosPorMes>) {
  return (await getAdapters()).pagos.fetchPagosPorMes(...args);
}

// --- Historial ---
export async function fetchHistorial(...args: Parameters<typeof import('./airtable/HistorialAdapter').fetchHistorial>) {
  return (await getAdapters()).historial.fetchHistorial(...args);
}

// --- Ediciones ---
export async function fetchEdiciones(...args: Parameters<typeof import('./airtable/EdicionesAdapter').fetchEdiciones>) {
  return (await getAdapters()).ediciones.fetchEdiciones(...args);
}
export async function updateEdicion(...args: Parameters<typeof import('./airtable/EdicionesAdapter').updateEdicion>) {
  return (await getAdapters()).ediciones.updateEdicion(...args);
}

// --- Modulos ---
export async function fetchModulos() {
  return (await getAdapters()).modulos.fetchModulos();
}

// --- Cola Emails ---
export async function fetchColaEmails(...args: Parameters<typeof import('./airtable/ColaEmailsAdapter').fetchColaEmails>) {
  return (await getAdapters()).colaEmails.fetchColaEmails(...args);
}
export async function aprobarEmail(...args: Parameters<typeof import('./airtable/ColaEmailsAdapter').aprobarEmail>) {
  return (await getAdapters()).colaEmails.aprobarEmail(...args);
}
export async function crearEmail(...args: Parameters<typeof import('./airtable/ColaEmailsAdapter').crearEmail>) {
  return (await getAdapters()).colaEmails.crearEmail(...args);
}

// --- Inbox ---
export async function fetchInbox(...args: Parameters<typeof import('./airtable/InboxAdapter').fetchInbox>) {
  return (await getAdapters()).inbox.fetchInbox(...args);
}
export async function updateInboxEmail(...args: Parameters<typeof import('./airtable/InboxAdapter').updateInboxEmail>) {
  return (await getAdapters()).inbox.updateInboxEmail(...args);
}

// --- Audit (Supabase-only, noop for Airtable) ---
export async function fetchAuditByRecord(recordId: string) {
  if (!useSupabase) return [];
  const mod = await import('./supabase/AuditAdapter');
  return mod.fetchAuditByRecord(recordId);
}

export async function fetchAuditByTable(tableName: string, options?: { limit?: number; userEmail?: string }) {
  if (!useSupabase) return [];
  const mod = await import('./supabase/AuditAdapter');
  return mod.fetchAuditByTable(tableName, options);
}

export async function fetchRecentAudit(limit?: number) {
  if (!useSupabase) return [];
  const mod = await import('./supabase/AuditAdapter');
  return mod.fetchRecentAudit(limit);
}

// Re-export audit types
export type { AuditEntry } from './supabase/AuditAdapter';
