/**
 * Portal de Pagos — KPIs financieros + tabla de pagos filtrable.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KPICard, KPIGrid, KPICardSkeleton, DataTable, StatusBadge, Column } from '@/components/shared';
import { fetchPagos, fetchPagoStats } from '@/data/adapters/airtable/PagosAdapter';
import { Pago, EstadoPago } from '@/types';
import { formatCurrency, formatDate, formatNumber } from '@/utils/formatters';
import { useTranslation } from '@/i18n';

const ESTADOS_PAGO: EstadoPago[] = ['Pendiente', 'Pagado', 'Fallido', 'Reembolsado'];

export default function PagosPage() {
  const { t } = useTranslation();
  const [filtroEstado, setFiltroEstado] = useState<EstadoPago | ''>('');

  const { data: pagos = [], isLoading } = useQuery({
    queryKey: ['pagos', { estado: filtroEstado || undefined }],
    queryFn: () => fetchPagos({ estado: filtroEstado || undefined }),
  });
  const { data: stats } = useQuery({
    queryKey: ['pago-stats'],
    queryFn: fetchPagoStats,
  });

  const columns = useMemo<Column<Pago>[]>(() => [
    {
      key: 'alumnoNombre', header: t('alumnos.alumno'), width: '180px',
      render: (p) => <span style={{ fontWeight: 500 }}>{p.alumnoNombre || '—'}</span>,
    },
    {
      key: 'importe', header: t('pagos.importe'), width: '120px',
      render: (p) => <span style={{ fontWeight: 600 }}>{formatCurrency(p.importe, p.moneda)}</span>,
    },
    {
      key: 'estadoPago', header: t('alumnos.estado'), width: '130px',
      render: (p) => <StatusBadge status={p.estadoPago} type="pago" />,
    },
    {
      key: 'fechaPago', header: t('pagos.fecha'), width: '120px',
      render: (p) => <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>{formatDate(p.fechaPago)}</span>,
    },
    {
      key: 'linkRecibo', header: 'Recibo', width: '80px',
      render: (p) => p.linkRecibo ? (
        <a href={p.linkRecibo} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem' }}>Ver →</a>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>,
    },
  ], []);

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* KPIs */}
      <KPIGrid columns={4}>
        {!stats ? (
          Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard label={t('pagos.totalRecaudado')} value={formatCurrency(stats.totalRecaudado)} icon="💰" color="var(--color-accent-success)" />
            <KPICard label={t('pagos.pagosCompletados')} value={formatNumber(stats.pagosCompletados)} icon="✅" color="var(--color-accent-info)" />
            <KPICard label={t('pagos.pagosFallidos')} value={formatNumber(stats.pagosFallidos)} icon="⚠️" color="var(--color-accent-danger)" />
            <KPICard label={t('pagos.reembolsados')} value={formatNumber(stats.pagosReembolsados)} icon="↩️" color="var(--color-accent-warning)" />
          </>
        )}
      </KPIGrid>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <button className={`btn-sm ${!filtroEstado ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltroEstado('')}>Todos</button>
        {ESTADOS_PAGO.map(est => (
          <button key={est} className={`btn-sm ${filtroEstado === est ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltroEstado(est === filtroEstado ? '' : est)}>
            {est}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <DataTable title={t('nav.pagos')} columns={columns} data={pagos} isLoading={isLoading} emptyMessage={t('pagos.sinPagos')} emptyIcon="💳" />
    </div>
  );
}
