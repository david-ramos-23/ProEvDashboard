/**
 * Portal de Pagos — KPIs financieros + tabla de pagos filtrable.
 */

import { useState, useEffect } from 'react';
import { KPICard, KPIGrid, DataTable, StatusBadge, LoadingSpinner, Column } from '@/components/shared';
import { fetchPagos, fetchPagoStats } from '@/data/adapters/airtable/PagosAdapter';
import { Pago, PagoStats, EstadoPago } from '@/types';
import { formatCurrency, formatDate, formatNumber } from '@/utils/formatters';

const ESTADOS_PAGO: EstadoPago[] = ['Pendiente', 'Pagado', 'Fallido', 'Reembolsado'];

export default function PagosPage() {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [stats, setStats] = useState<PagoStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<EstadoPago | ''>('');

  useEffect(() => {
    loadData();
  }, [filtroEstado]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [p, s] = await Promise.all([
        fetchPagos({ estado: filtroEstado || undefined }),
        fetchPagoStats(),
      ]);
      setPagos(p);
      setStats(s);
    } catch (err) {
      console.error('Error cargando pagos:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const columns: Column<Pago>[] = [
    {
      key: 'alumnoNombre', header: 'Alumno', width: '180px',
      render: (p) => <span style={{ fontWeight: 500 }}>{p.alumnoNombre || '—'}</span>,
    },
    {
      key: 'importe', header: 'Importe', width: '120px',
      render: (p) => <span style={{ fontWeight: 600 }}>{formatCurrency(p.importe, p.moneda)}</span>,
    },
    {
      key: 'estadoPago', header: 'Estado', width: '130px',
      render: (p) => <StatusBadge status={p.estadoPago} type="pago" />,
    },
    {
      key: 'fechaPago', header: 'Fecha', width: '120px',
      render: (p) => <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>{formatDate(p.fechaPago)}</span>,
    },
    {
      key: 'linkRecibo', header: 'Recibo', width: '80px',
      render: (p) => p.linkRecibo ? (
        <a href={p.linkRecibo} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem' }}>Ver →</a>
      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>,
    },
  ];

  if (isLoading && !stats) return <LoadingSpinner text="Cargando pagos..." />;

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* KPIs */}
      {stats && (
        <KPIGrid columns={4}>
          <KPICard label="Total Recaudado" value={formatCurrency(stats.totalRecaudado)} icon="💰" color="var(--color-accent-success)" />
          <KPICard label="Pagos Completados" value={formatNumber(stats.pagosCompletados)} icon="✅" color="var(--color-accent-info)" />
          <KPICard label="Pagos Fallidos" value={formatNumber(stats.pagosFallidos)} icon="⚠️" color="var(--color-accent-danger)" />
          <KPICard label="Reembolsados" value={formatNumber(stats.pagosReembolsados)} icon="↩️" color="var(--color-accent-warning)" />
        </KPIGrid>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <button className={`btn-ghost btn-sm ${!filtroEstado ? 'btn-primary' : ''}`} onClick={() => setFiltroEstado('')}>Todos</button>
        {ESTADOS_PAGO.map(est => (
          <button key={est} className={`btn-ghost btn-sm ${filtroEstado === est ? 'btn-primary' : ''}`} onClick={() => setFiltroEstado(est === filtroEstado ? '' : est)}>
            {est}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <DataTable title="Pagos" columns={columns} data={pagos} isLoading={isLoading} emptyMessage="Sin pagos registrados" emptyIcon="💳" />
    </div>
  );
}
