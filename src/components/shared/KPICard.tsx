import { memo, type ReactNode } from 'react';
import { AnimatedValue } from './AnimatedValue';
import styles from './Shared.module.css';

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

interface KPIGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

/** Grid responsive para KPIs */
export function KPIGrid({ children, columns = 4, className }: KPIGridProps) {
  const colsClass = {
    2: styles.cols2,
    3: styles.cols3,
    4: styles.cols4,
    5: styles.cols5,
  }[columns];

  return <div className={`${styles.grid} ${colsClass} ${className || ''}`}>{children}</div>;
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
