import { StatusBadge } from 'dashboard';

const row = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-sm)',
  alignItems: 'center',
  padding: 'var(--space-lg)',
  background: 'var(--color-bg-primary)',
};

/** The estado palette — each value maps to its own brand color + soft tinted background. */
export const Estados = () => (
  <div style={row}>
    <StatusBadge status="Aprobado" />
    <StatusBadge status="En revisión de video" />
    <StatusBadge status="Pendiente de pago" />
    <StatusBadge status="Rechazado" />
    <StatusBadge status="Finalizado" />
    <StatusBadge status="Preinscrito" />
    <StatusBadge status="Reserva" />
  </div>
);

/** With `showIcon`, the color dot is replaced by the estado's emoji glyph. */
export const ConIcono = () => (
  <div style={row}>
    <StatusBadge status="Aprobado" showIcon />
    <StatusBadge status="En revisión de video" showIcon />
    <StatusBadge status="Pendiente de pago" showIcon />
    <StatusBadge status="Rechazado" showIcon />
    <StatusBadge status="Pagado" showIcon />
  </div>
);
