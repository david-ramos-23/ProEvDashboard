import { StatCard } from 'dashboard';

const row = {
  display: 'flex',
  gap: 'var(--space-md)',
  flexWrap: 'wrap',
  padding: 'var(--space-lg)',
  background: 'var(--color-bg-primary)',
};

/** Non-navigable stat: icon + animated value + label. No accent, no hover. */
export const Estadisticas = () => (
  <div style={row}>
    <StatCard label="Vídeos revisados" value="312" icon="🎥" />
    <StatCard label="Media de nota" value="8,4" icon="⭐" />
    <StatCard label="Parejas Módulo 3" value="48" icon="🤝" />
  </div>
);
