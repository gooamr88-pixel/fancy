'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * The four things you can send ONE guest, named, and grouped by how they arrive.
 *
 * ── What this replaces ──
 *
 * A row of six 44px squares: edit, email-invitation, text-invitation,
 * resend-confirmation, send-QR-pass, delete. Six different actions — one of which
 * bills per segment and one of which deletes a guest — distinguished only by small
 * SVG glyphs, with their meaning in a `title` attribute. `title` is a desktop
 * hover tooltip: it is never shown on touch and is not reliably announced. So on a
 * phone the row was six unlabelled squares.
 *
 * Two of the glyphs were a paper plane and an envelope, sitting adjacent, and the
 * code comment beside them admitted the problem in as many words: "The two sit
 * next to each other in the same row, so they must not share a glyph."
 *
 * ── Why grouped by channel ──
 *
 * The organizer asked for the email actions distinguishable in one place and the
 * text actions in another, and that grouping happens to carry the only distinction
 * that actually matters here: **email is free, text costs money.** A heading per
 * group states it once, rather than repeating a price on four buttons or leaving it
 * unsaid.
 *
 * ── Why a menu and not more buttons ──
 *
 * Four full-width labelled send buttons per row, times twenty rows, is a wall. The
 * two highest-frequency actions stay visible in the row; these four live behind one
 * labelled "Send" button, where each has room for a sentence explaining what the
 * guest will receive. An organizer who is not sure what "entry pass" means can read
 * it here instead of guessing from a ticket icon.
 */

const C = {
  gold: '#B8944F',
  charcoal: '#191B1E',
  stone: '#77736A',
  border: '#E8E2D6',
  white: '#FFFFFF',
  ivory: '#F8F4EC',
  hover: '#FDFCF9',
  greenDark: '#3D7A3D',
};

export default function GuestSendMenu({
  guestName,
  /** ({ channel }) => void — 'email' | 'qr' | 'sms' | 'detail-sms' */
  onSend,
  /** Truthy while any send for this guest is in flight. */
  busy = false,
  /** Whether this event bought texting at all. */
  smsActive = false,
  /** { reachable, label } from smsReachability — why this guest cannot be texted. */
  reach = null,
  /** Only an accepted guest has a seat and a pass to be told about. */
  attending = false,
  /** Called when texting is locked, to route to the purchase page. */
  onBuySms,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on an outside click or Escape. Registered only while open, so a page of
  // twenty rows is not carrying twenty idle document listeners.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const textBlocked = !smsActive ? 'Texting is not switched on for this event'
    : !reach?.reachable ? (reach?.label || 'This guest cannot be texted')
      : null;

  const groups = [
    {
      id: 'email',
      heading: 'By email',
      note: 'Free',
      noteColor: C.greenDark,
      items: [
        {
          channel: 'email',
          label: 'The invitation',
          hint: 'Their invitation card and a link to reply.',
          disabled: null,
        },
        {
          channel: 'qr',
          label: 'Entry pass & table',
          hint: attending
            ? 'A scannable pass for the door, plus where they are sitting.'
            : 'Only for guests who accepted — they have no seat yet.',
          disabled: attending ? null : 'This guest has not accepted yet',
        },
      ],
    },
    {
      id: 'sms',
      heading: 'By text message',
      // Said once per group rather than on each button. The organizer is paying per
      // segment and has a right to see that before pressing, not after.
      note: 'Uses your message balance',
      noteColor: C.gold,
      items: [
        {
          channel: 'sms',
          label: 'The invitation',
          hint: 'A short text with a link to their invitation.',
          disabled: textBlocked,
        },
        {
          channel: 'detail-sms',
          label: 'All their details',
          hint: attending
            ? 'Date, venue, their table, who is with them, the meals, and their pass link — in the message itself.'
            : 'Only for guests who accepted — there are no details to send yet.',
          disabled: textBlocked || (attending ? null : 'This guest has not accepted yet'),
        },
      ],
    },
  ];

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Send something to ${guestName || 'this guest'}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 12px', minHeight: 40,
          borderRadius: 8, border: `1px solid ${open ? C.gold : C.border}`,
          background: open ? C.ivory : C.white,
          color: open ? C.gold : C.charcoal,
          fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)',
          cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap',
          opacity: busy ? 0.6 : 1,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" />
        </svg>
        {busy ? 'Sending…' : 'Send'}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60,
            width: 292, maxWidth: 'calc(100vw - 32px)',
            background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            padding: 6, textAlign: 'left',
          }}
        >
          {groups.map((group, gi) => (
            <div key={group.id} style={{ marginTop: gi === 0 ? 0 : 4 }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
                padding: '8px 10px 6px',
              }}>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
                  color: C.stone, fontFamily: 'var(--font-sans)',
                }}>{group.heading}</span>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, color: group.noteColor, fontFamily: 'var(--font-sans)',
                  whiteSpace: 'nowrap',
                }}>{group.note}</span>
              </div>

              {group.items.map((item) => {
                const locked = !!item.disabled;
                // Texting locked because it was never bought is the one "disabled"
                // that has an action behind it, so it stays clickable and routes to
                // the purchase page instead of being a dead row.
                const buyInstead = locked && !smsActive && group.id === 'sms';
                return (
                  <button
                    key={item.channel}
                    type="button"
                    role="menuitem"
                    disabled={locked && !buyInstead}
                    title={locked ? item.disabled : undefined}
                    onClick={() => {
                      setOpen(false);
                      if (buyInstead) { onBuySms?.(); return; }
                      if (!locked) onSend?.(item.channel);
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '9px 10px', borderRadius: 8, border: 'none',
                      background: 'transparent',
                      cursor: locked && !buyInstead ? 'not-allowed' : 'pointer',
                      opacity: locked && !buyInstead ? 0.5 : 1,
                      fontFamily: 'var(--font-sans)',
                    }}
                    onMouseEnter={(e) => { if (!locked || buyInstead) e.currentTarget.style.background = C.hover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.charcoal }}>
                      {item.label}
                    </span>
                    <span style={{ display: 'block', fontSize: 11.5, color: C.stone, lineHeight: 1.5, marginTop: 2 }}>
                      {locked ? item.disabled : item.hint}
                    </span>
                    {buyInstead && (
                      <span style={{ display: 'block', fontSize: 11.5, color: C.gold, fontWeight: 700, marginTop: 3 }}>
                        Add texting →
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
