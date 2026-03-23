import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '16px',
          padding: '32px',
          color: 'var(--color-text-primary, #f1f5f9)',
        }}>
          <div style={{ fontSize: '3rem' }}>&#x26A0;</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Algo ha fallado</h2>
          <p style={{ color: 'var(--color-text-muted, #64748b)', maxWidth: 400, textAlign: 'center' }}>
            {this.state.error?.message || 'Error inesperado en la aplicacion.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '8px 24px',
              background: 'var(--color-accent-primary, #6366f1)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
