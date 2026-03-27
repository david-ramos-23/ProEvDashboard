/**
 * Shared UI components — barrel re-export.
 *
 * Each component lives in its own file for better code splitting
 * and maintainability. Import from '@/components/shared' as before.
 */

export { AnimatedValue, useCountUp, parseFormattedValue } from './AnimatedValue';
export { KPICard, StatCard, KPIGrid, KPICardSkeleton } from './KPICard';
export { StatusBadge } from './StatusBadge';
export { DataTable } from './DataTable';
export type { Column } from './DataTable';
export { SkeletonBlock } from './SkeletonBlock';
export { DropdownMenu } from './DropdownMenu';
export { ConfirmDialog } from './ConfirmDialog';
export { LoadingSpinner } from './LoadingSpinner';
export { ScrollToTop } from './ScrollToTop';
