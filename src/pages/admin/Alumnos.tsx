/**
 * Gestión de Alumnos — CRUD con tabla filtrable y detalle expandible.
 */

import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DataTable, StatusBadge, Column } from '@/components/shared';
import { fetchAlumnos } from '@/data/adapters/airtable/AlumnosAdapter';
import { fetchEdiciones } from '@/data/adapters/airtable/EdicionesAdapter';
import { Alumno, EstadoGeneral } from '@/types';
import { timeAgo } from '@/utils/formatters';
import { ESTADO_ICONS } from '@/utils/constants';
import { useTranslation } from '@/i18n';

const ESTADOS: EstadoGeneral[] = [
  'Preinscrito', 'En revision de video', 'Aprobado', 'Rechazado',
  'Pendiente de pago', 'Reserva', 'Pagado', 'Finalizado', 'Plazo Vencido', 'Pago Fallido', 'Privado'
];

export default function AlumnosPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoGeneral | ''>('');
  const [filtroEdicion, setFiltroEdicion] = useState(searchParams.get('edicion') ?? '');

  const { data: ediciones = [] } = useQuery({
    queryKey: ['ediciones'],
    queryFn: fetchEdiciones,
  });
  const { data: alumnos = [], isLoading } = useQuery({
    queryKey: ['alumnos', { estado: filtroEstado || undefined, edicionId: filtroEdicion || undefined }],
    queryFn: () => fetchAlumnos({ estado: filtroEstado || undefined, edicionId: filtroEdicion || undefined }),
  });

  // Filtro de búsqueda local (para respuesta instantánea)
  const filtered = search
    ? alumnos.filter(a =>
        a.nombre.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase())
      )
    : alumnos;

  const columns = useMemo<Column<Alumno>[]>(() => [
    {
      key: 'nombre', header: t('alumnos.alumno'), width: '200px',
      render: (a) => (
        <div>
          <div style={{ fontWeight: 500 }}>{a.nombre || '—'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{a.email}</div>
        </div>
      ),
    },
    {
      key: 'estadoGeneral', header: t('alumnos.estado'), width: '170px',
      render: (a) => <StatusBadge status={a.estadoGeneral} type="estado" showIcon />,
    },
    {
      key: 'moduloSolicitado', header: t('alumnos.modulo'), width: '120px',
      render: (a) => <span style={{ color: 'var(--color-text-secondary)' }}>{a.moduloSolicitado || '—'}</span>,
    },
    {
      key: 'idioma', header: t('alumnos.idioma'), width: '80px',
      render: (a) => <span>{a.idioma === 'Ingles' ? '🇬🇧' : '🇪🇸'}</span>,
    },
    {
      key: 'engagementScore', header: t('alumnos.engagementCol'), width: '100px',
      render: (a) => a.engagementScore != null ? (
        <span style={{ color: a.engagementScore > 70 ? 'var(--color-accent-success)' : a.engagementScore > 40 ? 'var(--color-accent-warning)' : 'var(--color-accent-danger)' }}>
          {a.engagementScore}%
        </span>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>,
    },
    {
      key: 'ultimaModificacion', header: t('alumnos.lastActivity'), width: '120px',
      render: (a) => <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{timeAgo(a.ultimaModificacion)}</span>,
    },
  ], []);

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Filtro por edición */}
      {ediciones.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{t('dashboard.filtrarEdicion')}:</span>
          <select
            value={filtroEdicion}
            onChange={e => setFiltroEdicion(e.target.value)}
            style={{
              background: 'var(--color-bg-input)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text-primary)',
              padding: '6px 12px',
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          >
            <option value="">Todas las ediciones</option>
            {ediciones.map(ed => (
              <option key={ed.id} value={ed.id}>{ed.nombre}{ed.esEdicionActiva ? ' ★' : ''}</option>
            ))}
          </select>
        </div>
      )}

      {/* Filtro por estado */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <button
          className={`btn-sm ${!filtroEstado ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFiltroEstado('')}
        >
          Todos ({alumnos.length})
        </button>
        {ESTADOS.map(est => (
          <button
            key={est}
            className={`btn-sm ${filtroEstado === est ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFiltroEstado(est === filtroEstado ? '' : est)}
          >
            {ESTADO_ICONS[est]} {est}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <DataTable
        title={`${t('nav.alumnos')}${filtroEstado ? ` — ${filtroEstado}` : ''}`}
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
