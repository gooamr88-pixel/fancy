'use client';

import { useModalA11y } from '../../hooks/useModalA11y';

/**
 * Removing ONE guest, confirmed the way everything else in this dashboard is.
 *
 * ── Why it replaces window.confirm ──
 *
 * Both guest lists used the native dialog while every other destructive or costly
 * action here — clearing the list, cancelling an event, telling guests about a
 * change, logging out, a bulk text — uses a real modal. That inconsistency is not
 * only cosmetic:
 *
 *   • the native dialog is unstyled chrome that several mobile browsers render as
 *     a system-level warning, which reads like a scam prompt on a page that has
 *     just been asking for money;
 *   • it cannot show structure, so the two facts that matter (who, and what goes
 *     with them) had to be crammed into one string with a `\n\n` in it;
 *   • it blocks the main thread, and on iOS Safari it can be suppressed entirely
 *     after enough dialogs — at which point delete silently stops asking.
 *
 * ── And it fixes an actual gap ──
 *
 * The RSVPs list asked "Are you sure you want to delete this RSVP?" — no name, no
 * party size, nothing. On a paginated table reached by a small icon, a dialog that
 * cannot tell you WHICH row you hit is a dialog that cannot catch the mistake it
 * exists to catch. Both lists now name the guest.
 *
 * No typed confirmation, deliberately. That belongs to clearing the whole list;
 * demanding it for one guest would train people to type DELETE without reading.
 */

const C = {
  charcoal: '#191B1E',
  stone: '#77736A',
  border: '#E8E2D6',
  white: '#FFFFFF',
  error: '#C45E5E',
  errorBg: '#FEF2F2',
  errorBorder: '#FECACA',
};

export default function ConfirmRemoveGuestModal({
  /** The party label — the name on the row they pressed. */
  guestName,
  /** How many people the party covers, so a family reads as a family. */
  partySize = 1,
  busy = false,
  onCancel,
  onConfirm,
}) {
  const dialogRef = useModalA11y(true, { onClose: busy ? undefined : onCancel });

  const others = Math.max(0, (Number(partySize) || 1) - 1);
  const name = guestName || 'this guest';

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Remove ${name} from this event`}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(25,27,30,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        background: C.white, borderRadius: 16, width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', fontFamily: 'var(--font-sans)',
      }}>
        <div style={{ padding: '22px 22px 0' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: C.error,
          }}>
            Remove guest
          </div>
          <h2 style={{
            margin: '8px 0 0', fontSize: 20, fontWeight: 600,
            color: C.charcoal, fontFamily: 'var(--font-serif)', lineHeight: 1.3,
          }}>
            Remove {name}
            {others > 0 && <> and the {others} {others === 1 ? 'person' : 'people'} with them</>}?
          </h2>
        </div>

        <div style={{ padding: '14px 22px 0' }}>
          <div style={{
            background: C.errorBg, border: `1px solid ${C.errorBorder}`,
            borderRadius: 10, padding: '12px 14px',
            fontSize: 13, color: C.charcoal, lineHeight: 1.65,
          }}>
            Their reply, their seat and their check-in go too. This cannot be undone.
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: C.stone, lineHeight: 1.6 }}>
            Their invitation link stops working. If they still might come, changing their
            reply keeps the record instead.
          </p>
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
            Keep them
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: '9px 18px', borderRadius: 9, border: 'none',
              background: C.error, color: C.white, fontSize: 12.5, fontWeight: 700,
              fontFamily: 'var(--font-sans)', cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
