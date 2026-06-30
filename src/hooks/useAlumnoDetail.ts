/**
 * Hook that bundles all data queries for the AlumnoDetail page.
 *
 * Secondary tabs (revisiones, pagos, historial) are lazy-loaded — their queries
 * only fire once the user first visits that tab, reducing unnecessary API calls
 * on initial page load.
 */

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAlumnoById, updateAlumno, updateRevision } from '@/data/adapters';
import { fetchRevisiones } from '@/data/adapters';
import { fetchPagos } from '@/data/adapters';
import { fetchHistorial } from '@/data/adapters';

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

  const revisionesQuery = useQuery({
    queryKey: ['revisiones', { alumnoId: id }],
    queryFn: () => fetchRevisiones({ alumnoId: id }),
    enabled: !!id && visitedTabs.has('revisiones'),
  });
  const revisiones = revisionesQuery.data ?? [];
  const revisionesLoading = revisionesQuery.isLoading;

  const pagosQuery = useQuery({
    queryKey: ['pagos', { alumnoId: id }],
    queryFn: () => fetchPagos({ alumnoId: id }),
    enabled: !!id && visitedTabs.has('pagos'),
  });
  const pagos = pagosQuery.data ?? [];
  const pagosLoading = pagosQuery.isLoading;

  const historialQuery = useQuery({
    queryKey: ['historial', { alumnoId: id, maxRecords: 20 }],
    queryFn: () => fetchHistorial({ alumnoId: id, maxRecords: 20 }),
    enabled: !!id && visitedTabs.has('historial'),
  });
  const historial = historialQuery.data ?? [];
  const historialLoading = historialQuery.isLoading;

  async function saveAlumno(updates: Parameters<typeof updateAlumno>[1]): Promise<void> {
    if (!id) return;
    await updateAlumno(id, updates);
    await queryClient.invalidateQueries({ queryKey: ['alumno', id] });
    await queryClient.invalidateQueries({ queryKey: ['alumnos'] });
  }

  async function updateVideoUrl(revisionId: string, videoEnviado: string): Promise<void> {
    await updateRevision(revisionId, { videoEnviado, estadoRevision: 'Pendiente' });
    await queryClient.invalidateQueries({ queryKey: ['revisiones', { alumnoId: id }] });
  }

  return {
    alumno,
    isLoading,
    revisiones,
    revisionesLoading,
    pagos,
    pagosLoading,
    historial,
    historialLoading,
    activeTab,
    goToTab,
    saveAlumno,
    updateVideoUrl,
  };
}
