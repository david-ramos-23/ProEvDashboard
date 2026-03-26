/**
 * Adaptador Supabase para la tabla audit_log.
 * NEW: no existe equivalente en Airtable.
 */

import { supabase } from './SupabaseClient';

export interface AuditEntry {
  id: string;
  tableName: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  userEmail: string | null;
  fieldChanges: Record<string, { old: string | null; new: string | null }> | null;
  createdAt: string;
}

function mapToAuditEntry(row: Record<string, unknown>): AuditEntry {
  return {
    id: row.id as string,
    tableName: row.table_name as string,
    recordId: row.record_id as string,
    action: row.action as AuditEntry['action'],
    userEmail: row.user_email as string | null,
    fieldChanges: row.field_changes as AuditEntry['fieldChanges'],
    createdAt: row.created_at as string,
  };
}

/** Fetch audit entries for a specific record */
export async function fetchAuditByRecord(recordId: string): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`fetchAuditByRecord: ${error.message}`);
  return (data || []).map(mapToAuditEntry);
}

/** Fetch audit entries for a specific table */
export async function fetchAuditByTable(
  tableName: string,
  options?: { limit?: number; userEmail?: string }
): Promise<AuditEntry[]> {
  let query = supabase
    .from('audit_log')
    .select('*')
    .eq('table_name', tableName)
    .order('created_at', { ascending: false })
    .limit(options?.limit || 50);

  if (options?.userEmail) {
    query = query.eq('user_email', options.userEmail);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fetchAuditByTable: ${error.message}`);
  return (data || []).map(mapToAuditEntry);
}

/** Fetch recent audit entries across all tables */
export async function fetchRecentAudit(limit = 50): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`fetchRecentAudit: ${error.message}`);
  return (data || []).map(mapToAuditEntry);
}
