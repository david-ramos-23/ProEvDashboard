import styles from './Shared.module.css';

interface SkeletonBlockProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}

/** Generic shimmer block for skeleton layouts */
export function SkeletonBlock({ width = '100%', height = '16px', borderRadius = 'var(--radius-sm)', style }: SkeletonBlockProps) {
  return (
    <div
      className={styles.skeletonCell}
      style={{ width, height, borderRadius, flexShrink: 0, ...style }}
    />
  );
}
