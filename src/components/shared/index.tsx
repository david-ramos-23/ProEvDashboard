/**
 * Componentes UI compartidos del Dashboard ProEv.
 * KPICard, StatusBadge, DataTable, y Loading.
 */

import { ReactNode } from 'react';
import { ESTADO_COLORS, ESTADO_ICONS, REVISION_COLORS, PAGO_COLORS, EMAIL_COLORS } from '@/utils/constants';
import { EstadoGeneral, EstadoRevision, EstadoPago, EstadoEmail } from '@/types';
import styles from './Shared.module.css';

// ============================================================
// KPI Card
// ============================================================

interface KPICardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  subtext?: string;
}

/** Tarjeta de métrica con glassmorphism y acento de color superior */
export function KPICard({ label, value, icon, color = 'var(--color-accent-primary)', subtext }: KPICardProps) {
  return (
    <div className={styles.kpiCard} style={{ '--kpi-accent': color } as React.CSSProperties}>
      <div className={styles.kpiHeader}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiIcon}>{icon}</span>
      </div>
      <div className={styles.kpiValue} style={{ color }}>{value}</div>
      {subtext && <div className={styles.kpiSubtext}>{subtext}</div>}
    </div>
  );
}

// ============================================================
// KPI Grid
// ============================================================

interface KPIGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5;
}

/** Grid responsive para KPIs */
export function KPIGrid({ children, columns = 4 }: KPIGridProps) {
  const colsClass = {
    2: styles.cols2,
    3: styles.cols3,
    4: styles.cols4,
    5: styles.cols5,
  }[columns];

  return <div className={`${styles.grid} ${colsClass}`}>{children}</div>;
}

// ============================================================
// Status Badge
// ============================================================

type StatusType = 'estado' | 'revision' | 'pago' | 'email';

interface StatusBadgeProps {
  status: string;
  type?: StatusType;
  showIcon?: boolean;
}

function getStatusColor(status: string, type: StatusType): string {
  switch (type) {
    case 'estado': return ESTADO_COLORS[status as EstadoGeneral] || 'var(--color-text-muted)';
    case 'revision': return REVISION_COLORS[status as EstadoRevision] || 'var(--color-text-muted)';
    case 'pago': return PAGO_COLORS[status as EstadoPago] || 'var(--color-text-muted)';
    case 'email': return EMAIL_COLORS[status as EstadoEmail] || 'var(--color-text-muted)';
    default: return 'var(--color-text-muted)';
  }
}

/** Badge de estado con dot de color y texto */
export function StatusBadge({ status, type = 'estado', showIcon = false }: StatusBadgeProps) {
  const color = getStatusColor(status, type);
  const icon = type === 'estado' ? ESTADO_ICONS[status as EstadoGeneral] : undefined;

  return (
    <span
      className={styles.badge}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      {showIcon && icon ? <span>{icon}</span> : <span className={styles.badgeDot} style={{ background: color }} />}
      {status}
    </span>
  );
}

// ============================================================
// Data Table
// ============================================================

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  title?: string;
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptyIcon?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  actions?: ReactNode;
}

// Precomputed skeleton widths to avoid Math.random() in render
const SKELETON_WIDTHS = Array.from({ length: 30 }, () => `${60 + Math.random() * 40}%`);

/** Tabla de datos con búsqueda, loading skeleton, y filas clickeables */
export function DataTable<T extends { id: string }>({
  title,
  columns,
  data,
  isLoading = false,
  onRowClick,
  emptyMessage = 'No hay datos',
  emptyIcon = '📭',
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  actions,
}: DataTableProps<T>) {
  return (
    <div className={styles.tableWrapper}>
      {(title || onSearchChange || actions) && (
        <div className={styles.tableHeader}>
          {title && <h3 className={styles.tableTitle}>{title}</h3>}
          <div className={styles.tableActions}>
            {onSearchChange && (
              <input
                type="text"
                className={styles.searchInput}
                placeholder={searchPlaceholder}
                value={searchValue || ''}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            )}
            {actions}
          </div>
        </div>
      )}

      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            // Skeleton loading
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`}>
                {columns.map((col, j) => (
                  <td key={col.key}>
                    <div className={styles.skeletonCell} style={{ width: SKELETON_WIDTHS[(i * columns.length + j) % SKELETON_WIDTHS.length] }} />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>{emptyIcon}</div>
                  <div className={styles.emptyText}>{emptyMessage}</div>
                </div>
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={item.id}
                className={onRowClick ? styles.clickableRow : ''}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render
                      ? col.render(item)
                      : String((item as Record<string, unknown>)[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Skeleton components
// ============================================================

interface SkeletonBlockProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}

/** Generic shimmer block for skeleton layouts */
export function SkeletonBlock({ width = '100%', height = '16px', borderRadius = 'var(--radius-sm)', style }: SkeletonBlockProps) {
  return (
    <div
      className={styles.skeletonCell}
      style={{ width, height, borderRadius, flexShrink: 0, ...style }}
    />
  );
}

/** Skeleton that mimics a KPICard */
export function KPICardSkeleton() {
  return (
    <div className={styles.kpiCard} style={{ '--kpi-accent': 'rgba(255,255,255,0.06)' } as React.CSSProperties}>
      <div className={styles.kpiHeader}>
        <div className={styles.skeletonCell} style={{ width: '55%', height: '13px' }} />
        <div className={styles.skeletonCell} style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
      </div>
      <div className={styles.skeletonCell} style={{ width: '45%', height: '32px', margin: '10px 0 6px' }} />
      <div className={styles.skeletonCell} style={{ width: '38%', height: '11px' }} />
    </div>
  );
}

// ============================================================
// Loading spinner
// ============================================================

export function LoadingSpinner({ text = 'Cargando...' }: { text?: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-3xl)',
      gap: 'var(--space-md)',
      color: 'var(--color-text-muted)',
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid var(--color-border)',
        borderTopColor: 'var(--color-accent-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span>{text}</span>
    </div>
  );
}
