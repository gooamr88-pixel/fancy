'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }) {
  const headingRef = useRef(null);

  useEffect(() => {
    console.error('Application error:', error);
    // A11Y-10: a client-side navigation into this boundary doesn't reset
    // focus/announce the route change on its own — move focus to the
    // heading so screen-reader users know they've landed on an error page.
    headingRef.current?.focus();
  }, [error]);

  return (
    <div className="errpage-shell">
      <div className="errpage-card">
        <span className="errpage-icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        <h2 ref={headingRef} tabIndex={-1} className="errpage-heading">
          Something went wrong
        </h2>
        <p className="errpage-body">
          {/* Never interpolate error.message here — a render-time exception is
              a technical/developer detail, not a crafted user-facing string
              (unlike apiFetch errors), and could leak internals. */}
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        <div className="errpage-actions">
          <button onClick={reset} className="errpage-btn-primary">Try Again</button>
          <Link href="/" className="errpage-btn-secondary">Go Home</Link>
        </div>
      </div>

      <style jsx>{`
        .errpage-shell {
          min-height: 100vh;
          min-height: 100dvh;
          background: #F8F4EC;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: var(--font-sans);
        }
        .errpage-card {
          max-width: 440px;
          width: 100%;
          text-align: center;
          background: #FFFFFF;
          border: 1px solid #E8E2D6;
          padding: 48px 32px;
          border-radius: 16px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.06);
        }
        .errpage-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 72px;
          height: 72px;
          margin: 0 auto 8px;
          border-radius: 50%;
          background: rgba(196, 94, 94, 0.08);
          color: #C45E5E;
        }
        .errpage-heading {
          font-family: var(--font-serif);
          font-size: 24px;
          font-weight: 600;
          color: #191B1E;
          margin-top: 20px;
          outline: none;
        }
        .errpage-body {
          color: #77736A;
          margin-top: 12px;
          font-size: 14px;
          line-height: 1.7;
          font-weight: 300;
        }
        .errpage-actions {
          margin-top: 28px;
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .errpage-btn-primary, .errpage-btn-secondary {
          padding: 12px 28px;
          font-size: 14px;
          font-weight: 700;
          border-radius: 8px;
          font-family: var(--font-sans);
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          min-height: 44px;
          box-sizing: border-box;
        }
        .errpage-btn-primary {
          background: var(--gold-cta, #8A6D34);
          color: #FFFFFF;
          border: none;
        }
        .errpage-btn-secondary {
          background: #F8F4EC;
          color: #191B1E;
          border: 1px solid #E8E2D6;
        }

        @media (prefers-color-scheme: dark) {
          .errpage-shell { background: #17181A; }
          .errpage-card { background: #1E1E1B; border-color: #3D3A33; }
          .errpage-heading { color: #F8F4EC; }
          .errpage-body { color: #A8A397; }
          .errpage-btn-primary { background: #D7BE80; color: #191B1E; }
          .errpage-btn-secondary { background: #26282B; color: #F8F4EC; border-color: #3D3A33; }
        }
      `}</style>
    </div>
  );
}
