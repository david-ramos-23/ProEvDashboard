import { KPIGrid, KPICard } from 'dashboard';

const frame = { padding: 'var(--space-lg)', background: 'var(--color-bg-primary)' };

/** Responsive KPI grid — `columns` controls the column count (2–5). */
export const TresColumnas = () => (
  <div style={frame}>
    <KPIGrid columns={3}>
      <KPICard label="Alumnos totales" value={1248} icon="👥" subtext="Edición 2026" />
      <KPICard label="Aprobados" value={847} icon="✅" color="var(--color-accent-success)" subtext="68% del total" />
      <KPICard label="Ingresos" value="€124.500" icon="💰" color="var(--color-accent-info)" subtext="Meta €150.000" />
    </KPIGrid>
  </div>
);

/** Two-column layout for a compact dashboard header. */
export const DosColumnas = () => (
  <div style={frame}>
    <KPIGrid columns={2}>
      <KPICard label="Pendientes de pago" value={92} icon="💳" color="var(--color-accent-warning)" />
      <KPICard label="En revisión" value={36} icon="🎥" color="var(--color-accent-primary)" />
    </KPIGrid>
  </div>
);
