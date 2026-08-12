'use client';

/**
 * CHROME THAT COLLAPSES ON A PHONE, AND IS UNTOUCHED ON A DESKTOP.
 *
 * ── What this is for ──
 *
 * Every dashboard section is a desktop layout stacked vertically, which puts
 * the description of the thing above the thing. Guest list opens with six stat
 * tiles, an SMS banner, a spreadsheet guide and a search bar before the first
 * guest — about three screens of chrome on a 667px-tall phone. Invitations &
 * replies does the same with four summary cards.
 *
 * Wrapping that chrome in this component turns it into one tappable line on a
 * phone, and changes nothing at all at md and up.
 *
 * ── Why it renders one thing and not two ──
 *
 * The summary line and the full chrome are the same markup at every width; the
 * `.fx-disclose__*` rules in globals.css decide which is visible. Rendering a
 * separate mobile version of the stat tiles would be a second copy of the same
 * numbers to keep in sync, and this dashboard has already shipped that bug more
 * than once (the guest-list export existed in three places and produced two
 * different files).
 *
 * It also means no `useMediaQuery` and therefore no hydration mismatch: the
 * server and the client render identical markup and CSS resolves the rest.
 *
 * ── Why the open state can be "wrong" and it does not matter ──
 *
 * `open` is React state, so an organizer who expands the tiles on their phone
 * and then rotates to a wide tablet carries `open: true` across. The md rule
 * forces the body visible with `!important` regardless, so the only observable
 * effect is that a state nobody can see is set — which is the correct trade for
 * not measuring the viewport in JavaScript.
 */

import React, { useId, useState } from 'react';

const COLORS = {
  gold: '#B8944F', charcoal: '#191B1E', stone: '#77736A',
  border: '#E8E2D6', white: '#FFFFFF',
};

export default function MobileDisclosure({
  /** The one line shown in place of the chrome, e.g. "120 guests · 84 accepted". */
  summary,
  /** What the button is called to a screen reader, e.g. "guest counts". */
  label,
  /** The chrome itself — rendered as-is at md and up. */
  children,
  /** Rarely: start expanded on a phone too. */
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <div>
      {/* Hidden at md and up by CSS, never by a viewport check in JS. */}
      <button
        type="button"
        className="fx-disclose__summary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        style={{
          width: '100%', minHeight: 'var(--fx-touch)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10,
          padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
          background: COLORS.white, border: `1px solid ${COLORS.border}`,
          font: 'inherit', textAlign: 'left', fontFamily: 'var(--font-sans)',
        }}
      >
        <span style={{
          minWidth: 0, fontSize: 'var(--fx-meta)', fontWeight: 600,
          color: COLORS.charcoal, lineHeight: 1.5,
        }}>
          {summary}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
          fontSize: 'var(--fx-micro)', fontWeight: 700, color: COLORS.gold,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {open ? 'Hide' : 'Details'}
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {/* A plain wrapper with NO inline display: the children keep their own
          `display: grid`, and an inline display here would beat the rules that
          hide and show this. */}
      {/* The spacing lives on the --open rule in globals.css, not inline. Inline
          it would have to be `open ? 12 : 0`, and at md the body is force-shown
          while `open` may still be false — giving the chrome no gap above it on
          exactly the viewport where it is always visible. */}
      <div
        id={bodyId}
        role="group"
        aria-label={label}
        className={`fx-disclose__body${open ? ' fx-disclose__body--open' : ''}`}
      >
        {children}
      </div>
    </div>
  );
}
