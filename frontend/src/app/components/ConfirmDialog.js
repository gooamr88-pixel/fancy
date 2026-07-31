'use client';

import { useCallback, useEffect, useState } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';

/**
 * ConfirmDialog — the branded replacement for `window.confirm()`.
 *
 * ── Why this exists ──
 *
 * A native `confirm()` is drawn by the browser, not by us. It cannot be styled,
 * it says "localhost:3000 says" above the message, it renders the text as an
 * unformatted blob with no emphasis, and on some browsers it offers a "prevent
 * this page from creating more dialogs" checkbox that silently disables every
 * future confirmation — including the one guarding a destructive action.
 *
 * It is also synchronous and blocking, so the button that triggered it cannot
 * show a pending state while the request it guards is in flight.
 *
 * ── The rule for using it ──
 *
 * Only for actions that are hard to undo. A confirmation on a reversible action
 * teaches people to dismiss confirmations, which is how the one that mattered
 * gets clicked through.
 *
 * @param {boolean}  open
 * @param {string}   title        The question, as a question.
 * @param {string}   body         What will actually happen. Never a repeat of the title.
 * @param {string}   [confirmLabel]  The verb, not "OK" — "Remove", "Revoke", "Pause".
 * @param {string}   [cancelLabel]
 * @param {boolean}  [danger]     Red treatment. For destructive, not merely important.
 * @param {() => (void|Promise)} onConfirm  Awaited; the dialog shows a pending
 *                                          state and closes itself on success.
 * @param {() => void} onCancel
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [working, setWorking] = useState(false);

  // Mount/unmount kept in lockstep with `open` at render time rather than in an
  // effect — same pattern as LogoutModal. Only the paint-timing-dependent
  // "animate in" stays in an effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setVisible(true);
      setWorking(false);
    } else {
      setAnimating(false);
    }
  }

  useEffect(() => {
    if (!open) return undefined;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimating(true));
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (open) return undefined;
    const t = setTimeout(() => setVisible(false), 260);
    return () => clearTimeout(t);
  }, [open]);

  // Escape-to-close is deliberately disabled while the action is in flight: the
  // request has already been sent, and dismissing the dialog would leave the
  // operator believing they cancelled something that is already happening.
  const dialogRef = useModalA11y(open, { onClose: working ? () => {} : onCancel });

  const handleConfirm = useCallback(async () => {
    setWorking(true);
    try {
      await onConfirm();
    } catch {
      // The caller owns error reporting (it raises a toast). Restoring the
      // buttons here means a failed action can be retried from the same dialog
      // rather than dumping the operator back to the page with no explanation.
      setWorking(false);
    }
  }, [onConfirm]);

  if (!visible) return null;

  const gold = '#B8944F';
  const charcoal = '#191B1E';
  const ivory = '#F8F4EC';
  const stone = '#5E5A52';
  const border = '#E8E2D6';
  const danger1 = '#B03A2E';
  const danger2 = '#8F2E24';
  const accent = danger ? danger1 : gold;

  return (
    <>
      <div
        onClick={working ? undefined : onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(25, 27, 30, 0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          opacity: animating ? 1 : 0,
          transition: 'opacity 0.26s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

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
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-body"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          style={{
            pointerEvents: 'auto',
            width: '100%',
            maxWidth: '440px',
            background: '#FFFFFF',
            borderRadius: '20px',
            border: `1px solid ${border}`,
            boxShadow: '0 25px 60px rgba(25, 27, 30, 0.18), 0 8px 24px rgba(184, 148, 79, 0.08)',
            overflow: 'hidden',
            transform: animating ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(10px)',
            opacity: animating ? 1 : 0,
            transition:
              'transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.26s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div style={{ height: '3px', background: accent }} />

          <div style={{ padding: '28px 28px 24px' }}>
            <h2
              id="confirm-dialog-title"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '21px',
                fontWeight: 600,
                color: charcoal,
                margin: '0 0 10px',
                letterSpacing: '-0.01em',
                lineHeight: 1.35,
              }}
            >
              {title}
            </h2>

            <p
              id="confirm-dialog-body"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '15px',
                lineHeight: 1.65,
                color: stone,
                margin: '0 0 26px',
              }}
            >
              {body}
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={onCancel}
                disabled={working}
                style={{
                  flex: '1 1 140px',
                  padding: '13px 20px',
                  borderRadius: '12px',
                  border: `1px solid ${border}`,
                  background: '#FFFFFF',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: stone,
                  cursor: working ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: working ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (working) return;
                  e.currentTarget.style.background = ivory;
                  e.currentTarget.style.borderColor = gold;
                  e.currentTarget.style.color = charcoal;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#FFFFFF';
                  e.currentTarget.style.borderColor = border;
                  e.currentTarget.style.color = stone;
                }}
              >
                {cancelLabel}
              </button>

              <button
                onClick={handleConfirm}
                disabled={working}
                style={{
                  flex: '1 1 140px',
                  padding: '13px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: working
                    ? accent
                    : `linear-gradient(135deg, ${accent} 0%, ${danger ? danger2 : '#a6833f'} 100%)`,
                  fontFamily: 'var(--font-sans)',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  cursor: working ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  if (working) return;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {working && (
                  // `spin` is defined once in globals.css.
                  <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                )}
                {working ? 'Working…' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
