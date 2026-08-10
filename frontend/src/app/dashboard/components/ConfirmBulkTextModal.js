'use client';

import { useModalA11y } from '../../hooks/useModalA11y';

/**
 * The dialog that stands between one click and a bill.
 *
 * ── Why it had to exist ──
 *
 * "Text invitation (74)" sent 74 charged messages on a single click, with no
 * confirmation and no undo. Worse, the backend had been written on the assumption
 * that this dialog existed: invitationService deliberately timestamps its
 * idempotency ref so a repeat press re-sends, and justifies it with "an organizer
 * pressing the button again is stating intent, and the confirm dialog already told
 * them the cost". There was no such dialog. One side of a contract was
 * implemented; the other was a comment.
 *
 * ── Why it states messages and not money ──
 *
 * The organizer bought a balance denominated in messages, and that is the unit
 * every other screen uses. Converting to currency here would introduce a second
 * unit and a rounding argument on the one screen where they need to be certain.
 * Segments-per-guest is the honest multiplier: a detail text is measurably longer
 * than an invitation, so it costs more per guest, and saying so is the whole point.
 */

const C = {
  gold: '#B8944F',
  charcoal: '#191B1E',
  stone: '#77736A',
  border: '#E8E2D6',
  softBg: '#FAFAF8',
  white: '#FFFFFF',
  error: '#C45E5E',
  errorBg: '#FEF2F2',
};

/**
 * Segments per message, measured with backend/utils/smsSegments against the real
 * 78-character compliance footer — not estimated.
 *
 * These are the same figures the allowance estimator prices from. If the templates
 * change materially, both move together; a number here that drifted from the
 * server's would make this dialog a comforting lie.
 */
const SEGMENTS = {
  sms: { latin: 2, arabic: 3, what: 'the invitation' },
  'detail-sms': { latin: 3, arabic: 6, what: 'their full details' },
};

export default function ConfirmBulkTextModal({ channel, count, remaining, onCancel, onConfirm, busy = false }) {
  const dialogRef = useModalA11y(true, { onClose: busy ? undefined : onCancel });

  const spec = SEGMENTS[channel] || SEGMENTS.sms;
  // Quoted at the Latin rate with Arabic named separately, rather than averaging
  // the two into a number that is wrong for everybody.
  const estimate = count * spec.latin;
  const arabicEstimate = count * spec.arabic;
  const short = remaining !== null && remaining !== undefined && estimate > remaining;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm sending text messages"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(25,27,30,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        background: C.white, borderRadius: 16, width: '100%', maxWidth: 440,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ padding: '22px 22px 0' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: C.gold, fontFamily: 'var(--font-sans)',
          }}>
            Send text messages
          </div>
          <h2 style={{
            margin: '8px 0 0', fontSize: 21, fontWeight: 600,
            color: C.charcoal, fontFamily: 'var(--font-serif)', lineHeight: 1.25,
          }}>
            Text {spec.what} to {count} {count === 1 ? 'guest' : 'guests'}?
          </h2>
        </div>

        <div style={{ padding: '16px 22px 0', fontFamily: 'var(--font-sans)' }}>
          <div style={{
            background: C.softBg, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '12px 14px',
          }}>
            {[
              ['Guests who will receive it', `${count}`],
              ['Messages this uses', `about ${estimate}`],
              ...(remaining !== null && remaining !== undefined
                ? [['Your balance', `${remaining} left`]] : []),
            ].map(([label, value]) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', gap: 12,
                fontSize: 13, padding: '4px 0', color: C.stone,
              }}>
                <span>{label}</span>
                <strong style={{ color: C.charcoal, whiteSpace: 'nowrap' }}>{value}</strong>
              </div>
            ))}
          </div>

          {/* Said plainly rather than folded into an average. Arabic forces a
              different encoding — 70 characters a segment instead of 160 — so the
              same message genuinely costs more, and an organizer texting an Arabic
              guest list needs the number that applies to them. */}
          <p style={{ margin: '10px 0 0', fontSize: 12, color: C.stone, lineHeight: 1.6 }}>
            Guests who chose Arabic use more — about {arabicEstimate} for this group.
            Only guests who agreed to texts are included.
          </p>

          {short && (
            <p style={{
              margin: '12px 0 0', padding: '10px 12px', borderRadius: 9,
              background: C.errorBg, border: '1px solid #FECACA',
              fontSize: 12.5, color: C.error, lineHeight: 1.55,
            }}>
              This is more than your balance. The ones that fit will send, and the rest
              will be told by email instead — nobody is left out.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '18px 22px 22px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '9px 18px', borderRadius: 9, border: `1px solid ${C.border}`,
              background: C.white, color: C.charcoal, fontSize: 12.5, fontWeight: 700,
              fontFamily: 'var(--font-sans)', cursor: busy ? 'wait' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: '9px 18px', borderRadius: 9, border: 'none',
              background: 'linear-gradient(135deg, #D7BE80 0%, #B8944F 100%)',
              color: C.white, fontSize: 12.5, fontWeight: 700,
              fontFamily: 'var(--font-sans)', cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? 'Sending…' : `Send to ${count}`}
          </button>
        </div>
      </div>
    </div>
  );
}
