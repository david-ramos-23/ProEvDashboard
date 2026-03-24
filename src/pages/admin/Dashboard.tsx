/**
 * Dashboard Admin — Vista principal con KPIs, gráficos y actividad reciente.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { KPICard, KPIGrid, KPICardSkeleton, SkeletonBlock, DataTable, Column } from '@/components/shared';
import { fetchDashboardStats } from '@/data/adapters/airtable/AlumnosAdapter';
import { fetchPagosPorMes } from '@/data/adapters/airtable/PagosAdapter';
import { fetchHistorial } from '@/data/adapters/airtable/HistorialAdapter';
import { fetchColaEmails } from '@/data/adapters/airtable/ColaEmailsAdapter';
import { fetchInbox } from '@/data/adapters/airtable/InboxAdapter';
import { Historial } from '@/types';
import { formatCurrency, formatNumber, timeAgo } from '@/utils/formatters';
import { useTranslation } from '@/i18n';

/** Colores hex reales para los gráficos (Recharts no soporta CSS vars) */
const CHART_COLORS: Record<string, string> = {
  'Privado': '#64748b',
  'Preinscrito': '#a78bfa',
  'En revision de video': '#f59e0b',
  'Aprobado': '#22c55e',
  'Rechazado': '#ef4444',
  'Pendiente de pago': '#fb923c',
  'Reserva': '#eab308',
  'Pagado': '#06b6d4',
  'Finalizado': '#8b5cf6',
  'Plazo Vencido': '#f87171',
  'Pago Fallido': '#dc2626',
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
  });
  const { data: pagosMes = [] } = useQuery({
    queryKey: ['pagos-por-mes'],
    queryFn: fetchPagosPorMes,
  });
  const { data: historial = [] } = useQuery({
    queryKey: ['historial', { maxRecords: 15 }],
    queryFn: () => fetchHistorial({ maxRecords: 15 }),
  });
  const { data: emailsPendientes = [] } = useQuery({
    queryKey: ['cola-emails', { estado: 'Pendiente Aprobacion' }],
    queryFn: () => fetchColaEmails({ estado: 'Pendiente Aprobacion' }),
  });
  const { data: inboxAlertas = [] } = useQuery({
    queryKey: ['inbox', { requiereAtencion: true }],
    queryFn: () => fetchInbox({ requiereAtencion: true }),
  });

  const historialColumns = useMemo<Column<Historial>[]>(() => [
    { key: 'tipoAccion', header: 'Tipo', width: '140px',
      render: (h) => <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{h.tipoAccion}</span>
    },
    { key: 'descripcion', header: 'Descripción',
      render: (h) => <span style={{ fontSize: '0.8125rem' }}>{h.descripcion?.slice(0, 80) || '—'}</span>
    },
    { key: 'alumnoNombre', header: 'Alumno', width: '160px' },
    { key: 'createdTime', header: 'Hace', width: '100px',
      render: (h) => <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{timeAgo(h.createdTime)}</span>
    },
  ], []);

  // Datos para el gráfico de barras
  const estadosChartData = stats
    ? Object.entries(stats.alumnosPorEstado)
        .filter(([, count]) => count > 0)
        .map(([estado, count]) => ({ name: estado, value: count, fill: CHART_COLORS[estado] || '#6366f1' }))
        .sort((a, b) => b.value - a.value)
    : [];

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      {/* KPIs principales */}
      <KPIGrid columns={5}>
        {statsLoading || !stats ? (
          Array.from({ length: 5 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard label={t('dashboard.totalAlumnos')} value={formatNumber(stats.totalAlumnos)} icon="👥" color="var(--color-accent-primary)" />
            <KPICard label={t('dashboard.pagados')} value={formatNumber(stats.totalPagados)} icon="🎉" color="var(--color-accent-success)" subtext={`${stats.totalAlumnos > 0 ? Math.round((stats.totalPagados / stats.totalAlumnos) * 100) : 0}% ${t('dashboard.conversion')}`} />
            <KPICard label={t('dashboard.pendientesRevision')} value={formatNumber(stats.pendientesRevision)} icon="🎥" color="var(--color-accent-warning)" />
            <KPICard label={t('dashboard.ingresosTotales')} value={formatCurrency(stats.ingresosTotales)} icon="💰" color="var(--color-accent-info)" />
            <KPICard label={t('dashboard.engagement')} value={`${stats.engagementPromedio}%`} icon="📈" color="#a78bfa" />
          </>
        )}
      </KPIGrid>

      {/* KPIs de Alertas */}
      <KPIGrid columns={3}>
        {statsLoading || !stats ? (
          Array.from({ length: 3 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/alumnos')}>
              <KPICard label={t('dashboard.alertas')} value={formatNumber((stats.alumnosPorEstado['Plazo Vencido'] || 0) + (stats.alumnosPorEstado['Pago Fallido'] || 0))} icon="⚠️" color="var(--color-accent-danger)" subtext="Plazo vencido + Pago fallido" />
            </div>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/revisor/emails')}>
              <KPICard label={t('dashboard.emailsPendientes')} value={formatNumber(emailsPendientes.length)} icon="📧" color="var(--color-accent-warning)" subtext="Pendientes de aprobación" />
            </div>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/inbox')}>
              <KPICard label={t('dashboard.inboxAtencion')} value={formatNumber(inboxAlertas.length)} icon="📬" color="var(--color-accent-info)" subtext="Requieren atención" />
            </div>
          </>
        )}
      </KPIGrid>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
        {/* Alumnos por Estado */}
        <div className="card">
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
            {t('dashboard.alumnosPorEstado')}
          </h3>
          {statsLoading ? (
            <SkeletonBlock height="280px" borderRadius="var(--radius-md)" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={estadosChartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={130} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1a1a3e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: '#f1f5f9' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {estadosChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pagos por Mes */}
        <div className="card">
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
            {t('dashboard.ingresosPorMes')}
          </h3>
          {statsLoading ? (
            <SkeletonBlock height="280px" borderRadius="var(--radius-md)" />
          ) : pagosMes.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={pagosMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#1a1a3e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} formatter={(value: number) => [formatCurrency(Number(value)), 'Total']} />
                <Bar dataKey="total" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
              {t('dashboard.sinDatosPagos')}
            </div>
          )}
        </div>
      </div>

      {/* Actividad Reciente */}
      <DataTable
        title={t('dashboard.actividadReciente')}
        columns={historialColumns}
        data={historial}
        emptyMessage={t('dashboard.sinActividad')}
        emptyIcon="📋"
      />
    </div>
  );
}
