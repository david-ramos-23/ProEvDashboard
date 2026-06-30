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
import { resolveEdicionByDate, pagosDeEdicion } from '@/lib/resolveEdicion';

const ESTADOS_PAGO: EstadoPago[] = [
  ESTADO_PAGO.PENDIENTE, ESTADO_PAGO.PAGADO, ESTADO_PAGO.FALLIDO, ESTADO_PAGO.REEMBOLSADO,
];

export default function PagosPage() {
  const { t } = useTranslation();
  const { selectedNombre, ediciones } = useEdicion();
  const [filtrosEstado, setFiltrosEstado] = useState<Set<EstadoPago>>(new Set());
  const [busqueda, setBusqueda] = useState('');

  const { data: pagos = [], isLoading, isError } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => fetchPagos({}),
  });

  // Filter payments to the selected edition using date-window inference.
  // Payments without a date are excluded from specific editions (shown only in all-editions view).
  const pagosEdicion = useMemo(
    () => pagosDeEdicion(pagos, ediciones, selectedNombre),
    [pagos, ediciones, selectedNombre],
  );
  const stats = useMemo(() => ({
    totalRecaudado: pagosEdicion.filter(p => p.estadoPago === 'Pagado').reduce((s, p) => s + (p.importe || 0), 0),
    pagosCompletados: pagosEdicion.filter(p => p.estadoPago === 'Pagado').length,
    pagosFallidos: pagosEdicion.filter(p => p.estadoPago === 'Fallido').length,
    pagosReembolsados: pagosEdicion.filter(p => p.estadoPago === 'Reembolsado').length,
  }), [pagosEdicion]);
  const pagosFiltrados = useMemo(() => {
    let result = filtrosEstado.size > 0
      ? pagosEdicion.filter(p => filtrosEstado.has(p.estadoPago as EstadoPago))
      : pagosEdicion;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      result = result.filter(p =>
        String(p.alumnoNombre ?? '').toLowerCase().includes(q) ||
        String(p.mesPago ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [pagosEdicion, filtrosEstado, busqueda]);

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
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', flex: 1, minHeight: 0 }}>
      {isError && (
        <div role="alert" style={{ padding: "var(--space-md)", background: "color-mix(in srgb, var(--color-accent-danger) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--color-accent-danger) 30%, transparent)", borderRadius: "var(--radius-md)", color: "var(--color-accent-danger)", fontSize: "var(--font-size-sm)", marginBottom: "var(--space-md)" }}>
          Error al cargar los pagos. Comprueba tu conexion e intentalo de nuevo.
        </div>
      )}
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
          <button
            key={est}
            className={`btn-sm ${filtrosEstado.has(est) ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFiltrosEstado(prev => {
              const next = new Set(prev);
              next.has(est) ? next.delete(est) : next.add(est);
              return next;
            })}
          >
            {est}
          </button>
        ))}
        {filtrosEstado.size > 0 && (
          <button
            className="btn-sm btn-ghost"
            onClick={() => setFiltrosEstado(new Set())}
            style={{ color: 'var(--color-accent-danger)', borderColor: 'rgba(220,38,38,0.2)' }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <DataTable
        tableId="pagos"
        columns={columns}
        data={pagosFiltrados}
        isLoading={isLoading}
        emptyMessage={t('pagos.sinPagos')}
        emptyIcon="💳"
        searchValue={busqueda}
        onSearchChange={setBusqueda}
        searchPlaceholder={t('alumnos.searchPlaceholder')}
        countLabel={(n) => `${n} pago${n !== 1 ? 's' : ''}`}
        fill
      />
    </div>
  );
}
