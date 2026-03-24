/**
 * useSchema — Auto-syncs Airtable Single Select options.
 *
 * Fetches /api/airtable/schema once per session (staleTime 1h),
 * falls back to hardcoded constants if the API is unreachable.
 *
 * Usage:
 *   const { getOptions } = useSchema();
 *   const estados = getOptions('Alumnos', 'Estado General');
 *   // → ['Privado', 'Preinscrito', 'En revisión de video', ...]
 */

import { useQuery } from '@tanstack/react-query';
import { ESTADO, ESTADO_REVISION, ESTADO_PAGO, ESTADO_EMAIL } from '@/utils/constants';

type SchemaData = Record<string, Record<string, string[]>>;

/** Hardcoded fallbacks — used when API is unreachable */
const FALLBACK_SCHEMA: SchemaData = {
  'Alumnos': {
    'Estado General': Object.values(ESTADO),
  },
  'Revisiones de Video': {
    'Estado de Revisión': Object.values(ESTADO_REVISION),
  },
  'Pagos': {
    'Estado del Pago': Object.values(ESTADO_PAGO),
  },
  'Cola de Emails': {
    'Estado': Object.values(ESTADO_EMAIL),
  },
};

async function fetchSchema(): Promise<SchemaData> {
  const res = await fetch('/api/airtable/schema');
  const contentType = res.headers.get('content-type') || '';

  // Dev mode: Vite returns HTML for unknown routes
  if (!contentType.includes('application/json')) {
    console.warn('[Schema] API not available — using fallback');
    return FALLBACK_SCHEMA;
  }

  if (!res.ok) throw new Error('Schema fetch failed');
  return res.json();
}

export function useSchema() {
  const { data: schema = FALLBACK_SCHEMA } = useQuery({
    queryKey: ['airtable-schema'],
    queryFn: fetchSchema,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    retry: 1,
  });

  /**
   * Get the possible values for a Single Select field.
   * @param tableName - Airtable table name (e.g. 'Alumnos')
   * @param fieldName - Field name (e.g. 'Estado General')
   * @returns Array of option strings, or fallback if not found
   */
  function getOptions(tableName: string, fieldName: string): string[] {
    return schema[tableName]?.[fieldName]
      ?? FALLBACK_SCHEMA[tableName]?.[fieldName]
      ?? [];
  }

  return { schema, getOptions };
}
