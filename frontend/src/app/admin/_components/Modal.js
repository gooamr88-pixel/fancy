'use client';

import { T } from './theme';
import { useModalA11y } from '../../hooks/useModalA11y';

/**
 * Minimal centered modal/dialog used by admin section pages (detail drawers,
 * confirmations). Click the backdrop or ✕ to dismiss.
 */
export default function Modal({ open, title, onClose, children, footer, width = 560 }) {
  // A11Y-9: shared focus-trap/initial-focus/focus-restore/scroll-lock/Escape
  // hook — this dialog previously had none of the five.
  const dialogRef = useModalA11y(open, { onClose });
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
        // Above the mobile sidebar drawer's z-index:200 (Sidebar.js) — a modal
        // triggered while the drawer happens to be open must never render
        // invisibly behind it.
        zIndex: 300,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        tabIndex={-1}
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
          <h3 id="admin-modal-title" style={{ fontSize: 17, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>{title}</h3>
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
        {footer && <div style={{ padding: '16px 24px', borderTop: `1px solid ${T.border}`, background: T.surfaceAlt, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Button({ onClick, children, variant = 'default', disabled, type = 'button', style, className, ...rest }) {
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
      className={`admin-btn admin-btn-${variant}${className ? ` ${className}` : ''}`}
      {...rest}
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
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function StatusBadge({ status, label }) {
  // A11Y-5: fg uses the *Dark text-safe variants, not the base semantic hues —
  // T.success/T.warning/T.primary/T.danger read fine as accents/backgrounds
  // but measure well under WCAG AA (2.1–3.8:1) as text on these ~8%-tint
  // badge backgrounds. See globals.css's --admin-*-dark tokens.
  const map = {
    // Lifecycle / health
    active: { bg: T.successSoft, fg: T.successDark, border: 'rgba(16, 185, 129, 0.2)' },
    suspended: { bg: T.warningSoft, fg: T.warningDark, border: 'rgba(245, 158, 11, 0.2)' },
    banned: { bg: T.dangerSoft, fg: T.dangerDark, border: 'rgba(239, 68, 68, 0.2)' },
    // Payments
    completed: { bg: T.successSoft, fg: T.successDark, border: 'rgba(16, 185, 129, 0.2)' },
    paid: { bg: T.successSoft, fg: T.successDark, border: 'rgba(16, 185, 129, 0.2)' },
    pending: { bg: T.warningSoft, fg: T.warningDark, border: 'rgba(245, 158, 11, 0.2)' },
    failed: { bg: T.dangerSoft, fg: T.dangerDark, border: 'rgba(239, 68, 68, 0.2)' },
    refunded: { bg: T.surfaceAlt, fg: T.text500, border: 'rgba(156, 163, 175, 0.15)' },
    // Subscriptions
    trialing: { bg: T.primarySoft, fg: T.primaryDark, border: 'rgba(197, 168, 107, 0.2)' },
    past_due: { bg: T.warningSoft, fg: T.warningDark, border: 'rgba(245, 158, 11, 0.2)' },
    canceled: { bg: T.dangerSoft, fg: T.dangerDark, border: 'rgba(239, 68, 68, 0.2)' },
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
      {label || (status || '—').toString().replace(/_/g, ' ')}
    </span>
  );
}
