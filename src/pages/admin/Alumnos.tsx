/**
 * Gestión de Alumnos — CRUD con tabla filtrable y detalle expandible.
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DataTable, StatusBadge, Column } from '@/components/shared';
import { fetchAlumnos } from '@/data/adapters/airtable/AlumnosAdapter';
import { Alumno, EstadoGeneral } from '@/types';
import { timeAgo } from '@/utils/formatters';
import { ESTADO_ICONS, ESTADO } from '@/utils/constants';
import { useTranslation } from '@/i18n';
import { useEdicion } from '@/context/EdicionContext';
import { useSchema } from '@/hooks/useSchema';

const FILTER_STORAGE_KEY = 'proev_alumnos_filters';

const DEFAULT_VISIBLE: EstadoGeneral[] = [
  ESTADO.PREINSCRITO, ESTADO.EN_REVISION, ESTADO.PENDIENTE_PAGO,
  ESTADO.PLAZO_VENCIDO, ESTADO.RESERVA,
];

interface FilterPrefs { order: EstadoGeneral[]; visible: EstadoGeneral[] }

function loadFilterPrefs(): FilterPrefs | null {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveFilterPrefs(prefs: FilterPrefs) {
  try { localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(prefs)); } catch { /* noop */ }
}

export default function AlumnosPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getOptions } = useSchema();

  // All available estados from schema
  const ALL_ESTADOS = useMemo(() => {
    const fromSchema = getOptions('Alumnos', 'Estado General') as EstadoGeneral[];
    return fromSchema.length > 0
      ? fromSchema.filter(e => e !== ESTADO.PRIVADO)
      : [ESTADO.PREINSCRITO, ESTADO.EN_REVISION, ESTADO.APROBADO, ESTADO.RECHAZADO,
         ESTADO.PENDIENTE_PAGO, ESTADO.RESERVA, ESTADO.PAGADO, ESTADO.FINALIZADO,
         ESTADO.PLAZO_VENCIDO, ESTADO.PAGO_FALLIDO];
  }, [getOptions]);

  // Filter chip order & visibility (persisted)
  const [chipOrder, setChipOrder] = useState<EstadoGeneral[]>(() => {
    const saved = loadFilterPrefs();
    return saved?.order ?? [...ALL_ESTADOS];
  });
  const [visibleChips, setVisibleChips] = useState<Set<EstadoGeneral>>(() => {
    const saved = loadFilterPrefs();
    return new Set(saved?.visible ?? DEFAULT_VISIBLE);
  });
  const [configOpen, setConfigOpen] = useState(false);

  // Persist on change
  const persistFilters = useCallback((order: EstadoGeneral[], visible: Set<EstadoGeneral>) => {
    saveFilterPrefs({ order, visible: [...visible] });
  }, []);

  // Drag & drop state
  const dragIdx = useRef<number | null>(null);

  function handleDragStart(idx: number) {
    dragIdx.current = idx;
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const newOrder = [...chipOrder];
    const [moved] = newOrder.splice(dragIdx.current, 1);
    newOrder.splice(idx, 0, moved);
    dragIdx.current = idx;
    setChipOrder(newOrder);
    persistFilters(newOrder, visibleChips);
  }

  function toggleChipVisibility(est: EstadoGeneral) {
    setVisibleChips(prev => {
      const next = new Set(prev);
      if (next.has(est)) next.delete(est); else next.add(est);
      persistFilters(chipOrder, next);
      return next;
    });
  }

  const { selectedNombre } = useEdicion();
  const [search, setSearch] = useState('');
  const [filtrosEstado, setFiltrosEstado] = useState<Set<EstadoGeneral>>(new Set());

  // Fetch all alumnos for the edition (estado filtering is done client-side for AND logic)
  const { data: alumnos = [], isLoading } = useQuery({
    queryKey: ['alumnos', { edicionNombre: selectedNombre || undefined }],
    queryFn: () => fetchAlumnos({ edicionNombre: selectedNombre || undefined }),
  });

  const toggleEstado = (est: EstadoGeneral) => {
    setFiltrosEstado(prev => {
      const next = new Set(prev);
      if (next.has(est)) next.delete(est);
      else next.add(est);
      return next;
    });
  };

  // Client-side filtering: estado chips (OR within estados) + search
  const filtered = useMemo(() => {
    let result = alumnos;
    if (filtrosEstado.size > 0) {
      result = result.filter(a => filtrosEstado.has(a.estadoGeneral));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        String(a.nombre || '').toLowerCase().includes(q) ||
        String(a.email || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [alumnos, filtrosEstado, search]);

  const columns = useMemo<Column<Alumno>[]>(() => [
    {
      key: 'nombre', header: t('alumnos.alumno'), width: '200px', sortable: true,
      render: (a) => (
        <div>
          <div style={{ fontWeight: 500 }}>{a.nombre || '—'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{a.email}</div>
        </div>
      ),
    },
    {
      key: 'estadoGeneral', header: t('alumnos.estado'), width: '170px', sortable: true,
      render: (a) => <StatusBadge status={a.estadoGeneral} type="estado" showIcon />,
    },
    {
      key: 'moduloSolicitado', header: t('alumnos.modulo'), width: '120px', sortable: true,
      render: (a) => <span style={{ color: 'var(--color-text-secondary)' }}>{a.moduloSolicitado || '—'}</span>,
    },
    {
      key: 'idioma', header: t('alumnos.idioma'), width: '80px',
      render: (a) => <span>{a.idioma === 'Ingles' ? '🇬🇧' : '🇪🇸'}</span>,
    },
    {
      key: 'engagementScore', header: t('alumnos.engagementCol'), width: '100px', sortable: true,
      render: (a) => a.engagementScore != null ? (
        <span style={{ color: a.engagementScore > 70 ? 'var(--color-accent-success)' : a.engagementScore > 40 ? 'var(--color-accent-warning)' : 'var(--color-accent-danger)' }}>
          {a.engagementScore}%
        </span>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>,
    },
    {
      key: 'ultimaModificacion', header: t('alumnos.lastActivity'), width: '120px', sortable: true,
      render: (a) => <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{timeAgo(a.ultimaModificacion)}</span>,
    },
  ], []);

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Filtro por estado (configurable chips with drag & drop) */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
        {chipOrder.filter(est => visibleChips.has(est)).map((est, idx) => (
          <button
            key={est}
            draggable
            onDragStart={() => handleDragStart(chipOrder.indexOf(est))}
            onDragOver={(e) => handleDragOver(e, chipOrder.indexOf(est))}
            className={`btn-sm ${filtrosEstado.has(est) ? 'btn-primary' : 'btn-ghost'}`}
            style={{ cursor: 'grab' }}
            onClick={() => toggleEstado(est)}
          >
            {ESTADO_ICONS[est]} {est}
          </button>
        ))}

        {filtrosEstado.size > 0 && (
          <button
            className="btn-sm btn-ghost"
            onClick={() => setFiltrosEstado(new Set())}
            style={{ color: 'var(--color-accent-danger)', borderColor: 'rgba(220,38,38,0.2)' }}
          >
            Limpiar filtros
          </button>
        )}

        {/* Config toggle */}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <button
            className="btn-sm btn-ghost"
            onClick={() => setConfigOpen(p => !p)}
            style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Filtros
          </button>
          {configOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              minWidth: 240, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 100,
              padding: '0',
            }}>
              <div style={{ padding: '8px 14px', fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)' }}>
                Mostrar filtros
              </div>
              <div style={{ padding: '6px 0' }}>
              {/* Active filters first, then inactive */}
              {[...ALL_ESTADOS].sort((a, b) => {
                const aActive = visibleChips.has(a) ? 0 : 1;
                const bActive = visibleChips.has(b) ? 0 : 1;
                return aActive - bActive;
              }).map(est => (
                <label key={est} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '6px 14px', fontSize: '0.8125rem',
                  color: visibleChips.has(est) ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'background 150ms',
                }}>
                  <input
                    type="checkbox"
                    checked={visibleChips.has(est)}
                    onChange={() => toggleChipVisibility(est)}
                    style={{ accentColor: 'var(--color-accent-primary)', flexShrink: 0 }}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{ESTADO_ICONS[est]}</span> {est}
                  </span>
                </label>
              ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabla */}
      <DataTable
        tableId="alumnos"
        title={`${t('nav.alumnos')} (${filtered.length})`}
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('alumnos.searchPlaceholder')}
        onRowClick={(a) => navigate(`/admin/alumnos/${a.id}`)}
        emptyMessage={t('alumnos.noResults')}
        emptyIcon="👥"
      />
    </div>
  );
}
