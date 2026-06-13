import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Top-level error boundary. If any render throws, show a calm recovery screen
 * (your logged data lives in localStorage and is untouched) with a reload action,
 * instead of a blank white page. Error boundaries must be class components.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Surface for debugging; no remote logging (serverless/private by design).
    console.error('HaloCal crashed:', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'var(--bg-primary, #0a0b10)',
          color: 'var(--text-primary, #f5f7fa)',
          fontFamily: 'var(--font-display, system-ui, sans-serif)',
        }}
      >
        <div style={{ fontSize: '2.5rem' }}>🟡</div>
        <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Something went wrong</h1>
        <p style={{ color: 'var(--text-secondary, #9aa6b8)', fontSize: '0.95rem', maxWidth: '420px', lineHeight: 1.5, margin: 0 }}>
          HaloCal hit an unexpected error, but your logged data is safe on this device.
          Reloading usually fixes it.
        </p>
        <button
          onClick={this.handleReload}
          style={{
            marginTop: '0.5rem',
            padding: '0.7rem 1.5rem',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 600,
            color: '#fff',
            background: 'var(--accent-purple, #8b5cf6)',
          }}
        >
          Reload HaloCal
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
