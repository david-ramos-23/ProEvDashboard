import { memo } from 'react';
import { ESTADO_COLORS, ESTADO_ICONS, REVISION_COLORS, PAGO_COLORS, EMAIL_COLORS } from '@/utils/constants';
import { EstadoGeneral, EstadoRevision, EstadoPago, EstadoEmail } from '@/types';
import styles from './Shared.module.css';

type StatusType = 'estado' | 'revision' | 'pago' | 'email';

interface StatusBadgeProps {
  status: string;
  type?: StatusType;
  showIcon?: boolean;
}

function getStatusColor(status: string, type: StatusType): string {
  switch (type) {
    case 'estado': return ESTADO_COLORS[status as EstadoGeneral] || 'var(--color-text-muted)';
    case 'revision': return REVISION_COLORS[status as EstadoRevision] || 'var(--color-text-muted)';
    case 'pago': return PAGO_COLORS[status as EstadoPago] || 'var(--color-text-muted)';
    case 'email': return EMAIL_COLORS[status as EstadoEmail] || 'var(--color-text-muted)';
    default: return 'var(--color-text-muted)';
  }
}

/** Badge de estado con dot de color y texto */
export const StatusBadge = memo(function StatusBadge({ status, type = 'estado', showIcon = false }: StatusBadgeProps) {
  const color = getStatusColor(status, type);
  const icon = type === 'estado' ? ESTADO_ICONS[status as EstadoGeneral] : undefined;

  return (
    <span
      className={styles.badge}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      {showIcon && icon ? <span>{icon}</span> : <span className={styles.badgeDot} style={{ background: color }} />}
      {status}
    </span>
  );
});
