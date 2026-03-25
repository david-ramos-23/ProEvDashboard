/**
 * Cliente Supabase para el dashboard ProEv.
 *
 * Inicializa la conexión con Supabase usando las variables de entorno VITE_.
 * Provee helpers para audit trail (set current user antes de mutaciones).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[SupabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

// Lazy-init to avoid crashing when env vars are missing (e.g., local dev without Supabase)
let _supabase: SupabaseClient | null = null;

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('[SupabaseClient] Cannot use Supabase without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
      }
      _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return (_supabase as any)[prop];
  },
});

/**
 * Sets the current user email in the PostgreSQL session so the audit trigger
 * can record who made the change.
 * Must be called before any mutation (update/insert/delete).
 */
export async function setCurrentUser(email: string): Promise<void> {
  await supabase.rpc('set_current_user', { email });
}

/**
 * Returns the current user email from session storage (set by AuthService).
 */
export function getCurrentUserEmail(): string {
  try {
    const raw = localStorage.getItem('proev_session');
    if (raw) {
      const session = JSON.parse(raw);
      return session.email || 'unknown';
    }
  } catch {
    // ignore
  }
  return 'unknown';
}

/**
 * Helper: sets current user from session before a mutation.
 * Use as: await withAudit(() => supabase.from('table').update(...))
 */
export async function withAudit<T>(fn: () => PromiseLike<T>): Promise<T> {
  await setCurrentUser(getCurrentUserEmail());
  return fn();
}
