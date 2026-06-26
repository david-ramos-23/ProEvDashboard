import { SkeletonBlock } from 'dashboard';

const bg = { background: 'var(--color-bg-primary)' };

/** Stacked text-line placeholders of varying width. */
export const Lineas = () => (
  <div style={{ ...bg, display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', padding: 'var(--space-lg)', maxWidth: 420 }}>
    <SkeletonBlock width="40%" height="20px" />
    <SkeletonBlock />
    <SkeletonBlock width="85%" />
    <SkeletonBlock width="60%" />
  </div>
);

/** Composed placeholder: a circular avatar + two text lines. */
export const Avatar = () => (
  <div style={{ ...bg, display: 'flex', gap: 'var(--space-md)', alignItems: 'center', padding: 'var(--space-lg)' }}>
    <SkeletonBlock width="48px" height="48px" borderRadius="var(--radius-full)" />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', flex: 1, maxWidth: 240 }}>
      <SkeletonBlock width="70%" height="14px" />
      <SkeletonBlock width="45%" height="12px" />
    </div>
  </div>
);
