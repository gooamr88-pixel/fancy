'use client';
import { useState, useEffect, useCallback } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';

/**
 * LogoutModal — Premium logout confirmation popup.
 *
 * Props:
 *   isOpen    – boolean – show / hide
 *   onClose   – fn      – called when user cancels
 *   onConfirm – fn      – called when user confirms logout
 */
export default function LogoutModal({ isOpen, onClose, onConfirm }) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [loading, setLoading] = useState(false);

  // `visible` (mount) and `animating` (transition start/reset) both need to
  // flip in lockstep with `isOpen` — a render-time resync, not an effect
  // concern. Only the rAF-driven "animate in" choreography (paint-timing
  // dependent) stays in an effect below.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setVisible(true);
    } else {
      setAnimating(false);
    }
  }

  // Animate in
  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimating(true));
    });
  }, [isOpen]);

  // Animate out: unmount only after the closing transition finishes
  useEffect(() => {
    if (isOpen) return;
    const t = setTimeout(() => setVisible(false), 280);
    return () => clearTimeout(t);
  }, [isOpen]);

  // A11Y-9: focus trap, initial focus, focus restore, body-scroll lock, and
  // Escape-to-close (replacing the standalone handler this used to have)
  // shared with every other modal in the app via one hook.
  const dialogRef = useModalA11y(isOpen, { onClose });

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      await onConfirm();
    } catch {
      setLoading(false);
    }
  }, [onConfirm]);

  if (!visible) return null;

  /* ─── Brand Tokens ─── */
  const gold = '#B8944F';
  const charcoal = '#191B1E';
  const ivory = '#F8F4EC';
  const stone = '#5E5A52';
  const border = '#E8E2D6';
  const errorRed = '#C45E5E';
  const errorBg = '#FFF1F2';

  return (
    <>
      {/* ─── Injected Keyframes ─── */}
      <style>{`
        @keyframes logoutShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes logoutPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>

      {/* ─── Backdrop ─── */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(25, 27, 30, 0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          opacity: animating ? 1 : 0,
          transition: 'opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* ─── Modal Container ─── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          pointerEvents: 'none',
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-modal-title"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          style={{
            pointerEvents: 'auto',
            position: 'relative',
            width: '100%',
            maxWidth: '400px',
            background: '#FFFFFF',
            borderRadius: '20px',
            border: `1px solid ${border}`,
            boxShadow: '0 25px 60px rgba(25, 27, 30, 0.18), 0 8px 24px rgba(184, 148, 79, 0.08)',
            overflow: 'hidden',
            transform: animating ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(12px)',
            opacity: animating ? 1 : 0,
            transition: 'transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* ── Gold accent bar ── */}
          <div
            style={{
              height: '3px',
              background: `linear-gradient(90deg, transparent, ${gold}, transparent)`,
              backgroundSize: '200% 100%',
              animation: 'logoutShimmer 3s ease-in-out infinite',
            }}
          />

          {/* ── Content ── */}
          <div style={{ padding: '32px 28px 28px', textAlign: 'center' }}>
            {/* Icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: errorBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                border: `1.5px solid rgba(196, 94, 94, 0.15)`,
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke={errorRed}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>

            {/* Title */}
            <h2
              id="logout-modal-title"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '22px',
                fontWeight: 600,
                color: charcoal,
                margin: '0 0 8px',
                letterSpacing: '-0.01em',
              }}
            >
              Sign Out
            </h2>

            {/* Description */}
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                lineHeight: '1.6',
                color: stone,
                margin: '0 0 28px',
              }}
            >
              Are you sure you want to sign out? You&#39;ll need to log in again to access your account.
            </p>

            {/* ── Buttons ── */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {/* Cancel */}
              <button
                onClick={onClose}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: `1px solid ${border}`,
                  background: '#FFFFFF',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: stone,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: loading ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background = ivory;
                    e.currentTarget.style.borderColor = gold;
                    e.currentTarget.style.color = charcoal;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#FFFFFF';
                  e.currentTarget.style.borderColor = border;
                  e.currentTarget.style.color = stone;
                }}
              >
                Cancel
              </button>

              {/* Confirm Sign Out */}
              <button
                onClick={handleConfirm}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: loading
                    ? errorRed
                    : `linear-gradient(135deg, ${errorRed} 0%, #A84040 100%)`,
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(196, 94, 94, 0.25)',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(196, 94, 94, 0.35)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(196, 94, 94, 0.25)';
                }}
              >
                {loading ? (
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      style={{ animation: 'spin 1s linear infinite' }}
                    >
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        stroke="rgba(255,255,255,0.35)"
                        strokeWidth="3"
                      />
                      <path
                        d="M12 2a10 10 0 0 1 10 10"
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                    Signing Out…
                  </>
                ) : (
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign Out
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
