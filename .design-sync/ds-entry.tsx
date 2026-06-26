// Design-system entry for /design-sync.
// Re-exports ProEv's shared component library so esbuild can bundle it into
// window.ProEvDS for claude.ai/design. NOT imported by the app itself.
// Imports point at explicit files (not the '@/components/shared' barrel) so the
// tsconfig-paths plugin resolves each to a file rather than a directory.

// Ship the FOCUS styling surface into _ds_bundle.css: global.css transitively
// pulls in variables.css (:root + [data-theme="dark"] tokens) and the Inter
// web font, plus base element styles. Without this the components reference
// var(--color-*) tokens that nothing defines and render unstyled.
import '@/styles/global.css';

export { AnimatedValue } from '@/components/shared/AnimatedValue';
export { KPICard, StatCard, KPIGrid, KPICardSkeleton } from '@/components/shared/KPICard';
export { StatusBadge } from '@/components/shared/StatusBadge';
export { DataTable } from '@/components/shared/DataTable';
export { SkeletonBlock } from '@/components/shared/SkeletonBlock';
export { DropdownMenu } from '@/components/shared/DropdownMenu';
export { ConfirmDialog } from '@/components/shared/ConfirmDialog';
export { LoadingSpinner } from '@/components/shared/LoadingSpinner';
export { ScrollToTop } from '@/components/shared/ScrollToTop';
