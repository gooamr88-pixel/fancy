'use client';

import Link from 'next/link';
import SmsLockedBadge from './SmsLockedBadge';

/**
 * The SMS status banner shown at the top of the Guests and RSVPs tabs.
 *
 * ── What it is for ──
 *
 * An organizer's single most common SMS question is not "how do I send one" —
 * it is "will I have enough?", asked while looking at their guest list. This
 * answers it in the place the question occurs, in guest terms rather than in
 * segments: how many messages are left, and whether that covers the people on the
 * screen behind it.
 *
 * Four states, and each says something different:
 *   • not purchased  → what this would do, and where to buy it
 *   • healthy        → a quiet line; it must not nag
 *   • won't cover    → the shortfall in guests, not in segments
 *   • low / empty    → the only state that is allowed to be loud
 *
 * ── Why there is no <style jsx> here ──
 *
 * This renders inside GuestsTab and RSVPsTab, and styled-jsx scopes rules to the
 * component that declares them. A scoped rule written here for markup rendered
 * through a parent silently matches nothing — a trap this codebase has hit
 * before. Inline styles and the global .fx-* utilities only.
 */

const C = {
  gold: '#B8944F',
  charcoal: '#191B1E',
  stone: '#77736A',
  border: '#E8E2D6',
  softBg: '#FAFAF8',
  success: '#3B9B6D',
  error: '#C45E5E',
  amber: '#B8894F',
};

function MessageIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** A thin progress rail. Purely reinforcement — every number is also in words. */
function Meter({ pct, color }) {
  return (
    <div
      style={{
        height: 5, borderRadius: 999, background: 'rgba(0,0,0,0.06)',
        overflow: 'hidden', width: '100%', maxWidth: 220,
      }}
      role="presentation"
    >
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color, borderRadius: 999 }} />
    </div>
  );
}

/**
 * @param {object}  props
 * @param {boolean} props.active            has the event bought text messaging
 * @param {number}  props.remaining         messages left
 * @param {number}  [props.purchased]       messages bought (for the meter)
 * @param {object}  [props.coverage]        { invitations, coversInvitations, enough, shortfall }
 * @param {number}  [props.lowPct]          the admin-configured low threshold
 * @param {string}  [props.topUpHref]
 */
export default function SmsBalanceBanner({
  active,
  remaining = 0,
  purchased = 0,
  coverage = null,
  lowPct = 20,
  topUpHref = '/dashboard/campaigns',
}) {
  /* ── State 1: never purchased ─────────────────────────────────────────── */
  if (!active) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '12px 16px', marginBottom: 16, borderRadius: 12,
        border: `1px solid ${C.border}`, background: C.softBg, borderLeft: `3px solid ${C.gold}`,
      }}>
        <MessageIcon color={C.gold} />
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.charcoal, fontFamily: 'var(--font-sans)' }}>
            Text your guests their invitation and their table
          </div>
          <div style={{ fontSize: 12, color: C.stone, marginTop: 2, fontFamily: 'var(--font-sans)' }}>
            Texts get opened. Add messaging to this event whenever you like — you only pay for what your guest list needs.
          </div>
        </div>
        <SmsLockedBadge label="See what it costs" />
      </div>
    );
  }

  const pctLeft = purchased > 0 ? Math.round((remaining / purchased) * 100) : 0;
  const isEmpty = remaining <= 0;
  const isLow = !isEmpty && purchased > 0 && pctLeft <= lowPct;
  // "Enough" is advisory and only meaningful once we know the guest count.
  const shortOfGuests = coverage && coverage.enough === false;

  const tone = isEmpty ? C.error : (isLow || shortOfGuests) ? C.amber : C.success;
  const loud = isEmpty || isLow || shortOfGuests;

  /* ── States 2-4: purchased ────────────────────────────────────────────── */
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      padding: '12px 16px', marginBottom: 16, borderRadius: 12,
      border: `1px solid ${loud ? 'rgba(184,137,79,0.28)' : C.border}`,
      background: loud ? 'rgba(184,137,79,0.06)' : C.softBg,
      borderLeft: `3px solid ${tone}`,
    }}>
      <MessageIcon color={tone} />

      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.charcoal, fontFamily: 'var(--font-sans)' }}>
          {isEmpty
            ? 'You have run out of messages'
            : `${remaining.toLocaleString()} ${remaining === 1 ? 'message' : 'messages'} left`}
        </div>

        <div style={{ fontSize: 12, color: C.stone, marginTop: 2, fontFamily: 'var(--font-sans)' }}>
          {isEmpty
            ? 'Guests are still being emailed. Top up to start texting again.'
            : shortOfGuests
              // Guests, never segments. "You have 380 messages" means nothing to
              // someone holding a guest list; "enough for about 90 of your 140"
              // is the same fact in a unit they are already thinking in.
              ? `Enough for about ${coverage.coversInvitations} of your ${coverage.invitations} invitations.`
              : isLow
                ? 'Running low — top up before your event to avoid a gap.'
                : coverage
                  ? `Enough for all ${coverage.invitations} of your invitations.`
                  : 'Ready to send.'}
        </div>

        {purchased > 0 && (
          <div style={{ marginTop: 7 }}><Meter pct={pctLeft} color={tone} /></div>
        )}
      </div>

      <Link
        href={topUpHref}
        style={{
          padding: '7px 14px', borderRadius: 8,
          background: loud ? C.gold : 'transparent',
          border: `1px solid ${loud ? C.gold : C.border}`,
          color: loud ? '#FFFFFF' : C.charcoal,
          fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)',
          textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        {isEmpty || isLow || shortOfGuests ? 'Add messages' : 'Messages'}
      </Link>
    </div>
  );
}
