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
        <div className="eb-container">
          <div className="eb-card">
            <div className="eb-icon-wrapper" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h3 className="eb-heading">Something went wrong</h3>

            {/* Never interpolate error.message — a caught render exception is
                a technical/developer detail, not a crafted user-facing
                string, and could leak internals to the guest/organizer. */}
            <p className="eb-message">This section couldn&apos;t be displayed. Please try again.</p>

            {process.env.NODE_ENV !== 'production' && this.state.errorInfo && (
              <details className="eb-details">
                <summary className="eb-summary">Error Details (dev only)</summary>
                <pre className="eb-stack">
                  {this.state.error?.message}
                  {'\n'}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <button onClick={this.handleRetry} className="eb-retry-button">
              Retry
            </button>
          </div>

          <style jsx>{`
            .eb-container { display: flex; align-items: center; justify-content: center; padding: 32px; min-height: 200px; }
            .eb-card { background: #FFFFFF; border: 1px solid #E8E2D6; border-radius: 12px; padding: 32px 28px; max-width: 520px; width: 100%; text-align: center; box-sizing: border-box; }
            .eb-icon-wrapper { display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 50%; background: rgba(196, 94, 94, 0.08); color: #C45E5E; }
            .eb-heading { font-family: var(--font-serif), "Playfair Display", Georgia, serif; font-size: 20px; font-weight: 700; color: #191B1E; margin: 0 0 8px; }
            .eb-message { font-size: 14px; line-height: 1.6; color: #77736A; margin: 0 0 20px; }
            .eb-details { text-align: left; margin-bottom: 20px; background: #F8F4EC; border-radius: 8px; padding: 12px; }
            .eb-summary { cursor: pointer; font-size: 13px; font-weight: 600; color: #191B1E; }
            .eb-stack { font-size: 12px; color: #77736A; white-space: pre-wrap; word-break: break-word; margin-top: 8px; max-height: 200px; overflow: auto; }
            .eb-retry-button { background: var(--gold-cta, #8A6D34); color: #FFFFFF; border: none; border-radius: 8px; padding: 10px 28px; font-size: 14px; font-weight: 600; cursor: pointer; min-height: 44px; }

            @media (prefers-color-scheme: dark) {
              .eb-card { background: #1E1E1B; border-color: #3D3A33; }
              .eb-heading { color: #F8F4EC; }
              .eb-message { color: #A8A397; }
              .eb-details { background: #26282B; }
              .eb-summary { color: #F8F4EC; }
              .eb-stack { color: #A8A397; }
              .eb-retry-button { background: #D7BE80; color: #191B1E; }
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}
