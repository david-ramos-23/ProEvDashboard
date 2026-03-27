export function LoadingSpinner({ text = 'Cargando...' }: { text?: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-3xl)',
      gap: 'var(--space-md)',
      color: 'var(--color-text-muted)',
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid var(--color-border)',
        borderTopColor: 'var(--color-accent-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      {/* @keyframes spin defined in global.css */}
      <span>{text}</span>
    </div>
  );
}
