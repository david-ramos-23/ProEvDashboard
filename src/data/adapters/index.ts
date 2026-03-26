/**
 * Data adapter barrel export.
 *
 * Switches between Airtable and Supabase adapters based on VITE_DATA_SOURCE env var.
 * Default: 'airtable' (production stays on Airtable until cutover).
 *
 * Set VITE_DATA_SOURCE=supabase in .env.local to use Supabase during development/testing.
 */

import * as airtableAlumnos from './airtable/AlumnosAdapter';
import * as airtableRevisiones from './airtable/RevisionesAdapter';
import * as airtablePagos from './airtable/PagosAdapter';
import * as airtableHistorial from './airtable/HistorialAdapter';
import * as airtableEdiciones from './airtable/EdicionesAdapter';
import * as airtableModulos from './airtable/ModulosAdapter';
import * as airtableColaEmails from './airtable/ColaEmailsAdapter';
import * as airtableInbox from './airtable/InboxAdapter';

import * as supabaseAlumnos from './supabase/AlumnosAdapter';
import * as supabaseRevisiones from './supabase/RevisionesAdapter';
import * as supabasePagos from './supabase/PagosAdapter';
import * as supabaseHistorial from './supabase/HistorialAdapter';
import * as supabaseEdiciones from './supabase/EdicionesAdapter';
import * as supabaseModulos from './supabase/ModulosAdapter';
import * as supabaseColaEmails from './supabase/ColaEmailsAdapter';
import * as supabaseInbox from './supabase/InboxAdapter';

const useSupabase = import.meta.env.VITE_DATA_SOURCE === 'supabase';

// --- Alumnos ---
const alumnos = useSupabase ? supabaseAlumnos : airtableAlumnos;
export const fetchAlumnos = alumnos.fetchAlumnos;
export const fetchAlumnoById = alumnos.fetchAlumnoById;
export const updateAlumno = alumnos.updateAlumno;
export const fetchAlumnoCountByModulo = alumnos.fetchAlumnoCountByModulo;
export const fetchAlumnoNombresByIds = alumnos.fetchAlumnoNombresByIds;
export const fetchDashboardStats = alumnos.fetchDashboardStats;

// --- Revisiones ---
const revisiones = useSupabase ? supabaseRevisiones : airtableRevisiones;
export const fetchRevisiones = revisiones.fetchRevisiones;
export const fetchRevisionById = revisiones.fetchRevisionById;
export const updateRevision = revisiones.updateRevision;
export const fetchRevisionStats = revisiones.fetchRevisionStats;

// --- Pagos ---
const pagos = useSupabase ? supabasePagos : airtablePagos;
export const fetchPagos = pagos.fetchPagos;
export const fetchPagoStats = pagos.fetchPagoStats;
export const fetchPagosPorMes = pagos.fetchPagosPorMes;

// --- Historial ---
const historial = useSupabase ? supabaseHistorial : airtableHistorial;
export const fetchHistorial = historial.fetchHistorial;

// --- Ediciones ---
const ediciones = useSupabase ? supabaseEdiciones : airtableEdiciones;
export const fetchEdiciones = ediciones.fetchEdiciones;
export const updateEdicion = ediciones.updateEdicion;

// --- Modulos ---
const modulos = useSupabase ? supabaseModulos : airtableModulos;
export const fetchModulos = modulos.fetchModulos;

// --- Cola Emails ---
const colaEmails = useSupabase ? supabaseColaEmails : airtableColaEmails;
export const fetchColaEmails = colaEmails.fetchColaEmails;
export const aprobarEmail = colaEmails.aprobarEmail;
export const crearEmail = colaEmails.crearEmail;

// --- Inbox ---
const inbox = useSupabase ? supabaseInbox : airtableInbox;
export const fetchInbox = inbox.fetchInbox;
export const updateInboxEmail = inbox.updateInboxEmail;

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
