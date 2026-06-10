'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8F4EC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
          background: '#FFFFFF',
          border: '1px solid #E8E2D6',
          padding: '48px 32px',
          borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
        }}
      >
        <span style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>⚠️</span>
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '24px',
            fontWeight: 600,
            color: '#191B1E',
            marginTop: '12px',
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            color: '#77736A',
            marginTop: '12px',
            fontSize: '14px',
            lineHeight: 1.7,
            fontWeight: 300,
          }}
        >
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        <div
          style={{
            marginTop: '28px',
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={reset}
            style={{
              padding: '12px 28px',
              background: '#B8944F',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Try Again
          </button>
          <a
            href="/"
            style={{
              padding: '12px 28px',
              background: '#F8F4EC',
              color: '#191B1E',
              fontSize: '14px',
              fontWeight: 700,
              borderRadius: '8px',
              border: '1px solid #E8E2D6',
              textDecoration: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
