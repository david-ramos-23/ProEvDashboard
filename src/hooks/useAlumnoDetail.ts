/**
 * Hook that bundles all data queries for the AlumnoDetail page.
 *
 * Secondary tabs (revisiones, pagos, historial) are lazy-loaded — their queries
 * only fire once the user first visits that tab, reducing unnecessary API calls
 * on initial page load.
 */

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAlumnoById, updateAlumno } from '@/data/adapters/airtable/AlumnosAdapter';
import { fetchRevisiones } from '@/data/adapters/airtable/RevisionesAdapter';
import { fetchPagos } from '@/data/adapters/airtable/PagosAdapter';
import { fetchHistorial } from '@/data/adapters/airtable/HistorialAdapter';
import { EstadoGeneral } from '@/types';

export type AlumnoDetailTab = 'info' | 'revisiones' | 'pagos' | 'historial' | 'ia';

export function useAlumnoDetail(id: string | undefined) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AlumnoDetailTab>('info');
  const [visitedTabs, setVisitedTabs] = useState<Set<AlumnoDetailTab>>(new Set(['info']));

  const goToTab = useCallback((tab: AlumnoDetailTab) => {
    setActiveTab(tab);
    setVisitedTabs(prev => new Set([...prev, tab]));
  }, []);

  const { data: alumno, isLoading } = useQuery({
    queryKey: ['alumno', id],
    queryFn: () => fetchAlumnoById(id!),
    enabled: !!id,
  });

  const { data: revisiones = [] } = useQuery({
    queryKey: ['revisiones', { alumnoId: id }],
    queryFn: () => fetchRevisiones({ alumnoId: id }),
    enabled: !!id && visitedTabs.has('revisiones'),
  });

  const { data: pagos = [] } = useQuery({
    queryKey: ['pagos', { alumnoId: id }],
    queryFn: () => fetchPagos({ alumnoId: id }),
    enabled: !!id && visitedTabs.has('pagos'),
  });

  const { data: historial = [] } = useQuery({
    queryKey: ['historial', { alumnoId: id, maxRecords: 20 }],
    queryFn: () => fetchHistorial({ alumnoId: id, maxRecords: 20 }),
    enabled: !!id && visitedTabs.has('historial'),
  });

  async function saveAlumno(updates: Parameters<typeof updateAlumno>[1]): Promise<void> {
    if (!id) return;
    await updateAlumno(id, updates);
    await queryClient.invalidateQueries({ queryKey: ['alumno', id] });
    await queryClient.invalidateQueries({ queryKey: ['alumnos'] });
  }

  return {
    alumno,
    isLoading,
    revisiones,
    pagos,
    historial,
    activeTab,
    goToTab,
    saveAlumno,
  };
}
