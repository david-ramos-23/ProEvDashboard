import { KPICardSkeleton } from 'dashboard';

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 'var(--space-md)',
  padding: 'var(--space-lg)',
  background: 'var(--color-bg-primary)',
};

/** Loading placeholder that mirrors a KPICard's shape while metrics load. */
export const Cargando = () => (
  <div style={grid}>
    <KPICardSkeleton />
    <KPICardSkeleton />
    <KPICardSkeleton />
    <KPICardSkeleton />
  </div>
);
