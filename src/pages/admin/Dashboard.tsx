/**
 * Dashboard Admin — Vista principal con KPIs, gráficos y actividad reciente.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { KPICard, KPIGrid, KPICardSkeleton, SkeletonBlock, StatCard, DataTable, Column } from '@/components/shared';
import { fetchDashboardStats } from '@/data/adapters/airtable/AlumnosAdapter';
import { fetchPagosPorMes } from '@/data/adapters/airtable/PagosAdapter';
import { fetchHistorial } from '@/data/adapters/airtable/HistorialAdapter';
import { fetchColaEmails } from '@/data/adapters/airtable/ColaEmailsAdapter';
import { fetchInbox } from '@/data/adapters/airtable/InboxAdapter';
import { Historial } from '@/types';
import { formatCurrency, formatNumber, timeAgo } from '@/utils/formatters';
import { useTranslation } from '@/i18n';
import { useEdicion } from '@/context/EdicionContext';
import { ESTADO, ESTADO_EMAIL } from '@/utils/constants';

/** Colores hex reales para los gráficos (Recharts no soporta CSS vars) */
const CHART_COLORS: Record<string, string> = {
  'Privado': '#64748b',
  'Preinscrito': '#a78bfa',
  'En revisión de video': '#f59e0b',
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

  const { selectedNombre } = useEdicion();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', { edicionNombre: selectedNombre || undefined }],
    queryFn: () => fetchDashboardStats({ edicionNombre: selectedNombre || undefined }),
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
    queryKey: ['cola-emails', { estado: ESTADO_EMAIL.PENDIENTE_APROBACION }],
    queryFn: () => fetchColaEmails({ estado: ESTADO_EMAIL.PENDIENTE_APROBACION }),
  });
  const { data: inboxAlertas = [] } = useQuery({
    queryKey: ['inbox', { requiereAtencion: true }],
    queryFn: () => fetchInbox({ requiereAtencion: true }),
  });

  const historialColumns = useMemo<Column<Historial>[]>(() => [
    { key: 'tipoAccion', header: 'Tipo', width: '140px', sortable: true,
      render: (h) => <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{h.tipoAccion}</span>
    },
    { key: 'descripcion', header: 'Descripción',
      render: (h) => <span style={{ fontSize: '0.8125rem' }}>{h.descripcion?.slice(0, 80) || '—'}</span>
    },
    { key: 'alumnoNombre', header: 'Alumno', width: '160px', sortable: true },
    { key: 'createdTime', header: 'Hace', width: '100px', sortable: true,
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
      {/* KPIs navegables */}
      <KPIGrid columns={3}>
        {statsLoading || !stats ? (
          Array.from({ length: 6 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard label={t('dashboard.totalAlumnos')} value={formatNumber(stats.totalAlumnos)} icon="👥" color="var(--color-accent-primary)" onClick={() => navigate('/admin/alumnos')} />
            <KPICard label={t('dashboard.ingresosTotales')} value={formatCurrency(stats.ingresosTotales)} icon="💰" color="var(--color-accent-success)" onClick={() => navigate('/admin/pagos')} />
            <KPICard label={t('dashboard.pendientesRevision')} value={formatNumber(stats.pendientesRevision)} icon="🎥" color="var(--color-accent-warning)" onClick={() => navigate('/revisor/videos')} />
            <KPICard label={t('dashboard.emailsPendientes')} value={formatNumber(emailsPendientes.length)} icon="📧" color="var(--color-accent-warning)" onClick={() => navigate('/revisor/emails')} />
            <KPICard label={t('dashboard.inboxAtencion')} value={formatNumber(inboxAlertas.length)} icon="📬" color="var(--color-accent-info)" onClick={() => navigate('/admin/inbox')} />
            <KPICard label={t('dashboard.alertas')} value={formatNumber((stats.alumnosPorEstado[ESTADO.PLAZO_VENCIDO] || 0) + (stats.alumnosPorEstado[ESTADO.PAGO_FALLIDO] || 0))} icon="⚠️" color="var(--color-accent-danger)" subtext="Plazo vencido · Pago fallido" onClick={() => navigate('/admin/alumnos')} />
          </>
        )}
      </KPIGrid>

      {/* Stats informativas (no navegables) */}
      {stats && (
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <StatCard
            label={t('dashboard.conversion')}
            value={`${stats.totalAlumnos > 0 ? Math.round((stats.totalPagados / stats.totalAlumnos) * 100) : 0}% pagados`}
            icon="🎉"
          />
          <StatCard
            label={t('dashboard.engagement')}
            value={`${stats.engagementPromedio}% promedio`}
            icon="📈"
          />
        </div>
      )}

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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis type="number" tick={{ fill: '#4A4A4A', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={130} tick={{ fill: '#4A4A4A', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid rgba(169,169,169,0.4)', borderRadius: 8 }} labelStyle={{ color: '#1A1A1A' }} />
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="mes" tick={{ fill: '#4A4A4A', fontSize: 12 }} />
                <YAxis tick={{ fill: '#4A4A4A', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid rgba(169,169,169,0.4)', borderRadius: 8 }} formatter={(value: number) => [formatCurrency(Number(value)), 'Total']} />
                <Bar dataKey="total" fill="#0C5A45" radius={[4, 4, 0, 0]} />
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
        tableId="dashboard-historial"
        title={t('dashboard.actividadReciente')}
        columns={historialColumns}
        data={historial}
        emptyMessage={t('dashboard.sinActividad')}
        emptyIcon="📋"
      />
    </div>
  );
}
