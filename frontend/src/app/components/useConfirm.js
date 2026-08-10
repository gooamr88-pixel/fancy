'use client';

import { useCallback, useState } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';

/**
 * A styled replacement for `window.confirm` that is still awaitable.
 *
 * ── Why awaitable matters ──
 *
 * The remaining native confirms in this app sit in the middle of async flows:
 *
 *     if (!window.confirm('Overbook and save anyway?')) return;
 *     …
 *     if (capacityIssue && window.confirm(msg)) return saveSeating(true);
 *
 * A callback-and-state modal cannot drop into those — the function has to be torn
 * into "ask" and "resume" halves, which for a drag-and-drop save path means
 * restructuring logic that currently works. A promise keeps the call site as one
 * readable line and changes only the dialog that appears.
 *
 * ── Usage ──
 *
 *     const [confirm, confirmDialog] = useConfirm();
 *     …
 *     if (!(await confirm({ title: 'Delete Table 7?', tone: 'danger' }))) return;
 *     …
 *     return (<>{yourUi}{confirmDialog}</>);
 *
 * Resolving `false` on cancel, dismiss and Escape means a call site can never hang
 * waiting on a dialog the organizer walked away from.
 */

const C = {
  charcoal: '#191B1E',
  stone: '#77736A',
  border: '#E8E2D6',
  white: '#FFFFFF',
  gold: '#B8944F',
  error: '#C45E5E',
  errorBg: '#FEF2F2',
  errorBorder: '#FECACA',
};

function ConfirmDialog({
  title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'default', onResolve,
}) {
  const danger = tone === 'danger';
  const dialogRef = useModalA11y(true, { onClose: () => onResolve(false) });

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onResolve(false); }}
      style={{
        // Above every other modal in the app: this one is asked FROM inside
        // another dialog (the guest editor), and a confirmation rendering behind
        // the thing it is confirming would be invisible and would deadlock the
        // await.
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(25,27,30,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        background: C.white, borderRadius: 16, width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', fontFamily: 'var(--font-sans)',
      }}>
        <div style={{ padding: '22px 22px 0' }}>
          <h2 style={{
            margin: 0, fontSize: 19, fontWeight: 600, lineHeight: 1.3,
            color: C.charcoal, fontFamily: 'var(--font-serif)',
          }}>
            {title}
          </h2>
        </div>

        {body && (
          <div style={{ padding: '12px 22px 0' }}>
            <div style={{
              background: danger ? C.errorBg : '#FAFAF8',
              border: `1px solid ${danger ? C.errorBorder : C.border}`,
              borderRadius: 10, padding: '12px 14px',
              fontSize: 13, color: C.charcoal, lineHeight: 1.65,
            }}>
              {body}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '18px 22px 22px' }}>
          <button
            type="button"
            onClick={() => onResolve(false)}
            style={{
              padding: '9px 18px', borderRadius: 9, border: `1px solid ${C.border}`,
              background: C.white, color: C.charcoal, fontSize: 12.5, fontWeight: 700,
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onResolve(true)}
            style={{
              padding: '9px 18px', borderRadius: 9, border: 'none',
              background: danger ? C.error : C.gold, color: C.white,
              fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [pending, setPending] = useState(null); // { opts, resolve }

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setPending({ opts: opts || {}, resolve });
  }), []);

  const resolveWith = useCallback((value) => {
    setPending((cur) => {
      cur?.resolve(value);
      return null;
    });
  }, []);

  const dialog = pending
    ? <ConfirmDialog {...pending.opts} onResolve={resolveWith} />
    : null;

  return [confirm, dialog];
}
