'use client';

import React from 'react';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * "This is an adults-only celebration" — said where the guest is deciding who
 * to bring.
 *
 * The organizer's toggle (EventSettings → "Adults-Only Notice",
 * `events.no_kids_allowed`) already reached three surfaces: the invitation
 * card, the envelope reveal, and the invitation page's own "A Kind Note"
 * section. It reached the RSVP form — the one screen where the rule is
 * ACTIONABLE — on no template at all.
 *
 * That gap is the whole reason this exists. A guest who lands straight on the
 * response page from an emailed "RSVP" button never scrolls the invitation, so
 * the first they hear of the rule is at the door. And the party-size stepper is
 * precisely the control the rule constrains: "Number of guests (including you)"
 * with no mention of it reads as an open invitation to count the children.
 *
 * ── Why one component for two forms ──
 *
 * The public RSVP has TWO independent implementations — `RsvpSection` (inline
 * on the full-page templates, Custom Canvas among them) and `RsvpWizard` +
 * `StepPartyDetails` (the standalone /[slug]/rsvp route). They have drifted
 * before, feature by feature. A notice worth showing on one is worth showing on
 * the other, so both render THIS, and
 * `backend/test/adultsOnlyReachesGuest.test.js` fails if either stops — that
 * file also pins the API payloads, since the emailed RSVP link used to arrive
 * without the flag at all.
 *
 * Deliberately a statement, not a validator: nothing here blocks the stepper or
 * caps the party size. A guest may still have a legitimate reason to bring
 * someone under 18, and turning a host's polite request into a hard error at
 * submit time is the platform overruling the host. Telling the guest plainly,
 * at the moment they choose, is what the host actually asked for.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function AdultsOnlyNotice({ isRTL = false, themeColor = '#B8944F', style }) {
  return (
    <div
      role="note"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '11px 13px', borderRadius: '12px',
        background: `${themeColor}12`,
        border: `1px solid ${themeColor}33`,
        textAlign: isRTL ? 'right' : 'left',
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      <span aria-hidden style={{ display: 'flex', flexShrink: 0, marginTop: '1px', color: themeColor }}>
        {/* A coupe, matching the champagne glyph the invitation page's "A Kind
            Note" section uses — the same idea drawn the same way on both
            screens, so a guest who saw one recognises the other. */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 3.5h10l-1 6a4 4 0 0 1-8 0l-1-6Z" />
          <path d="M12 13.5V20 M8 20.5h8" />
        </svg>
      </span>
      <span style={{ fontSize: '12.5px', lineHeight: 1.6, color: '#5C4516' }}>
        <strong style={{ fontWeight: 700, display: 'block', color: '#191B1E', fontSize: '13px' }}>
          {isRTL ? 'دعوة خاصة بالكبار فقط' : 'An adults-only celebration'}
        </strong>
        {isRTL
          ? 'برجاء احتساب الكبار فقط في عدد الضيوف. شكرًا لتفهّمكم.'
          : 'Please count adults only when choosing your party size. Thank you for understanding.'}
      </span>
    </div>
  );
}
