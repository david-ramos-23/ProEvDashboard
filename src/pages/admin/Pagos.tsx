/**
 * Portal de Pagos — KPIs financieros + tabla de pagos filtrable.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KPICard, KPIGrid, KPICardSkeleton, DataTable, StatusBadge, Column } from '@/components/shared';
import { fetchPagos } from '@/data/adapters';
import { Pago, EstadoPago } from '@/types';
import { formatCurrency, formatDate, formatNumber } from '@/utils/formatters';
import { useTranslation } from '@/i18n';
import { ESTADO_PAGO } from '@/utils/constants';
import { useEdicion } from '@/context/EdicionContext';
import { resolveEdicionByDate } from '@/lib/resolveEdicion';

const ESTADOS_PAGO: EstadoPago[] = [
  ESTADO_PAGO.PENDIENTE, ESTADO_PAGO.PAGADO, ESTADO_PAGO.FALLIDO, ESTADO_PAGO.REEMBOLSADO,
];

export default function PagosPage() {
  const { t } = useTranslation();
  const { selectedNombre, ediciones } = useEdicion();
  const [filtroEstado, setFiltroEstado] = useState<EstadoPago | ''>('');

  const { data: pagos = [], isLoading } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => fetchPagos({}),
  });

  // Infer each payment's edition by date window; then filter client-side.
  // This avoids leaking payments of multi-edition alumnos across editions.
  const pagosEdicion = useMemo(() => {
    if (!selectedNombre) return pagos;
    // null date (Pendiente sin fecha) → edition can't be inferred → show in all editions
    return pagos.filter(p => {
      const ed = resolveEdicionByDate(p.fechaPago, ediciones);
      return ed === selectedNombre || !p.fechaPago;
    });
  }, [pagos, ediciones, selectedNombre]);
  const stats = useMemo(() => ({
    totalRecaudado: pagosEdicion.filter(p => p.estadoPago === 'Pagado').reduce((s, p) => s + (p.importe || 0), 0),
    pagosCompletados: pagosEdicion.filter(p => p.estadoPago === 'Pagado').length,
    pagosFallidos: pagosEdicion.filter(p => p.estadoPago === 'Fallido').length,
    pagosReembolsados: pagosEdicion.filter(p => p.estadoPago === 'Reembolsado').length,
  }), [pagosEdicion]);
  const pagosFiltrados = useMemo(() => (
    filtroEstado ? pagosEdicion.filter(p => p.estadoPago === filtroEstado) : pagosEdicion
  ), [pagosEdicion, filtroEstado]);

  const columns = useMemo<Column<Pago>[]>(() => [
    {
      key: 'alumnoNombre', header: t('alumnos.alumno'), width: '180px', sortable: true, minWidth: 120,
      render: (p) => <span style={{ fontWeight: 500 }}>{p.alumnoNombre || '—'}</span>,
    },
    {
      key: 'id', header: 'Edición', width: '140px', minWidth: 100,
      render: (p) => {
        const nombre = resolveEdicionByDate(p.fechaPago, ediciones);
        return <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>{nombre ?? '—'}</span>;
      },
    },
    {
      key: 'importe', header: t('pagos.importe'), width: '120px', sortable: true, minWidth: 80,
      render: (p) => <span style={{ fontWeight: 600 }}>{formatCurrency(p.importe, p.moneda)}</span>,
    },
    {
      key: 'estadoPago', header: t('alumnos.estado'), width: '130px', sortable: true, minWidth: 90,
      render: (p) => <StatusBadge status={p.estadoPago} type="pago" />,
    },
    {
      key: 'fechaPago', header: t('pagos.fecha'), width: '120px', sortable: true, minWidth: 90,
      render: (p) => <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>{formatDate(p.fechaPago)}</span>,
    },
    {
      key: 'linkRecibo', header: 'Recibo', width: '80px',
      render: (p) => p.linkRecibo ? (
        <a href={p.linkRecibo} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem' }}>Ver →</a>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>,
    },
  ], [t, ediciones]);

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* KPIs */}
      <KPIGrid columns={4}>
        {isLoading ? (
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
      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
        {ESTADOS_PAGO.map(est => (
          <button key={est} className={`btn-sm ${filtroEstado === est ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltroEstado(est === filtroEstado ? '' : est)}>
            {est}
          </button>
        ))}
        {filtroEstado && (
          <button
            className="btn-sm btn-ghost"
            onClick={() => setFiltroEstado('')}
            style={{ color: 'var(--color-accent-danger)', borderColor: 'rgba(220,38,38,0.2)' }}
          >
            Limpiar filtro
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          {pagosFiltrados.length} pago{pagosFiltrados.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla */}
      <DataTable tableId="pagos" title={t('nav.pagos')} columns={columns} data={pagosFiltrados} isLoading={isLoading} emptyMessage={t('pagos.sinPagos')} emptyIcon="💳" />
    </div>
  );
}
