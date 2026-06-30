/**
 * Dashboard Admin — Vista principal con KPIs, gráficos y actividad reciente.
 */

import { useMemo, useCallback, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { KPICard, KPIGrid, KPICardSkeleton, SkeletonBlock, StatCard, DataTable, Column, PageHeader } from '@/components/shared';
import { fetchDashboardStats } from '@/data/adapters';
import { fetchPagosPorMes } from '@/data/adapters';
import { fetchHistorial } from '@/data/adapters';
import { fetchColaEmails } from '@/data/adapters';
import { fetchInbox } from '@/data/adapters';
import { fetchRevisionStats } from '@/data/adapters';
import { fetchPagos } from '@/data/adapters';
import { pagosDeEdicion } from '@/lib/resolveEdicion';
import { Historial } from '@/types';
import { formatCurrency, formatNumber, timeAgo } from '@/utils/formatters';
import { useTranslation } from '@/i18n';
import { useEdicion } from '@/context/EdicionContext';
import { ESTADO, ESTADO_EMAIL } from '@/utils/constants';
import { useHighlightRow } from '@/hooks/useHighlightRow';

/** Hook to get theme-aware Recharts colors */
function useChartTheme() {
  const subscribe = useCallback((cb: () => void) => {
    const obs = new MutationObserver(cb);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  const isDark = useSyncExternalStore(subscribe, () => document.documentElement.getAttribute('data-theme') === 'dark');
  return {
    tickFill: isDark ? '#A0A0A0' : '#4A4A4A',
    gridStroke: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    tooltipBg: isDark ? '#2A2A2A' : '#FFFFFF',
    tooltipBorder: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(169,169,169,0.4)',
    tooltipLabel: isDark ? '#F0F0F0' : '#1A1A1A',
  };
}

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
  const chartTheme = useChartTheme();
  useHighlightRow();

  const { selectedNombre, ediciones } = useEdicion();

  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['dashboard-stats', { edicionNombre: selectedNombre || undefined }],
    queryFn: () => fetchDashboardStats({ edicionNombre: selectedNombre || undefined }),
  });
  const { data: pagosMes = [] } = useQuery({
    queryKey: ['pagos-por-mes'],
    queryFn: () => fetchPagosPorMes(),
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
  // A1: Use same revision count source as VideoReview (Revisiones table, not Alumnos estado)
  const { data: revisionStats } = useQuery({
    queryKey: ['revision-stats', { edicionNombre: selectedNombre || undefined }],
    queryFn: () => fetchRevisionStats(selectedNombre || undefined),
  });
  // Same queryKey as Pagos page → shared React Query cache, no extra fetch
  const { data: pagos = [], isLoading: isPagosLoading } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => fetchPagos({}),
  });

  const historialColumns = useMemo<Column<Historial>[]>(() => [
    { key: 'tipoAccion', header: 'Tipo', width: '140px', sortable: true, minWidth: 90,
      render: (h) => <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{h.tipoAccion}</span>
    },
    { key: 'descripcion', header: 'Descripción',
      render: (h) => <span style={{ fontSize: '0.8125rem' }}>{h.descripcion?.slice(0, 80) || '—'}</span>
    },
    { key: 'alumnoNombre', header: 'Alumno', width: '160px', sortable: true, minWidth: 100 },
    { key: 'createdTime', header: 'Hace', width: '100px', sortable: true, minWidth: 70,
      render: (h) => <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{timeAgo(h.createdTime)}</span>
    },
  ], [t]);

  // Datos para el gráfico de barras
  const estadosChartData = useMemo(() => stats
    ? Object.entries(stats.alumnosPorEstado)
        .filter(([, count]) => count > 0)
        .map(([estado, count]) => ({ name: estado, value: count, fill: CHART_COLORS[estado] || '#6366f1' }))
        .sort((a, b) => b.value - a.value)
    : []
  , [stats]);

  // Ingresos: same calculation as Pagos page (individual payments by date window)
  const ingresosTotales = useMemo(
    () => pagosDeEdicion(pagos, ediciones, selectedNombre)
      .filter(p => p.estadoPago === 'Pagado')
      .reduce((s, p) => s + (p.importe || 0), 0),
    [pagos, ediciones, selectedNombre],
  );

  // A3: conversion = Pagados ÷ (Pagados + Pendiente de pago)
  const conversionPct = useMemo(() => {
    if (!stats) return 0;
    const pool = stats.totalPagados + (stats.alumnosPorEstado[ESTADO.PENDIENTE_PAGO] || 0);
    return pool > 0 ? Math.round(stats.totalPagados * 100 / pool) : 0;
  }, [stats]);

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      {statsError && (
        <div role="alert" style={{ padding: "var(--space-md)", background: "color-mix(in srgb, var(--color-accent-danger) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--color-accent-danger) 30%, transparent)", borderRadius: "var(--radius-md)", color: "var(--color-accent-danger)", fontSize: "var(--font-size-sm)", marginBottom: "var(--space-md)" }}>
          Error al cargar el dashboard. Comprueba tu conexion e intentalo de nuevo.
        </div>
      )}
      <PageHeader title={t('nav.dashboard')} />
      {/* KPIs navegables */}
      <KPIGrid columns={3}>
        {statsLoading || isPagosLoading || !stats ? (
          Array.from({ length: 6 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard label={t('dashboard.totalAlumnos')} value={formatNumber(stats.totalAlumnos)} icon="👥" color="var(--color-accent-primary)" onClick={() => navigate('/admin/alumnos')} />
            <KPICard label={t('dashboard.ingresosTotales')} value={formatCurrency(ingresosTotales)} icon="💰" color="var(--color-accent-success)" onClick={() => navigate('/admin/pagos')} subtext="Pagos confirmados" />
            <KPICard label={t('dashboard.pendientesRevision')} value={formatNumber(revisionStats?.pendientes ?? stats.pendientesRevision)} icon="🎥" color="var(--color-accent-warning)" onClick={() => navigate('/revisor/videos')} />
            <KPICard label={t('dashboard.emailsPendientes')} value={formatNumber(emailsPendientes.length)} icon="📧" color="var(--color-accent-warning)" onClick={() => navigate('/admin/inbox?section=cola')} />
            <KPICard label={t('dashboard.inboxAtencion')} value={formatNumber(inboxAlertas.length)} icon="📬" color="var(--color-accent-info)" onClick={() => navigate('/admin/inbox')} />
            <KPICard label={t('dashboard.alertas')} value={formatNumber((stats.alumnosPorEstado[ESTADO.PLAZO_VENCIDO] || 0) + (stats.alumnosPorEstado[ESTADO.PAGO_FALLIDO] || 0))} icon="⚠️" color="var(--color-accent-danger)" subtext="Plazo vencido · Pago fallido" onClick={() => navigate('/admin/alumnos')} />
          </>
        )}
      </KPIGrid>

      {/* Stats informativas (no navegables) */}
      {stats && (
        <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          <StatCard
            label={t('dashboard.conversion')}
            value={`${conversionPct}% pagados`}
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
      <div className="grid-2col">
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
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                <XAxis type="number" tick={{ fill: chartTheme.tickFill, fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={130} tick={{ fill: chartTheme.tickFill, fontSize: 11 }} />
                <Tooltip contentStyle={{ background: chartTheme.tooltipBg, border: chartTheme.tooltipBorder, borderRadius: 8 }} labelStyle={{ color: chartTheme.tooltipLabel }} itemStyle={{ color: chartTheme.tooltipLabel }} formatter={(v: unknown) => [String(v ?? ''), 'Alumnos']} />
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
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                <XAxis dataKey="mes" tick={{ fill: chartTheme.tickFill, fontSize: 12 }} />
                <YAxis tick={{ fill: chartTheme.tickFill, fontSize: 12 }} />
                <Tooltip contentStyle={{ background: chartTheme.tooltipBg, border: chartTheme.tooltipBorder, borderRadius: 8 }} formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Total']} />
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
        actions={
          <span
            title="Últimas 15 acciones del audit trail del sistema. No está filtrado por la edición seleccionada."
            aria-label="Información sobre Actividad Reciente"
            style={{ cursor: 'help', color: 'var(--color-text-muted)', fontSize: '1rem', lineHeight: 1 }}
          >
            ℹ️
          </span>
        }
      />
    </div>
  );
}
