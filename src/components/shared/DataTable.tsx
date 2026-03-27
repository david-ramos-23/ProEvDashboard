import { ReactNode, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { DropdownMenu } from './DropdownMenu';
import styles from './Shared.module.css';

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
  const colMenuBtnRef = useRef<HTMLButtonElement>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
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
  const isMobile = useIsMobile();

  const renderMobileCards = () => (
    <div className={styles.mobileCardList}>
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={`skeleton-${i}`} className={styles.mobileCard}>
            {visibleColumns.slice(0, 3).map((col) => (
              <div key={col.key} className={styles.mobileCardField}>
                <div className={styles.skeletonCell} style={{ width: '30%', height: '12px' }} />
                <div className={styles.skeletonCell} style={{ width: '50%', height: '14px' }} />
              </div>
            ))}
          </div>
        ))
      ) : sortedData.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>{emptyIcon}</div>
          <div className={styles.emptyText}>{emptyMessage}</div>
        </div>
      ) : (
        sortedData.map((item, idx) => (
          <div
            key={item.id}
            data-row-id={item.id}
            className={`${styles.mobileCard} ${onRowClick ? styles.mobileCardClickable : ''} ${styles.rowEnter}`}
            style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            onClick={() => onRowClick?.(item)}
          >
            {visibleColumns.map((col) => (
              <div key={col.key} className={styles.mobileCardField}>
                <span className={styles.mobileCardLabel}>{col.header}</span>
                <span className={styles.mobileCardValue}>
                  {col.render
                    ? col.render(item)
                    : String((item as Record<string, unknown>)[col.key] ?? '—')}
                </span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div ref={tableWrapperRef} className={styles.tableWrapper}>
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
          {!isMobile && hasHideableColumns && (
            <>
              <button
                ref={colMenuBtnRef}
                type="button"
                className={`${styles.colMenuBtn} ${colMenuOpen ? styles.colMenuBtnActive : ''}`}
                onClick={() => setColMenuOpen(p => !p)}
                title="Configurar columnas"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18" />
                  <path d="M3 9h18M3 15h18" />
                </svg>
                <span style={{ fontSize: '0.7rem' }}>Columnas</span>
              </button>
              <DropdownMenu open={colMenuOpen} onClose={() => setColMenuOpen(false)} triggerRef={colMenuBtnRef} alignRef={tableWrapperRef} width={180}>
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
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {isMobile ? renderMobileCards() : (
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
                    data-row-id={item.id}
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
      )}
    </div>
  );
}
