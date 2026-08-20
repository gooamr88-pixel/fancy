'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * "That link didn't work" — shown when a guest arrives from a short link that
 * could not be resolved (`/i/<code>` → `/?link=invalid`).
 *
 * ── Why this exists ──
 *
 * The redirect handler has always sent dead links to the homepage rather than a
 * 404, on the reasoning that someone holding a broken invitation is a guest, not
 * an error. That reasoning is right and the implementation was only half of it:
 * the guest landed on a marketing page for a product they have never heard of,
 * with no indication that anything had gone wrong, and a query parameter that
 * nothing on the site read. For the whole period the redirect was broken, every
 * guest who tapped an invitation saw exactly this and had no way to know.
 *
 * ── Why a client component behind Suspense ──
 *
 * The homepage is a static Server Component. Giving it `searchParams` would opt
 * the entire landing page — hero, press, testimonials, the lot — out of static
 * generation to render one banner that almost nobody sees. Reading the query
 * string on the client keeps the page static; `useSearchParams` (rather than an
 * effect over window.location) keeps it out of the repo's
 * set-state-in-effect rule and out of a hydration mismatch.
 *
 * ── Why it does not offer to "try again" ──
 *
 * There is nothing to retry: the code did not resolve. What actually helps a
 * guest here is the two things below — search for the event by name, or go back
 * to whoever sent the message.
 */

/* The FOURTH private copy of the brand colours in this folder, and the last
   one left. It is kept local rather than imported for one specific reason:
   this banner renders above the navbar on a query parameter, in front of a
   page whose palette it must sit on top of but never match — a notice that
   blends into the band behind it is not a notice.

   The values still come from the shared scale, one step warmer, so it reads as
   a raised surface rather than as a colour nobody chose. Before 2026-08-20
   these were the pre-redesign hexes (#B8944F / #191B1E / #77736A / #E8E2D6),
   which had drifted a full shade off the page around them. */
const C = {
  gold: '#A98A4E',
  charcoal: '#191815',
  stone: '#5C574E',
  border: '#E3DBCB',
  cream: '#FBF4E6',
};

export default function LinkNoticeBanner() {
  const params = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  // `expired` is still honoured: links from before the parameter was renamed are
  // sitting in people's message apps and will be tapped for months.
  const flag = params.get('link');
  if (dismissed || (flag !== 'invalid' && flag !== 'expired')) return null;

  return (
    <div
      role="status"
      style={{
        background: C.cream,
        borderBottom: `1px solid ${C.border}`,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        justifyContent: 'center',
      }}
    >
      <div style={{ maxWidth: 720, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.gold}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>

        <div style={{ minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 14, fontWeight: 700, color: C.charcoal,
            fontFamily: 'var(--font-sans)', lineHeight: 1.4,
          }}>
            That invitation link didn’t work
          </p>
          <p style={{
            margin: '4px 0 0', fontSize: 13, color: C.stone,
            fontFamily: 'var(--font-sans)', lineHeight: 1.55,
          }}>
            The link may have been copied incompletely — messaging apps sometimes cut long
            links in half. Try opening it again from the original message, or ask whoever
            invited you to resend it.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{
            marginLeft: 'auto', flexShrink: 0, background: 'transparent',
            border: 'none', cursor: 'pointer', color: C.stone,
            fontSize: 18, lineHeight: 1, padding: '2px 6px',
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
