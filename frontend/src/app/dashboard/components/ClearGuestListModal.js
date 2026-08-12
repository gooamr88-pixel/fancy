'use client';

import { useState, useEffect } from 'react';
import { useModalA11y } from '../../hooks/useModalA11y';

/**
 * The confirm in front of "remove every guest on this event".
 *
 * ── Why this exists ──
 *
 * The workflow it serves is export → edit in Excel → clear → re-import. Without
 * a way to clear, organizers were reaching for Delete Event, which destroys the
 * seating chart, the tables, the settings and the event itself — a far larger
 * mistake made in pursuit of a smaller one.
 *
 * ── Why it lists what SURVIVES as well as what goes ──
 *
 * The fear that stops someone using this is "will I lose my seating chart?" —
 * and the answer is no: tables and layout are untouched, which is exactly what
 * makes a re-import able to put everyone back on the same tables. Saying so is
 * not reassurance for its own sake; it is the fact that makes the feature usable.
 *
 * Everything else is stated plainly, in counts, because a warning that says
 * "this cannot be undone" without saying what "this" contains is a warning
 * nobody can act on. The check-in count in particular is one organizers do not
 * think of until it is gone.
 *
 * ── Why typing DELETE ──
 *
 * There is no undo and no soft delete behind this. A misplaced click on a
 * primary-coloured button is not a decision; typing a word is.
 *
 * No <style jsx>: this renders inside another component's tree, where a scoped
 * rule declared here would silently match nothing (see frontend/AGENTS.md).
 */

const C = {
  gold: '#B8944F',
  charcoal: '#191B1E',
  stone: '#77736A',
  border: '#E8E2D6',
  softBg: '#FAFAF8',
  error: '#C45E5E',
  errorBg: '#FEF2F2',
  errorBorder: '#FECACA',
  success: '#3D7A3D',
  white: '#FFFFFF',
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/** "3 guests" / "1 guest" — the counts appear in prose, so they have to agree. */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Mounted only while it is open — the caller renders `{isOpen && <this />}`
 * rather than passing an `open` flag.
 *
 * That is not a style preference. A dialog that stays mounted has to re-arm its
 * own state on every open, and doing that in an effect is a synchronous setState
 * in an effect body: a cascading render, and an error under this repo's
 * `react-hooks/set-state-in-effect` rule. Mounting fresh means there is nothing
 * to re-arm — a typed "DELETE" from a previous visit cannot survive into a new
 * one, which for this particular dialog is a correctness property, not tidiness.
 */
export default function ClearGuestListModal({ onClose, eventId, onCleared }) {
  const [summary, setSummary] = useState(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /**
   * Focus trap, Escape-to-close, scroll lock, focus restore — the same hook
   * ImportGuestsModal uses, so the destructive dialog is not the one modal in
   * the product a keyboard user can tab out of while it is still open.
   *
   * Always `true`: this component only exists while it is open.
   *
   * `onClose` is passed straight through rather than gated on `busy`. Gating it
   * would change the callback's identity the moment a delete starts, and the
   * hook's effect is keyed on that identity — so it would tear down and re-arm
   * mid-request, bouncing focus out to the trigger button and back. Escaping
   * during the delete is harmless: the request is already in flight, and
   * `onCleared` still reaches the parent, which owns the toast and the refresh.
   */
  const dialogRef = useModalA11y(true, { onClose });

  /**
   * Load the counts on mount — that is, when the dialog opens.
   *
   * Three counts nobody asked for on every visit to the guests tab would be
   * three queries per page load to answer a question almost no one is asking.
   *
   * An inline async IIFE rather than a useCallback the effect then calls: the
   * lint rule treats the latter as a set-state-in-effect violation too.
   */
  useEffect(() => {
    if (!eventId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/events/${eventId}/rsvps/clear-preview`, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || data.success === false) throw new Error(data.message || 'Could not read your guest list.');
        setSummary(data.data || data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not read your guest list.');
      }
    })();
    return () => { cancelled = true; };
  }, [eventId]);

  const parties = summary?.parties ?? null;
  const nothingToDo = parties === 0;
  // Guarded on the count having LOADED, not merely on the word: confirming
  // against a list whose size is unknown is the stale-tab case the server's
  // expectedParties check exists for, and it should not be reachable from here.
  const canConfirm = !busy && summary !== null && !nothingToDo && typed.trim().toUpperCase() === 'DELETE';

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}/rsvps`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        // The count this dialog actually showed. If a guest RSVP'd while the
        // organizer was reading, the server refuses rather than deleting
        // somebody who was never in the sentence they agreed to.
        body: JSON.stringify({ confirm: 'DELETE', expectedParties: parties }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || 'Could not clear the guest list.');
      onCleared?.((data.data || data).message || 'Guest list cleared.');
      onClose();
    } catch (err) {
      setError(err.message || 'Could not clear the guest list.');
    } finally {
      setBusy(false);
    }
  };

  const row = (label, value, tone = C.charcoal) => (
    <div style={{
      display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12,
      fontSize: 13, padding: '5px 0', fontFamily: 'var(--font-sans)', color: C.stone,
    }}>
      <span>{label}</span>
      <strong style={{ color: tone, whiteSpace: 'nowrap' }}>{value}</strong>
    </div>
  );

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Clear the guest list"
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
            color: C.error, fontFamily: 'var(--font-sans)',
          }}>
            Start the guest list again
          </div>
          <h2 style={{
            margin: '8px 0 0', fontSize: 21, fontWeight: 600,
            color: C.charcoal, fontFamily: 'var(--font-serif)', lineHeight: 1.25,
          }}>
            This cannot be undone
          </h2>
        </div>

        <div style={{ padding: '16px 22px 0' }}>
          {summary === null && !error && (
            <p style={{ margin: 0, fontSize: 13.5, color: C.stone, fontFamily: 'var(--font-sans)' }}>
              Checking what is on your list…
            </p>
          )}

          {nothingToDo && (
            <p style={{ margin: 0, fontSize: 13.5, color: C.stone, fontFamily: 'var(--font-sans)' }}>
              There are no guests on this event yet, so there is nothing to remove.
            </p>
          )}

          {summary !== null && !nothingToDo && (
            <>
              <p style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.6, color: C.charcoal, fontFamily: 'var(--font-sans)' }}>
                Every guest on this event will be removed, along with everything recorded
                about them.
              </p>

              <div style={{
                background: C.errorBg, border: `1px solid ${C.errorBorder}`,
                borderRadius: 10, padding: '12px 14px', marginBottom: 12,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: C.error, marginBottom: 6, fontFamily: 'var(--font-sans)',
                }}>
                  Removed
                </div>
                {row('Guests on the list', plural(summary.parties, 'guest', 'guests'))}
                {row('People in total', plural(summary.guests, 'person', 'people'))}
                {row('Their answers, and who you have already invited', 'All')}
                {summary.seated > 0 && row('Seated at a table', plural(summary.seated, 'guest', 'guests'), C.error)}
                {/* The one organizers do not think of. On the day of an event,
                    clearing the list erases the door record. */}
                {summary.checkedIn > 0 && row('Already checked in at the door', plural(summary.checkedIn, 'person', 'people'), C.error)}
                {/* Consent lives on the party row, so it goes with it. The
                    append-only consent LOG survives, but that is a compliance
                    record — it does not make anyone textable again. */}
                {summary.textable > 0 && row('Permission to text them', plural(summary.textable, 'guest', 'guests'), C.error)}
              </div>

              <div style={{
                background: C.softBg, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '12px 14px', marginBottom: 14,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: C.success, marginBottom: 6, fontFamily: 'var(--font-sans)',
                }}>
                  Kept
                </div>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: C.stone, fontFamily: 'var(--font-sans)' }}>
                  Your tables and seating layout, the event and all its settings, your
                  message balance, and your record of what has been sent.
                </p>
              </div>

              <p style={{ margin: '0 0 14px', fontSize: 12.5, lineHeight: 1.6, color: C.stone, fontFamily: 'var(--font-sans)' }}>
                Because your tables are kept, re-uploading a file with a <strong>table_name</strong> column
                puts everyone back where they were. Download your guest list first if you have not already.
              </p>

              <label
                htmlFor="clear-guests-confirm"
                style={{
                  display: 'block', fontSize: 12, fontWeight: 700, color: C.charcoal,
                  marginBottom: 6, fontFamily: 'var(--font-sans)',
                }}
              >
                Type DELETE to confirm
              </label>
              <input
                id="clear-guests-confirm"
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={busy}
                autoComplete="off"
                placeholder="DELETE"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 13px',
                  border: `1px solid ${C.border}`, borderRadius: 9,
                  fontSize: 14, fontFamily: 'var(--font-sans)', color: C.charcoal,
                  background: C.white, outline: 'none',
                }}
              />
            </>
          )}

          {error && (
            <p style={{
              margin: '12px 0 0', fontSize: 12.5, color: C.error,
              fontFamily: 'var(--font-sans)', lineHeight: 1.5,
            }}>
              {error}
            </p>
          )}
        </div>

        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8,
          padding: '18px 22px 22px',
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '9px 18px', minHeight: 'var(--fx-touch)', borderRadius: 9, border: `1px solid ${C.border}`,
              background: C.white, color: C.charcoal, fontSize: 12.5, fontWeight: 700,
              fontFamily: 'var(--font-sans)', cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {nothingToDo ? 'Close' : 'Keep my guests'}
          </button>
          {!nothingToDo && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              style={{
                padding: '9px 18px', minHeight: 'var(--fx-touch)', borderRadius: 9, border: 'none',
                background: canConfirm ? C.error : '#C9C4BA',
                color: C.white, fontSize: 12.5, fontWeight: 700,
                fontFamily: 'var(--font-sans)',
                cursor: busy ? 'wait' : canConfirm ? 'pointer' : 'not-allowed',
              }}
            >
              {busy ? 'Removing…' : 'Remove every guest'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
