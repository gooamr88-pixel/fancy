'use client';

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          retry: this.handleRetry,
        });
      }

      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.iconWrapper}>
              <span style={styles.icon}>⚠️</span>
            </div>

            <h3 style={styles.heading}>Something went wrong</h3>

            <p style={styles.message}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>

            {process.env.NODE_ENV !== 'production' && this.state.errorInfo && (
              <details style={styles.details}>
                <summary style={styles.summary}>Error Details</summary>
                <pre style={styles.stack}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <button onClick={this.handleRetry} style={styles.retryButton}>
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 200,
  },
  card: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E8E2D6',
    borderRadius: 12,
    padding: '32px 28px',
    maxWidth: 520,
    width: '100%',
    textAlign: 'center',
  },
  iconWrapper: {
    marginBottom: 16,
  },
  icon: {
    fontSize: 40,
  },
  heading: {
    fontFamily: '"Playfair Display", Georgia, serif',
    fontSize: 20,
    fontWeight: 700,
    color: '#2C2C2C',
    margin: '0 0 8px 0',
  },
  message: {
    fontSize: 14,
    lineHeight: 1.6,
    color: '#8C8578',
    margin: '0 0 20px 0',
  },
  details: {
    textAlign: 'left',
    marginBottom: 20,
    backgroundColor: '#F8F4EC',
    borderRadius: 8,
    padding: 12,
  },
  summary: {
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    color: '#2C2C2C',
  },
  stack: {
    fontSize: 12,
    color: '#8C8578',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    marginTop: 8,
    maxHeight: 200,
    overflow: 'auto',
  },
  retryButton: {
    backgroundColor: '#C9A96E',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 8,
    padding: '10px 28px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
