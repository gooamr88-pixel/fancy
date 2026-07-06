'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function DashboardError({ error, reset }) {
  const headingRef = useRef(null);

  useEffect(() => {
    console.error('Dashboard error:', error);
    // A11Y-10: focus the heading so screen-reader users know they've landed
    // on an error state after a client-side navigation.
    headingRef.current?.focus();
  }, [error]);

  return (
    <div className="dberr-overlay">
      <div className="dberr-card">
        <div className="dberr-icon-wrapper" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h2 ref={headingRef} tabIndex={-1} className="dberr-heading">Something went wrong</h2>

        {/* Never interpolate error.message — a caught render exception is a
            technical/developer detail, not a crafted user-facing string. */}
        <p className="dberr-message">An unexpected error occurred while loading the dashboard.</p>

        <div className="dberr-actions">
          <button onClick={() => reset()} className="dberr-retry-button">Try Again</button>
          <Link href="/" className="dberr-home-link">Go to Homepage</Link>
        </div>
      </div>

      <style jsx>{`
        .dberr-overlay { display: flex; align-items: center; justify-content: center; min-height: 100vh; min-height: 100dvh; background: #F8F4EC; padding: 24px; }
        .dberr-card { background: #FFFFFF; border: 1px solid #E8E2D6; border-radius: 16px; padding: 48px 40px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.06); box-sizing: border-box; }
        .dberr-icon-wrapper { display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; margin: 0 auto 20px; border-radius: 50%; background: rgba(196, 94, 94, 0.08); color: #C45E5E; }
        .dberr-heading { font-family: var(--font-serif), "Playfair Display", Georgia, serif; font-size: 24px; font-weight: 700; color: #191B1E; margin: 0 0 12px; outline: none; }
        .dberr-message { font-size: 15px; line-height: 1.6; color: #77736A; margin: 0 0 32px; }
        .dberr-actions { display: flex; flex-direction: column; align-items: center; gap: 16px; }
        .dberr-retry-button { background: var(--gold-cta, #8A6D34); color: #FFFFFF; border: none; border-radius: 8px; padding: 12px 32px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background-color 0.2s ease; width: 100%; max-width: 220px; min-height: 44px; box-sizing: border-box; }
        .dberr-home-link { color: var(--gold-cta, #8A6D34); font-size: 14px; font-weight: 500; text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; }

        @media (prefers-color-scheme: dark) {
          .dberr-overlay { background: #17181A; }
          .dberr-card { background: #1E1E1B; border-color: #3D3A33; }
          .dberr-heading { color: #F8F4EC; }
          .dberr-message { color: #A8A397; }
          .dberr-retry-button { background: #D7BE80; color: #191B1E; }
          .dberr-home-link { color: #D7BE80; }
        }
      `}</style>
    </div>
  );
}
