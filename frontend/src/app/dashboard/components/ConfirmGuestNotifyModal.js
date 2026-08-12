'use client';

import { useState } from 'react';
import { useModalA11y } from '../../hooks/useModalA11y';

/**
 * The confirm dialog in front of anything that contacts every guest at once.
 *
 * ── Why this exists ──
 *
 * Changing a venue or cancelling an event used to notify guests as a side effect
 * of saving. That was survivable while it was email-only: an unwanted email is
 * free and mildly annoying. It is not survivable now that the same moment can
 * text several hundred people — saving a typo'd venue, noticing, and saving the
 * correction would spend an organizer's allowance twice before any dialog
 * appeared.
 *
 * So the save proposes and this confirms. The rule it enforces is simple: no
 * message reaches a guest without someone having read a sentence containing the
 * number of people it will reach and what it will cost.
 *
 * ── Why the numbers are so prominent ──
 *
 * "Notify guests?" is a coin flip. "118 guests will be emailed, 74 will also get
 * a text, using about 148 of your 1,600 messages" is a decision. The organizer is
 * often older and not technical, and the difference between those two sentences
 * is whether they can hold themselves responsible for the outcome.
 *
 * No <style jsx>: this renders inside other components' trees, where a scoped
 * rule declared here would silently match nothing.
 */

const C = {
  gold: '#B8944F',
  goldHover: '#a6833f',
  charcoal: '#191B1E',
  stone: '#77736A',
  border: '#E8E2D6',
  softBg: '#FAFAF8',
  error: '#C45E5E',
  white: '#FFFFFF',
};

export default function ConfirmGuestNotifyModal({
  open,
  onClose,
  onConfirm,
  /** 'change' | 'cancel' — the two things worth interrupting someone for. */
  mode = 'change',
  /** What actually changed, e.g. ['date', 'venue']. */
  changed = [],
  /** How many parties would be emailed. */
  parties = null,
  /** How many of those have consented to texts. */
  smsReachable = null,
  /** Messages left in the wallet; null when SMS was never bought. */
  smsRemaining = null,
  /** Roughly what texting them would consume. */
  estimatedSegments = null,
  busy = false,
}) {
  const [sendSms, setSendSms] = useState(true);
  const [reason, setReason] = useState('');

  /**
   * Re-arm on every open. A dialog that remembers the last run's choices is how
   * somebody sends a cancellation they meant to send silently.
   *
   * Reset during RENDER on the closed→open transition, not in an effect. The
   * effect version was a synchronous setState in an effect — a cascading render,
   * and a `react-hooks/set-state-in-effect` error that has been failing lint on
   * this file. It also committed the PREVIOUS run's choices for one frame, which
   * on this particular dialog means briefly showing "also send a text" ticked
   * for someone who unticked it last time.
   */
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) { setSendSms(true); setReason(''); }
  }

  // The focus trap, scroll lock, Escape handler and focus restore every other
  // dialog in this dashboard has. Without it Tab walked out of an open
  // cancellation dialog into the page behind it, and Escape did nothing.
  const dialogRef = useModalA11y(open, { onClose: busy ? undefined : onClose });

  if (!open) return null;

  const isCancel = mode === 'cancel';
  const smsAvailable = smsRemaining !== null && smsRemaining !== undefined;
  const canText = smsAvailable && (smsReachable || 0) > 0;
  const notEnough = canText && estimatedSegments !== null && estimatedSegments > smsRemaining;

  const changedLabel = changed.length
    ? changed.map((c) => (c === 'date' ? 'date and time' : c)).join(' and ')
    : 'details';

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(25,27,30,0.55)',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        background: C.white, borderRadius: 16, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ padding: '22px 22px 0' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: isCancel ? C.error : C.gold, fontFamily: 'var(--font-sans)',
          }}>
            {isCancel ? 'Cancel this event' : 'Tell your guests'}
          </div>
          <h2 style={{
            margin: '8px 0 0', fontSize: 21, fontWeight: 600,
            color: C.charcoal, fontFamily: 'var(--font-serif)', lineHeight: 1.25,
          }}>
            {isCancel
              ? 'This cannot be undone'
              : `You changed the ${changedLabel}`}
          </h2>
        </div>

        <div style={{ padding: '14px 22px 0' }}>
          <p style={{ margin: 0, fontSize: 14, color: C.stone, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
            {isCancel
              ? 'Your guests will be told the event is cancelled, RSVPs will close, and the event page will show a cancellation notice. Your guest list and records are kept.'
              : 'Everyone you have invited who has not declined — including guests who have not replied yet — does not know. Would you like to tell them?'}
          </p>

          {/* The numbers. Everything above is context; this is the decision. */}
          <div style={{
            marginTop: 14, padding: '13px 15px', borderRadius: 10,
            background: C.softBg, border: `1px solid ${C.border}`,
          }}>
            <Row
              label="By email"
              value={parties === null ? '—' : `${parties} ${parties === 1 ? 'guest' : 'guests'}`}
              note="Always sent. Email costs nothing."
            />
            {smsAvailable && (
              <Row
                label="By text"
                value={
                  !sendSms ? 'Not sending'
                    : smsReachable === null ? '—'
                      : `${smsReachable} ${smsReachable === 1 ? 'guest' : 'guests'}`
                }
                note={
                  !sendSms ? null
                    : estimatedSegments !== null
                      ? `About ${estimatedSegments} of your ${smsRemaining.toLocaleString()} messages`
                      : null
                }
                muted={!sendSms}
              />
            )}
            {/* Named plainly rather than hidden. An organizer who does not know
                why 44 people are missing assumes the product lost them. */}
            {smsAvailable && parties !== null && smsReachable !== null && parties > smsReachable && (
              <div style={{ fontSize: 12, color: C.stone, marginTop: 8, fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
                The other {parties - smsReachable} have no number on file, have not agreed to texts, or replied STOP. They still get the email.
              </div>
            )}
          </div>

          {smsAvailable && (smsReachable || 0) > 0 && (
            <label style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 9, marginTop: 13,
              cursor: 'pointer', fontSize: 13, color: C.charcoal, fontFamily: 'var(--font-sans)',
            }}>
              <input
                type="checkbox"
                checked={sendSms}
                onChange={(e) => setSendSms(e.target.checked)}
                style={{ marginTop: 2, accentColor: C.gold, width: 15, height: 15 }}
              />
              <span>Also send a text to the {smsReachable} {smsReachable === 1 ? 'guest' : 'guests'} who agreed to them</span>
            </label>
          )}

          {notEnough && sendSms && (
            <div style={{
              marginTop: 11, padding: '9px 12px', borderRadius: 8,
              background: 'rgba(196,94,94,0.07)', border: '1px solid rgba(196,94,94,0.2)',
              fontSize: 12, color: C.error, fontFamily: 'var(--font-sans)', lineHeight: 1.5,
            }}>
              You do not have enough messages for everyone. Those we cannot text will still get the email.
            </div>
          )}

          {isCancel && (
            <div style={{ marginTop: 15 }}>
              <label style={{
                display: 'block', fontSize: 12, fontWeight: 700, color: C.charcoal,
                marginBottom: 6, fontFamily: 'var(--font-sans)',
              }}>
                A note to your guests <span style={{ fontWeight: 400, color: C.stone }}>(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="We are so sorry — the venue has flooded and we have had to call it off."
                style={{
                  width: '100%', padding: '9px 11px', borderRadius: 8,
                  border: `1px solid ${C.border}`, fontSize: 13, color: C.charcoal,
                  fontFamily: 'var(--font-sans)', resize: 'vertical', lineHeight: 1.5,
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: 11, color: C.stone, marginTop: 5, fontFamily: 'var(--font-sans)' }}>
                Shown to guests in your own words. {500 - reason.length} characters left.
              </div>
            </div>
          )}
        </div>

        <div style={{
          display: 'flex', gap: 9, justifyContent: 'flex-end', flexWrap: 'wrap',
          padding: '18px 22px 22px',
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '9px 16px', minHeight: 'var(--fx-touch)', borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.white, color: C.charcoal, fontSize: 13, fontWeight: 600,
              fontFamily: 'var(--font-sans)', cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {isCancel ? 'Keep the event' : 'Not now'}
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ sendSms: sendSms && canText, reason: reason.trim() || null })}
            disabled={busy}
            style={{
              padding: '9px 18px', minHeight: 'var(--fx-touch)', borderRadius: 8, border: 'none',
              background: busy ? C.stone : (isCancel ? C.error : C.gold),
              color: C.white, fontSize: 13, fontWeight: 700,
              fontFamily: 'var(--font-sans)', cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy
              ? 'Sending…'
              : isCancel
                ? 'Cancel event and tell guests'
                : `Tell ${parties === null ? 'my guests' : `${parties} ${parties === 1 ? 'guest' : 'guests'}`}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, note, muted = false }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline',
      gap: 12, padding: '4px 0', opacity: muted ? 0.5 : 1,
    }}>
      <div style={{ fontSize: 13, color: C.stone, fontFamily: 'var(--font-sans)' }}>{label}</div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.charcoal, fontFamily: 'var(--font-sans)' }}>{value}</div>
        {note && <div style={{ fontSize: 11, color: C.stone, fontFamily: 'var(--font-sans)' }}>{note}</div>}
      </div>
    </div>
  );
}
