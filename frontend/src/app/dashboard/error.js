'use client';

import { useEffect } from 'react';

export default function DashboardError({ error, reset }) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.iconWrapper}>
          <span style={styles.icon}>⚠️</span>
        </div>

        <h2 style={styles.heading}>Something went wrong</h2>

        <p style={styles.message}>
          {error?.message || 'An unexpected error occurred while loading the dashboard.'}
        </p>

        <div style={styles.actions}>
          <button onClick={() => reset()} style={styles.retryButton}>
            Try Again
          </button>
          <a href="/" style={styles.homeLink}>
            Go to Homepage
          </a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#F8F4EC',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E8E2D6',
    borderRadius: 16,
    padding: '48px 40px',
    maxWidth: 480,
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
  },
  iconWrapper: {
    marginBottom: 20,
  },
  icon: {
    fontSize: 48,
  },
  heading: {
    fontFamily: '"Playfair Display", Georgia, serif',
    fontSize: 24,
    fontWeight: 700,
    color: '#2C2C2C',
    margin: '0 0 12px 0',
  },
  message: {
    fontSize: 15,
    lineHeight: 1.6,
    color: '#8C8578',
    margin: '0 0 32px 0',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  retryButton: {
    backgroundColor: '#C9A96E',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 8,
    padding: '12px 32px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    width: '100%',
    maxWidth: 220,
  },
  homeLink: {
    color: '#C9A96E',
    fontSize: 14,
    fontWeight: 500,
    textDecoration: 'none',
  },
};
