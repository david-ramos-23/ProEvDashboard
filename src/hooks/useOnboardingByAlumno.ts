import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOnboarding } from '@/data/adapters';
import { Onboarding } from '@/types';

/**
 * Latest onboarding submission per alumno id. Shares the global ['onboarding']
 * query (and cache) with useAlumnoDetail — the Airtable adapter is full-table anyway.
 */
export function useOnboardingByAlumno(): Map<string, Onboarding> {
  const { data } = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => fetchOnboarding(),
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const map = new Map<string, Onboarding>();
    // Adapter returns newest-first, so the first row per alumno wins.
    for (const o of data ?? []) {
      if (o.alumnoId && !map.has(o.alumnoId)) map.set(o.alumnoId, o);
    }
    return map;
  }, [data]);
}
