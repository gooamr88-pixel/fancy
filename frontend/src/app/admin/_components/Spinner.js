'use client';

import { T } from './theme';

/** Consistent full-page loading treatment for panel pages. */
export function PageLoading({ label = 'Loading…' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '48px 0', color: T.text400 }}>
      <div style={{ width: 16, height: 16, border: `2px solid ${T.border}`, borderTop: `2px solid ${T.primary}`, borderRadius: '50%', animation: 'admin-spin 1s linear infinite' }} />
      <span style={{ fontSize: 13 }}>{label}</span>
      <style jsx>{`@keyframes admin-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default PageLoading;
