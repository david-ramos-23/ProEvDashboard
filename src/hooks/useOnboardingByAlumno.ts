import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOnboarding } from '@/data/adapters';
import { Onboarding } from '@/types';

/** Size order for sorting; unknown sizes sort after the known ones. */
const TSHIRT_SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

/** Numeric rank so DataTable sorts XS < S < M < L < XL instead of alphabetically. */
export function tshirtSizeRank(size?: string): number | undefined {
  if (!size) return undefined;
  const idx = TSHIRT_SIZE_ORDER.indexOf(size.trim().toUpperCase());
  return idx === -1 ? TSHIRT_SIZE_ORDER.length : idx;
}

/**
 * Latest onboarding submission per alumno id. Shares the global ['onboarding']
 * query (and cache) with useAlumnoDetail — the Airtable adapter is full-table anyway.
 * Callers must use isLoading/isError: an empty map does NOT mean "nobody submitted".
 */
export function useOnboardingByAlumno() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => fetchOnboarding(),
    staleTime: 5 * 60 * 1000,
  });

  const byAlumno = useMemo(() => {
    const map = new Map<string, Onboarding>();
    // Adapter returns newest-first, so the first row per alumno wins.
    for (const o of data ?? []) {
      if (o.alumnoId && !map.has(o.alumnoId)) map.set(o.alumnoId, o);
    }
    return map;
  }, [data]);

  return { byAlumno, isLoading, isError };
}
