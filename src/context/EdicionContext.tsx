/**
 * Global edition filter context.
 *
 * Provides the currently selected edition (defaults to the active edition)
 * to all pages in the dashboard. The selector lives in the Layout header.
 */

import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchEdiciones } from '@/data/adapters';
import type { Edicion } from '@/types';

interface EdicionContextValue {
  ediciones: Edicion[];
  selectedEdicion: Edicion | null;
  selectedNombre: string;
  setSelectedNombre: (nombre: string) => void;
  isLoading: boolean;
}

const EdicionContext = createContext<EdicionContextValue>({
  ediciones: [],
  selectedEdicion: null,
  selectedNombre: '',
  setSelectedNombre: () => {},
  isLoading: true,
});

export function EdicionProvider({ children }: { children: ReactNode }) {
  const { data: ediciones = [], isLoading } = useQuery({
    queryKey: ['ediciones'],
    queryFn: fetchEdiciones,
    staleTime: 5 * 60 * 1000,
  });

  const [selectedNombre, setSelectedNombre] = useState('');

  // Default to active edition once loaded
  useEffect(() => {
    if (ediciones.length > 0 && !selectedNombre) {
      const active = ediciones.find(e => e.esEdicionActiva);
      if (active) setSelectedNombre(active.nombre);
    }
  }, [ediciones, selectedNombre]);

  const selectedEdicion = useMemo(
    () => ediciones.find(e => e.nombre === selectedNombre) ?? null,
    [ediciones, selectedNombre],
  );

  const value = useMemo(() => ({
    ediciones,
    selectedEdicion,
    selectedNombre,
    setSelectedNombre,
    isLoading,
  }), [ediciones, selectedEdicion, selectedNombre, isLoading]);

  return (
    <EdicionContext.Provider value={value}>
      {children}
    </EdicionContext.Provider>
  );
}

export function useEdicion() {
  return useContext(EdicionContext);
}
