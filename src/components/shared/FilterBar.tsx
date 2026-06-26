import { type ReactNode } from 'react';
import styles from './Shared.module.css';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  /** Grupos de filtros de tipo botón segmentado */
  filters?: Array<{
    options: FilterOption[];
    value: string;
    onChange: (value: string) => void;
  }>;
  /** Conteo de resultados mostrado a la derecha */
  count?: number;
  countLabel?: string;
  /** Mostrar botón "Limpiar" */
  onClear?: () => void;
  /** Contenido adicional (búsqueda personalizada, etc.) */
  children?: ReactNode;
}

/** Barra de filtros estándar: botones segmentados + conteo + limpiar */
export function FilterBar({ filters, count, countLabel = 'resultados', onClear, children }: FilterBarProps) {
  return (
    <div className={styles.filterBar}>
      {filters?.map((group, i) => (
        <div key={i} className={styles.filterGroup}>
          {group.options.map(opt => (
            <button
              key={opt.value}
              className={`${styles.filterBtn} ${group.value === opt.value ? styles.filterBtnActive : ''}`}
              onClick={() => group.onChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ))}
      {children}
      <div className={styles.filterSpacer} />
      {count !== undefined && (
        <span className={styles.filterCount}>{count} {countLabel}</span>
      )}
      {onClear && (
        <button className={styles.filterClear} onClick={onClear}>
          Limpiar
        </button>
      )}
    </div>
  );
}
