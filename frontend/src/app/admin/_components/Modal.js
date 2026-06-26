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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(25, 27, 30, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surface,
          borderRadius: T.radius,
          border: `1px solid ${T.border}`,
          boxShadow: T.shadowMd,
          width: '100%',
          maxWidth: width,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${T.border}` }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: 'none',
              background: 'transparent',
              border: `1px solid ${T.border}`,
              width: 30,
              height: 30,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: T.text500,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = T.text900; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.text500; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: '24px 28px', overflowY: 'auto', boxSizing: 'border-box' }}>{children}</div>
        {footer && <div style={{ padding: '16px 24px', borderTop: `1px solid ${T.border}`, background: T.surfaceAlt, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Button({ onClick, children, variant = 'default', disabled, type = 'button' }) {
  const styles = {
    default: { background: T.surface, color: T.text700, border: `1px solid ${T.border}` },
    primary: { background: T.primary, color: '#FFFFFF', border: `1px solid ${T.primary}`, fontWeight: 800 },
    danger: { background: 'rgba(239, 68, 68, 0.1)', color: T.danger, border: `1px solid rgba(239, 68, 68, 0.2)` },
    warning: { background: 'rgba(245, 158, 11, 0.1)', color: T.warning, border: `1px solid rgba(245, 158, 11, 0.2)` },
    ghost: { background: 'transparent', color: T.text500, border: `1px solid ${T.border}` },
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`admin-btn admin-btn-${variant}`}
      style={{
        ...styles,
        padding: '9px 18px',
        borderRadius: T.radiusSm,
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {children}
    </button>
  );
}

export function StatusBadge({ status }) {
  const map = {
    // Lifecycle / health
    active: { bg: T.successSoft, fg: T.success, border: 'rgba(16, 185, 129, 0.2)' },
    suspended: { bg: T.warningSoft, fg: T.warning, border: 'rgba(245, 158, 11, 0.2)' },
    banned: { bg: T.dangerSoft, fg: T.danger, border: 'rgba(239, 68, 68, 0.2)' },
    // Payments
    completed: { bg: T.successSoft, fg: T.success, border: 'rgba(16, 185, 129, 0.2)' },
    paid: { bg: T.successSoft, fg: T.success, border: 'rgba(16, 185, 129, 0.2)' },
    pending: { bg: T.warningSoft, fg: T.warning, border: 'rgba(245, 158, 11, 0.2)' },
    failed: { bg: T.dangerSoft, fg: T.danger, border: 'rgba(239, 68, 68, 0.2)' },
    refunded: { bg: T.surfaceAlt, fg: T.text500, border: 'rgba(156, 163, 175, 0.15)' },
    // Subscriptions
    trialing: { bg: T.primarySoft, fg: T.primary, border: 'rgba(197, 168, 107, 0.2)' },
    past_due: { bg: T.warningSoft, fg: T.warning, border: 'rgba(245, 158, 11, 0.2)' },
    canceled: { bg: T.dangerSoft, fg: T.danger, border: 'rgba(239, 68, 68, 0.2)' },
  };
  const c = map[status] || { bg: T.surfaceAlt, fg: T.text500, border: 'rgba(156, 163, 175, 0.15)' };
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        padding: '4px 12px',
        borderRadius: 20,
        fontSize: 10.5,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {(status || '—').toString().replace(/_/g, ' ')}
    </span>
  );
}
