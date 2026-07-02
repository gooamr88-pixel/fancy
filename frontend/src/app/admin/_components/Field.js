'use client';

import { T } from './theme';

/** Inline label-value display row, used in modals/detail panels. */
export function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '5px 0' }}>
      <span style={{ width: 96, color: T.text400, fontSize: 12 }}>{label}</span>
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  );
}

/** Form field wrapper: uppercase label above the input/select/textarea. */
export function Field({ label, children }) {
  return (
    <label style={{ display: 'block', width: '100%', marginBottom: 4 }}>
      <span style={{ display: 'block', fontSize: 11, color: T.text500, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}
