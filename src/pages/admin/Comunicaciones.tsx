/**
 * Comunicaciones — Gestión de emails con tabs para cola, aprobación, inbox.
 */

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, StatusBadge, Column } from '@/components/shared';
import { fetchColaEmails, aprobarEmail } from '@/data/adapters/airtable/ColaEmailsAdapter';
import { ColaEmail, EstadoEmail } from '@/types';
import { timeAgo } from '@/utils/formatters';

type TabType = 'pendientes' | 'cola' | 'enviados' | 'errores';

export default function ComunicacionesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('pendientes');
  const [approving, setApproving] = useState<string | null>(null);

  const tabFilter: Record<TabType, EstadoEmail | undefined> = {
    pendientes: 'Pendiente Aprobacion',
    cola: 'Pendiente',
    enviados: 'Enviado',
    errores: 'Error',
  };

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['cola-emails', { estado: tabFilter[activeTab] }],
    queryFn: () => fetchColaEmails({ estado: tabFilter[activeTab] }),
  });

  async function handleAprobar(id: string) {
    setApproving(id);
    try {
      await aprobarEmail(id);
      await queryClient.invalidateQueries({ queryKey: ['cola-emails'] });
    } catch (err) {
      console.error('Error aprobando email:', err);
    } finally {
      setApproving(null);
    }
  }

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'pendientes', label: 'Pendientes Aprobación', icon: '⏳' },
    { key: 'cola', label: 'Cola de Envío', icon: '📤' },
    { key: 'enviados', label: 'Enviados', icon: '✅' },
    { key: 'errores', label: 'Errores', icon: '❌' },
  ];

  const columns = useMemo<Column<ColaEmail>[]>(() => {
    const cols: Column<ColaEmail>[] = [
      {
        key: 'alumnoNombre', header: 'Alumno', width: '160px',
        render: (e) => <span style={{ fontWeight: 500 }}>{e.alumnoNombre || '—'}</span>,
      },
      {
        key: 'tipo', header: 'Tipo', width: '120px',
        render: (e) => <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: 'var(--color-accent-info)' }}>{e.tipo}</span>,
      },
      {
        key: 'asunto', header: 'Asunto',
        render: (e) => <span style={{ fontSize: '0.8125rem' }}>{e.asunto || e.descripcion || e.mensaje?.slice(0, 60) || '—'}</span>,
      },
      {
        key: 'estado', header: 'Estado', width: '140px',
        render: (e) => <StatusBadge status={e.estado} type="email" />,
      },
      {
        key: 'createdTime', header: 'Fecha', width: '100px',
        render: (e) => <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{timeAgo(e.createdTime)}</span>,
      },
    ];
    if (activeTab === 'pendientes') {
      cols.push({
        key: 'actions', header: '', width: '100px',
        render: (e) => (
          <button
            className="btn-success btn-sm"
            onClick={(ev) => { ev.stopPropagation(); handleAprobar(e.id); }}
            disabled={approving === e.id}
          >
            {approving === e.id ? '...' : 'Aprobar'}
          </button>
        ),
      });
    }
    return cols;
  }, [activeTab, approving]);

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-xs)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              background: activeTab === tab.key ? 'var(--color-accent-primary-glow)' : 'transparent',
              border: activeTab === tab.key ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: activeTab === tab.key ? 'var(--color-accent-primary-hover)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 500,
              fontFamily: 'var(--font-family)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 150ms ease',
            }}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <DataTable
        columns={columns}
        data={emails}
        isLoading={isLoading}
        emptyMessage={`Sin emails ${activeTab}`}
        emptyIcon="📧"
      />
    </div>
  );
}
