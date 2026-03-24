import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  errorTitle?: string;
  errorMessage?: string;
  reloadLabel?: string;
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

  componentDidCatch(error: Error) {
    // Auto-reload on chunk load failures (e.g. after a new deploy)
    if (error.message?.includes('Failed to fetch dynamically imported module') ||
        error.message?.includes('Importing a module script failed')) {
      window.location.reload();
    }
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{this.props.errorTitle ?? 'Algo ha fallado'}</h2>
          <p style={{ color: 'var(--color-text-muted, #64748b)', maxWidth: 400, textAlign: 'center' }}>
            {this.state.error?.message || (this.props.errorMessage ?? 'Error inesperado en la aplicacion.')}
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
            {this.props.reloadLabel ?? 'Recargar'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
