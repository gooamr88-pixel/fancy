'use client';

import Link from 'next/link';

/**
 * "Text messaging not added" — the locked state for every SMS control.
 *
 * ── Why locked and visible, rather than hidden ──
 *
 * An organizer who skipped the SMS package at checkout never discovers it again
 * if the UI simply omits it. They do not go looking for a feature they have never
 * seen. Leaving the buttons in place, visibly disabled, is what turns "I didn't
 * know you could do that" into one click.
 *
 * ── Why there is no <style jsx> in this file ──
 *
 * This renders inside other files' component trees, and styled-jsx scopes to the
 * component that DECLARES the block. A scoped rule written here for a class used
 * by a parent silently matches nothing — a known and repeatedly-hit trap in this
 * codebase. Inline styles and the global .fx-* utilities only.
 */

const C = {
  gold: '#B8944F',
  charcoal: '#191B1E',
  stone: '#77736A',
  border: '#E8E2D6',
  softBg: '#FAFAF8',
};

function LockIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="2.2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * @param {object}  props
 * @param {string}  [props.label]    the pill's text
 * @param {boolean} [props.compact]  icon + short label, for sitting beside a control
 * @param {string}  [props.href]     where "learn more" goes
 */
export default function SmsLockedBadge({
  label = 'Text messaging not added',
  compact = false,
  href = '/dashboard/sms-plans',
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: compact ? '3px 8px' : '5px 11px',
        borderRadius: 999,
        border: `1px solid ${C.border}`,
        background: C.softBg,
        color: C.stone,
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        textDecoration: 'none',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
      }}
      title="Text messaging is not active for this event. See what it costs."
    >
      <span style={{ color: C.gold, display: 'inline-flex' }}><LockIcon /></span>
      {label}
      {!compact && (
        <span style={{ color: C.gold, fontWeight: 700 }}>&rarr;</span>
      )}
    </Link>
  );
}

/**
 * Wraps a control so it LOOKS present but cannot be used, with the badge beside
 * it.
 *
 * pointerEvents on the child rather than `disabled` on the button, because the
 * children here are a mix of buttons, links and whole rows — and a `disabled`
 * attribute only means anything to some of them. Matching how FeatureGate does
 * it, so the two locked states in the dashboard feel like one idea.
 */
export function SmsLocked({ children, label, compact = false, href = '/dashboard/sms-plans' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ opacity: 0.45, pointerEvents: 'none', filter: 'grayscale(1)' }} aria-disabled="true">
        {children}
      </span>
      <SmsLockedBadge label={label} compact={compact} href={href} />
    </span>
  );
}
