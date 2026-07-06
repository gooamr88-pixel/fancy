'use client';

import { T } from './theme';

/**
 * Consistent full-page error treatment for panel pages — most already have
 * their own internal reload/refetch function, this just gives every one of
 * them the same "Try again" affordance instead of a bare dead-end string.
 */
export function ErrorState({ message, onRetry }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '48px 0', flexWrap: 'wrap' }}>
      <p style={{ color: T.danger, margin: 0, fontSize: 13 }}>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: '7px 16px', border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
            background: T.surfaceAlt, color: T.text700, fontSize: 12.5, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          ↻ Try again
        </button>
      )}
    </div>
  );
}

export default ErrorState;
