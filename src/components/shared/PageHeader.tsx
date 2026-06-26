import { type ReactNode } from 'react';
import styles from './Shared.module.css';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  count?: number;
  actions?: ReactNode;
}

/** Cabecera estándar de página: título, conteo opcional, subtítulo y acciones */
export function PageHeader({ title, subtitle, count, actions }: PageHeaderProps) {
  return (
    <div className={styles.pageHeader}>
      <div className={styles.pageHeaderText}>
        <h1 className={styles.pageHeaderTitle}>
          {title}
          {count !== undefined && (
            <span className={styles.pageHeaderCount}>({count})</span>
          )}
        </h1>
        {subtitle && <p className={styles.pageHeaderSubtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.pageHeaderActions}>{actions}</div>}
    </div>
  );
}
