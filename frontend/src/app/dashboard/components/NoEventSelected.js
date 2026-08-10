'use client';

import Link from 'next/link';

/**
 * What an event-scoped section shows when there is no event to show it for.
 *
 * ── Why this needed to exist ──
 *
 * Eight sections of this dashboard are about one specific event. Exactly ONE of
 * them (Seating) checked whether an event was actually selected. The other seven
 * rendered with an empty id: the heading said "Select an Event", the body showed
 * an empty table with "0 guests", and nothing anywhere said what to do about it.
 * An organizer who had just signed up and pressed "Guest list" was looking at a
 * screen that appeared broken rather than empty.
 *
 * ── Why it names the section it is standing in for ──
 *
 * "No event selected" is true of the whole dashboard and therefore useless in any
 * particular part of it. "Your guest list belongs to an event" explains why THIS
 * screen is blank, which is the question actually being asked.
 *
 * Two states, because they need different sentences:
 *   • no events at all      → the only useful action is to create one
 *   • events exist, none picked → the action is to pick one, and it is in the
 *     sidebar they are already looking at
 */
export default function NoEventSelected({
  /** e.g. "Your guest list" — the thing that is missing an event. */
  section = 'This section',
  /** True when the organizer has no events whatsoever. */
  empty = false,
}) {
  return (
    <div style={{
      width: '100%',
      background: '#FFFFFF',
      border: '1px solid #E8E2D6',
      borderRadius: 14,
      padding: '48px 32px',
      textAlign: 'center',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12, margin: '0 auto 16px',
        background: 'rgba(184, 148, 79, 0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>

      <h3 style={{
        margin: 0, fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 600,
        color: '#191B1E', letterSpacing: '-0.01em',
      }}>
        {section} belongs to an event
      </h3>

      <p style={{
        margin: '10px auto 0', maxWidth: 420, fontSize: 13.5, lineHeight: 1.65, color: '#77736A',
      }}>
        {empty
          ? 'Create your first event and this section fills itself in — guests, replies, seating and messages all hang off it.'
          : 'Choose which event you are working on from “Working on” at the top of the sidebar, and this section will fill in.'}
      </p>

      {empty && (
        <Link
          href="/dashboard/create-event"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 20,
            padding: '11px 22px', borderRadius: 30,
            background: 'linear-gradient(135deg, #D7BE80 0%, #B8944F 100%)',
            color: '#FFFFFF', fontSize: 12.5, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 4px 15px rgba(184, 148, 79, 0.25)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create your first event
        </Link>
      )}
    </div>
  );
}
