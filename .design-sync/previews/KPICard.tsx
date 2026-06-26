import { KPICard } from 'dashboard';

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 'var(--space-md)',
  padding: 'var(--space-lg)',
  background: 'var(--color-bg-primary)',
};

/** The KPI metric card — colored top accent, label, animated value, optional subtext. */
export const Metricas = () => (
  <div style={grid}>
    <KPICard label="Alumnos totales" value={1248} icon="👥" subtext="+12% vs edición anterior" />
    <KPICard label="Aprobados" value="847" icon="✅" color="var(--color-accent-success)" subtext="68% del total" />
    <KPICard label="Pendientes de pago" value={92} icon="💳" color="var(--color-accent-warning)" subtext="Vencen en 7 días" />
    <KPICard label="Ingresos edición" value="€124.500" icon="💰" color="var(--color-accent-info)" subtext="Meta: €150.000" />
  </div>
);

/** With `onClick` the card becomes navigable: it shows a → arrow and a hover affordance. */
export const Navegable = () => (
  <div style={grid}>
    <KPICard label="Ver todos los alumnos" value={1248} icon="👥" onClick={() => {}} subtext="Ir al listado" />
    <KPICard label="Revisar vídeos" value={36} icon="🎥" color="var(--color-accent-primary)" onClick={() => {}} subtext="Pendientes de revisión" />
  </div>
);
