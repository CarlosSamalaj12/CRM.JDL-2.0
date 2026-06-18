import { Component } from 'react';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '40px 20px',
    background: '#f8fafc',
    color: '#1e293b',
    fontFamily: 'system-ui, sans-serif',
    textAlign: 'center',
  },
  card: {
    maxWidth: 480,
    width: '100%',
    background: '#fff',
    borderRadius: 16,
    padding: 40,
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    border: '1px solid #e2e8f0',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    margin: '0 0 8px',
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 1.5,
    margin: '0 0 24px',
  },
  details: {
    fontSize: 12,
    color: '#94a3b8',
    background: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    textAlign: 'left',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: 200,
    overflow: 'auto',
  },
  button: {
    padding: '10px 24px',
    borderRadius: 8,
    border: 'none',
    background: '#1e3a5f',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;

      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, reset: this.handleReset })
          : this.props.fallback;
      }

      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>⚠️</div>
            <h1 style={styles.title}>Algo salió mal</h1>
            <p style={styles.message}>
              Ocurrió un error inesperado. Por favor intenta recargar la página.
            </p>
            {isDev && this.state.error && (
              <div style={styles.details}>
                {this.state.error.toString()}
                {'\n\n'}
                {this.state.error.stack}
              </div>
            )}
            <button style={styles.button} onClick={this.handleReset}>
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
