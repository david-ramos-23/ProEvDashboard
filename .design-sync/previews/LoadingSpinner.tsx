import { LoadingSpinner } from 'dashboard';

const frame = { background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-lg)' };

/** Default centered spinner with the standard "Cargando..." label. */
export const Default = () => (
  <div style={frame}><LoadingSpinner /></div>
);

/** Custom label for context-specific loading states. */
export const ConTexto = () => (
  <div style={frame}><LoadingSpinner text="Cargando alumnos…" /></div>
);
