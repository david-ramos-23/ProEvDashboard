/**
 * Utilidades de formato para el Dashboard ProEv.
 * Formateo de fechas, moneda, y helpers de visualización.
 */

/**
 * Formatea una fecha ISO a formato legible español.
 * @example formatDate('2026-03-20T14:30:00Z') → '20 mar 2026'
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Formatea una fecha con hora.
 * @example formatDateTime('2026-03-20T14:30:00Z') → '20 mar 2026, 14:30'
 */
export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/**
 * Formatea un importe monetario.
 * @example formatCurrency(150) → '150,00 €'
 */
export function formatCurrency(amount?: number | null, currency = 'EUR'): string {
  if (amount == null) return '—';
  const symbols: Record<string, string> = { EUR: '€', USD: '$', MXN: 'MX$' };
  return `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbols[currency] || currency}`;
}

/**
 * Formatea un número grande con separador de miles.
 * @example formatNumber(1250) → '1.250'
 */
export function formatNumber(num?: number | null): string {
  if (num == null) return '0';
  return num.toLocaleString('es-ES');
}

/**
 * Calcula "hace X tiempo" de forma relativa.
 * @example timeAgo('2026-03-19T14:30:00Z') → 'Hace 1 día'
 */
export function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return 'Hace 1 día';
  if (diffDays < 30) return `Hace ${diffDays} días`;
  return formatDate(dateStr);
}

/**
 * Genera estrellas de puntuación como texto.
 * @example renderStars(4) → '★★★★☆'
 */
export function renderStars(rating?: number | null, max = 5): string {
  if (rating == null) return '☆'.repeat(max);
  const filled = Math.min(Math.max(0, Math.round(rating)), max);
  return '★'.repeat(filled) + '☆'.repeat(max - filled);
}

/**
 * Trunca texto a una longitud máxima.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Extrae iniciales de un nombre.
 * @example getInitials('Juan Pérez') → 'JP'
 */
export function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}
