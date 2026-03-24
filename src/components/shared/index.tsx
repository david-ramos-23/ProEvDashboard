/**
 * Componentes UI compartidos del Dashboard ProEv.
 * KPICard, StatusBadge, DataTable, y Loading.
 */

import { ReactNode, memo, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ESTADO_COLORS, ESTADO_ICONS, REVISION_COLORS, PAGO_COLORS, EMAIL_COLORS } from '@/utils/constants';
import { EstadoGeneral, EstadoRevision, EstadoPago, EstadoEmail } from '@/types';
import styles from './Shared.module.css';

// ============================================================
// Animated count-up hook
// ============================================================

/**
 * Animates a number from 0 to target with ease-out cubic.
 */
function useCountUp(target: number, decimals: number, duration = 900): number {
  const [display, setDisplay] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (target === 0) { setDisplay(0); return; }

    const t0 = performance.now();
    const animate = () => {
      const elapsed = performance.now() - t0;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = target * eased;
      setDisplay(decimals > 0 ? parseFloat(val.toFixed(decimals)) : Math.round(val));
      if (p < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target, decimals, duration]);

  return display;
}

/**
 * Parses a formatted value string and returns the numeric value,
 * decimal count, and a re-formatter function.
 *
 * Supports es-ES locale (20.000,00 €) and en-US locale ($20,000.00).
 */
function parseFormattedValue(value: string | number): {
  num: number;
  decimals: number;
  format: (n: number) => string;
} | null {
  const str = String(value);
  if (str === '—' || str === '0') return null;

  // Split into prefix (non-digit), numeric part, suffix
  const m = str.match(/^([^0-9]*?)([\d.,]+)(.*)$/);
  if (!m) return null;

  const [, prefix, numStr, suffix] = m;

  // Detect comma-decimal format: "200,00" or "20.000,00" (es-ES locale)
  const hasCommaDecimal = /,\d{1,2}$/.test(numStr);
  // Detect dot-decimal format: "200.00" or "20,000.00" (en-US locale)
  const hasDotDecimal = /\.\d{1,2}$/.test(numStr) && !hasCommaDecimal;

  let num: number;
  let decimals = 0;
  let localeFormat: 'es' | 'en' = 'es';

  if (hasCommaDecimal) {
    // es-ES: "200,00" or "20.000,00" → comma is decimal separator
    const commaIdx = numStr.lastIndexOf(',');
    decimals = numStr.length - commaIdx - 1;
    num = parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
    localeFormat = 'es';
  } else if (hasDotDecimal) {
    // en-US: "200.00" or "20,000.00" → dot is decimal separator
    const dotIdx = numStr.lastIndexOf('.');
    decimals = numStr.length - dotIdx - 1;
    num = parseFloat(numStr.replace(/,/g, ''));
    localeFormat = 'en';
  } else {
    // Plain integer: detect separator type by context
    // "1.234" (es-ES thousands) vs "1,234" (en-US thousands)
    num = parseInt(numStr.replace(/[.,]/g, ''), 10);
    localeFormat = numStr.includes('.') ? 'es' : 'en';
  }

  if (isNaN(num)) return null;

  const locale = localeFormat === 'es' ? 'es-ES' : 'en-US';
  const format = (n: number) => {
    const formatted = decimals > 0
      ? n.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : n.toLocaleString(locale);
    return prefix + formatted + suffix;
  };

  return { num, decimals, format };
}

function AnimatedValue({ value }: { value: string | number }) {
  const parsed = parseFormattedValue(value);
  const animatedNum = useCountUp(parsed?.num ?? 0, parsed?.decimals ?? 0);

  if (!parsed) return <>{value}</>;
  return <>{parsed.format(animatedNum)}</>;
}

// ============================================================
// KPI Card
// ============================================================

interface KPICardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  subtext?: string;
  onClick?: () => void;
}

/** Tarjeta de métrica con glassmorphism y acento de color superior */
export const KPICard = memo(function KPICard({ label, value, icon, color = 'var(--color-accent-primary)', subtext, onClick }: KPICardProps) {
  return (
    <div
      className={`${styles.kpiCard} ${onClick ? styles.kpiCardClickable : ''}`}
      style={{ '--kpi-accent': color } as React.CSSProperties}
      onClick={onClick}
    >
      <div className={styles.kpiHeader}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiIcon}>
          {onClick ? <span className={styles.kpiArrow}>→</span> : icon}
        </span>
      </div>
      <div className={styles.kpiValue} style={{ color }}><AnimatedValue value={value} /></div>
      {subtext && <div className={styles.kpiSubtext}>{subtext}</div>}
    </div>
  );
});

/** Tarjeta de estadística no navegable — sin acento, sin hover */
export function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statIcon}>{icon}</span>
      <div>
        <div className={styles.statValue}><AnimatedValue value={value} /></div>
        <div className={styles.statLabel}>{label}</div>
      </div>
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
export const StatusBadge = memo(function StatusBadge({ status, type = 'estado', showIcon = false }: StatusBadgeProps) {
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
});

// ============================================================
// Data Table
// ============================================================

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  width?: string;
  minWidth?: number;
  sortable?: boolean;
  hideable?: boolean;
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
  tableId?: string;
}

type SortDir = 'asc' | 'desc';

// Precomputed skeleton widths to avoid Math.random() in render
const SKELETON_WIDTHS = Array.from({ length: 30 }, () => `${60 + Math.random() * 40}%`);

function comparePrimitive(a: unknown, b: unknown, dir: SortDir): number {
  const aVal = a ?? '';
  const bVal = b ?? '';
  let cmp = 0;
  if (typeof aVal === 'number' && typeof bVal === 'number') {
    cmp = aVal - bVal;
  } else {
    cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
  }
  return dir === 'asc' ? cmp : -cmp;
}

interface TablePrefs {
  hiddenCols?: string[];
  colWidths?: Record<string, number>;
}

function loadTablePrefs(tableId: string): TablePrefs {
  try {
    const raw = localStorage.getItem(`proev_table_${tableId}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveTablePrefs(tableId: string, prefs: TablePrefs) {
  try { localStorage.setItem(`proev_table_${tableId}`, JSON.stringify(prefs)); } catch { /* noop */ }
}

/** Tabla de datos con búsqueda, sorting, columnas configurables, y filas clickeables */
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
  tableId,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    if (!tableId) return new Set();
    return new Set(loadTablePrefs(tableId).hiddenCols ?? []);
  });
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (!tableId) return {};
    return loadTablePrefs(tableId).colWidths ?? {};
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const didResizeRef = useRef(false);

  // Persist prefs
  useEffect(() => {
    if (!tableId) return;
    saveTablePrefs(tableId, {
      hiddenCols: [...hiddenCols],
      colWidths,
    });
  }, [tableId, hiddenCols, colWidths]);

  // Close column menu on outside click
  useEffect(() => {
    if (!colMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colMenuOpen]);

  function handleSort(key: string) {
    if (didResizeRef.current) { didResizeRef.current = false; return; }
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function toggleCol(key: string) {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        // Don't allow hiding all columns — keep at least one visible
        const hideableCount = columns.filter(c => c.header && c.hideable !== false).length;
        if (next.size + 1 >= hideableCount) return prev;
        next.add(key);
      }
      return next;
    });
  }

  const visibleColumns = useMemo(
    () => columns.filter(c => !hiddenCols.has(c.key)),
    [columns, hiddenCols]
  );

  const handleResizeStart = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    didResizeRef.current = true;

    // Snapshot all column widths from DOM before any state change
    const table = tableRef.current;
    if (!table) return;
    const ths = table.querySelectorAll('thead th');
    const snapshot: Record<string, number> = {};
    let startW = 0;
    ths.forEach((th, i) => {
      const colKey = visibleColumns[i]?.key;
      if (colKey) {
        const w = th.getBoundingClientRect().width;
        snapshot[colKey] = w;
        if (colKey === key) startW = w;
      }
    });

    const startX = e.clientX;
    resizingRef.current = { key, startX, startW };

    // Apply snapshot so tableLayout: fixed kicks in with correct widths
    setColWidths(snapshot);

    const col = visibleColumns.find(c => c.key === key);
    const minW = col?.minWidth ?? 60;

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - startX;
      const newW = Math.max(startW + delta, minW);
      setColWidths(prev => ({ ...prev, [key]: newW }));
    };
    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setTimeout(() => { didResizeRef.current = false; }, 50);
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [visibleColumns]);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) =>
      comparePrimitive(
        (a as Record<string, unknown>)[sortKey],
        (b as Record<string, unknown>)[sortKey],
        sortDir,
      )
    );
  }, [data, sortKey, sortDir]);

  const hasHideableColumns = columns.some(c => c.hideable !== false && c.header);

  return (
    <div className={styles.tableWrapper}>
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
          {hasHideableColumns && (
            <div ref={colMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className={styles.colMenuBtn}
                onClick={() => setColMenuOpen(p => !p)}
                title="Configurar columnas"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18" />
                  <path d="M3 9h18M3 15h18" />
                </svg>
                <span style={{ fontSize: '0.7rem' }}>Columnas</span>
              </button>
              {colMenuOpen && (
                <div className={styles.colMenuDropdown}>
                  <div className={styles.colMenuHeader}>
                    <span>Columnas visibles</span>
                    {hiddenCols.size > 0 && (
                      <button
                        className={styles.colMenuReset}
                        onClick={() => { setHiddenCols(new Set()); setColWidths({}); }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  {columns.filter(c => c.header && c.hideable !== false).map(c => (
                    <label key={c.key} className={styles.colMenuItem}>
                      <input
                        type="checkbox"
                        checked={!hiddenCols.has(c.key)}
                        onChange={() => toggleCol(c.key)}
                      />
                      <span>{c.header}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table ref={tableRef} className={styles.table} style={{ tableLayout: Object.keys(colWidths).length > 0 ? 'fixed' : undefined }}>
          <thead>
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: colWidths[col.key] ? `${colWidths[col.key]}px` : col.width, position: 'relative', minWidth: col.minWidth ?? 60 }}
                  className={col.sortable ? styles.sortableHeader : undefined}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  {col.header}
                  {col.sortable && (
                    <span className={styles.sortIcon}>
                      {sortKey === col.key ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : ' \u2195'}
                    </span>
                  )}
                  <span
                    className={styles.resizeHandle}
                    onMouseDown={(e) => handleResizeStart(col.key, e)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {visibleColumns.map((col, j) => (
                    <td key={col.key}>
                      <div className={styles.skeletonCell} style={{ width: SKELETON_WIDTHS[(i * visibleColumns.length + j) % SKELETON_WIDTHS.length] }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length}>
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>{emptyIcon}</div>
                    <div className={styles.emptyText}>{emptyMessage}</div>
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`${onRowClick ? styles.clickableRow : ''} ${styles.rowEnter}`}
                  style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                  onClick={() => onRowClick?.(item)}
                >
                  {visibleColumns.map((col) => (
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
// Dropdown Menu (portal-based, viewport-aware)
// ============================================================

interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
  width?: number;
}

export function DropdownMenu({ open, onClose, triggerRef, children, width = 240 }: DropdownMenuProps) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    // Align right edge of dropdown with right edge of trigger
    let left = rect.right - width;
    // If it goes off the left edge, push right
    if (left < 8) left = 8;
    // If it goes off the right edge, push left
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    setPos({ top: rect.bottom + 6 + window.scrollY, left });
  }, [open, triggerRef, width]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div ref={dropRef} className={styles.dropdownPortal} style={{ top: pos.top, left: pos.left, width }}>
      {children}
    </div>,
    document.body
  );
}

// ============================================================
// Confirm Dialog
// ============================================================

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'success' | 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  success: { background: 'var(--color-accent-success, #16a34a)', color: '#fff' },
  danger: { background: 'var(--color-accent-danger, #dc2626)', color: '#fff' },
  warning: { background: 'var(--color-accent-warning, #f59e0b)', color: '#fff' },
};

export function ConfirmDialog({
  open,
  title,
  message,
  icon,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'success',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className={styles.confirmOverlay} onClick={onCancel}>
      <div
        className={styles.confirmPanel}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        {icon && <div className={styles.confirmIcon}>{icon}</div>}
        <div className={styles.confirmTitle} id="confirm-title">{title}</div>
        {message && <div className={styles.confirmMessage} id="confirm-message">{message}</div>}
        <div className={styles.confirmActions}>
          <button className={styles.confirmCancel} onClick={onCancel}>{cancelLabel}</button>
          <button
            className={styles.confirmOk}
            style={VARIANT_STYLES[variant]}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
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

// ============================================================
// Scroll To Top
// ============================================================

/** Fixed scroll-to-top button, visible after 400px scroll */
export function ScrollToTop({ aiOpen = false }: { aiOpen?: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      className={styles.scrollTop}
      style={{ right: aiOpen ? 388 : 28, transition: 'right 300ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Volver arriba"
      title="Volver arriba"
    >
      ↑
    </button>
  );
}
