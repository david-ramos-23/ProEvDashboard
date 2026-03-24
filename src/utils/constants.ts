/**
 * Constantes del sistema ProEv.
 * IDs de tablas Airtable, mapeo de colores por estado, configuraciones.
 */

import { EstadoGeneral, EstadoRevision, EstadoPago, EstadoEmail } from '../types';

// ============================================================
// IDs de Tablas Airtable
// ============================================================

export const AIRTABLE_TABLES = {
  ALUMNOS: 'tblmfv5beVBGOZ2sb',
  REVISIONES_VIDEO: 'tbluWapTseCcfcfXc',
  PAGOS: 'tblWC5K2xuLr3XXQ4',
  HISTORIAL: 'tbl3Zkove7j24eCho',
  EDICIONES: 'tblYhOznRk0bdEROJ',
  MODULOS: 'tbly892Tp5KZBDWgr',
  COLA_EMAILS: 'tblVqFfucbW5POC5u',
  ENVIOS_EMAILS: 'tblsh8KaCMQ8KoKeU',
  INBOX: 'tblyp8NSzdpnTqkPD',
} as const;

// ============================================================
// Colores por Estado (CSS variable names)
// ============================================================

/** Mapeo de estado del alumno → color CSS */
export const ESTADO_COLORS: Record<EstadoGeneral, string> = {
  'Privado': 'var(--color-estado-privado)',
  'Preinscrito': 'var(--color-estado-preinscrito)',
  'En revision de video': 'var(--color-estado-en-revision)',
  'Aprobado': 'var(--color-estado-aprobado)',
  'Rechazado': 'var(--color-estado-rechazado)',
  'Pendiente de pago': 'var(--color-estado-pendiente-pago)',
  'Reserva': 'var(--color-estado-reserva)',
  'Pagado': 'var(--color-estado-pagado)',
  'Finalizado': 'var(--color-estado-finalizado)',
  'Plazo Vencido': 'var(--color-estado-plazo-vencido)',
  'Pago Fallido': 'var(--color-estado-pago-fallido)',
};

/** Iconos emoji por estado */
export const ESTADO_ICONS: Record<EstadoGeneral, string> = {
  'Privado': '🔒',
  'Preinscrito': '📝',
  'En revision de video': '🎥',
  'Aprobado': '✅',
  'Rechazado': '❌',
  'Pendiente de pago': '💳',
  'Reserva': '⏳',
  'Pagado': '🎉',
  'Finalizado': '🏁',
  'Plazo Vencido': '⏰',
  'Pago Fallido': '⚠️',
};

/** Colores de estado de revisión */
export const REVISION_COLORS: Record<EstadoRevision, string> = {
  'Pendiente': 'var(--color-accent-warning)',
  'Aprobado': 'var(--color-accent-success)',
  'Rechazado': 'var(--color-accent-danger)',
  'Revision Necesaria': 'var(--color-accent-info)',
};

/** Colores de estado de pago */
export const PAGO_COLORS: Record<EstadoPago, string> = {
  'Pendiente': 'var(--color-accent-warning)',
  'Pagado': 'var(--color-accent-success)',
  'Fallido': 'var(--color-accent-danger)',
  'Reembolsado': 'var(--color-accent-info)',
  'Enviado': 'var(--color-accent-primary)',
};

/** Colores de estado de edición */
export const EDITION_ESTADO_COLORS: Record<string, string> = {
  'Planificada': 'var(--color-text-muted)',
  'En Inscripcion': 'var(--color-accent-info)',
  'Activa': 'var(--color-accent-success)',
  'Finalizada': 'var(--color-text-muted)',
};

/** Colores de estado de email */
export const EMAIL_COLORS: Record<EstadoEmail, string> = {
  'Pendiente Aprobacion': 'var(--color-accent-warning)',
  'Pendiente': 'var(--color-accent-info)',
  'Enviando': 'var(--color-accent-primary)',
  'Enviado': 'var(--color-accent-success)',
  'Error': 'var(--color-accent-danger)',
};

// ============================================================
// Navegación por rol
// ============================================================

export interface NavItem {
  label: string;
  path: string;
  icon: string;
}

export const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
  { label: 'Alumnos', path: '/admin/alumnos', icon: '👥' },
  { label: 'Pagos', path: '/admin/pagos', icon: '💰' },
  { label: 'Emails', path: '/admin/inbox', icon: '📬' },
  { label: 'Ediciones', path: '/admin/ediciones', icon: '📅' },
  { label: 'Revisión Videos', path: '/revisor/videos', icon: '🎬' },
];

export const REVISOR_NAV: NavItem[] = [
  { label: 'Revisión Videos', path: '/revisor/videos', icon: '🎬' },
  { label: 'Aprobar Emails', path: '/revisor/emails', icon: '✉️' },
];

// ============================================================
// Módulos y precios
// ============================================================

export const MODULO_LABELS: Record<string, string> = {
  'mod1': 'Módulo 1',
  'mod2': 'Módulo 2',
  'mod3': 'Módulo 3',
  'pack1y2': 'Pack Módulos 1 + 2',
  'pack2y3': 'Pack Módulos 2 + 3',
  'pack1y2y3': 'Formación Completa',
};
