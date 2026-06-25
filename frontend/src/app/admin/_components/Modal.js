'use client';

import { T } from './theme';

/**
 * Minimal centered modal/dialog used by admin section pages (detail drawers,
 * confirmations). Click the backdrop or ✕ to dismiss.
 */
export default function Modal({ open, title, onClose, children, footer, width = 560 }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.66)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: T.surface, borderRadius: T.radius, boxShadow: T.shadowMd, width: '100%', maxWidth: width, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text900, margin: 0 }}>{title}</h3>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: T.text500 }}>✕</button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto' }}>{children}</div>
        {footer && <div style={{ padding: '14px 20px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Button({ onClick, children, variant = 'default', disabled, type = 'button' }) {
  const styles = {
    default: { background: T.surface, color: T.text700, border: `1px solid ${T.border}` },
    primary: { background: T.primary, color: '#fff', border: `1px solid ${T.primary}` },
    danger: { background: T.danger, color: '#fff', border: `1px solid ${T.danger}` },
    warning: { background: T.warning, color: '#fff', border: `1px solid ${T.warning}` },
    ghost: { background: 'transparent', color: T.text700, border: `1px solid ${T.border}` },
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...styles, padding: '8px 14px', borderRadius: T.radiusSm, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
    >
      {children}
    </button>
  );
}

export function StatusBadge({ status }) {
  const map = {
    // Lifecycle / health
    active: { bg: T.successSoft, fg: T.success },
    suspended: { bg: T.warningSoft, fg: T.warning },
    banned: { bg: T.dangerSoft, fg: T.danger },
    // Payments
    completed: { bg: T.successSoft, fg: T.success },
    paid: { bg: T.successSoft, fg: T.success },
    pending: { bg: T.warningSoft, fg: T.warning },
    failed: { bg: T.dangerSoft, fg: T.danger },
    refunded: { bg: T.surfaceAlt, fg: T.text500 },
    // Subscriptions
    trialing: { bg: T.primarySoft, fg: T.primary },
    past_due: { bg: T.warningSoft, fg: T.warning },
    canceled: { bg: T.dangerSoft, fg: T.danger },
  };
  const c = map[status] || { bg: T.surfaceAlt, fg: T.text500 };
  return (
    <span style={{ background: c.bg, color: c.fg, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
      {(status || '—').toString().replace(/_/g, ' ')}
    </span>
  );
}
