'use client';

import React from 'react';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE LOCKED STATE FOR A CAPABILITY THIS PLAN DOES NOT INCLUDE.
 *
 * ── Why this exists next to FeatureGate ──
 *
 * `FeatureGate` locks a CONTROL: it dims a button and pins a 16px lock dot to
 * its corner. That works for one export button among six, and it is the wrong
 * instrument for a whole section. Text messaging is a nav destination, a page,
 * a purchase step and half of a send menu — dimming each of those individually
 * produces four different half-broken screens and never once says what is
 * actually going on or what to do about it.
 *
 * So this is not a dimmer. It is a small piece of merchandising: it names the
 * capability, says which plans carry it, and gives one button that goes
 * somewhere useful. A locked feature is the only moment a customer is reliably
 * paying attention to what a plan contains, and a greyed-out button with a
 * padlock wastes it.
 *
 * ── The two shapes ──
 *
 *   <PlanLockBadge>  — an inline pill. Sits beside a nav label or a menu group
 *                      heading, where there is no room to explain anything.
 *   <PlanLock>       — the panel. Replaces the content of a page or a section.
 *
 * Both read from the SAME props so a screen cannot end up saying "Professional"
 * in one and "upgrade your plan" in the other.
 *
 * ── Not a security boundary ──
 *
 * Every surface this hides is also gated server-side (middleware/smsAddonGate.js
 * for texting). This is presentation: it stops an organizer walking into a 403.
 * Deleting it would leak no data — it would just make the product feel broken.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const C = {
  gold: '#B8944F',
  goldDeep: '#8A6D34',
  goldPale: '#F3E9D4',
  ink: '#191B1E',
  stone: '#77736A',
  border: '#E8E2D6',
  white: '#FFFFFF',
};

/** "Professional or Enterprise" — an Oxford-comma-free list a person would say. */
export function plansSentence(plans) {
  const list = (Array.isArray(plans) ? plans : []).filter(Boolean);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} or ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`;
}

/**
 * The inline pill.
 *
 * Gold on pale gold rather than grey on grey: this marks something desirable
 * that is one decision away, not something broken or disabled. A grey "locked"
 * chip reads as a fault in the product.
 */
export function PlanLockBadge({ label = 'Plan feature', title, style }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 7px', borderRadius: 999,
        background: C.goldPale,
        border: `1px solid ${C.gold}59`,
        color: C.goldDeep,
        fontSize: 'var(--fx-micro, 10px)', fontWeight: 800,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        whiteSpace: 'nowrap', flexShrink: 0,
        fontFamily: 'var(--font-sans)',
        lineHeight: 1.6,
        ...style,
      }}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      {label}
    </span>
  );
}

/**
 * The panel.
 *
 * `plans` names what to buy; `onUpgrade` is the one action. Both optional —
 * with neither, this degrades to an honest statement rather than a dead button
 * pointing nowhere, which is what an admin who has not yet assigned the feature
 * to any tier would otherwise ship to every customer.
 */
export default function PlanLock({
  title,
  description,
  /** Plan names that carry the feature, from the server. */
  plans = [],
  /** Charged-separately caption, e.g. "Charged separately per message". */
  meteredNote,
  onUpgrade,
  upgradeLabel = 'See plans',
  icon,
  /** Extra content under the button — e.g. a "what you're missing" list. */
  children,
  compact = false,
}) {
  const where = plansSentence(plans);

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 16,
        padding: 1,
        // A hairline gold gradient edge instead of a flat border: the same
        // treatment the guest-facing premium surfaces use, so the upsell looks
        // like part of this product rather than an error state bolted on.
        background: `linear-gradient(135deg, ${C.gold}66, ${C.gold}1A 45%, ${C.gold}66)`,
      }}
    >
      <div
        className="fx-stack"
        style={{
          background: `linear-gradient(180deg, #FFFDF9 0%, ${C.goldPale}66 100%)`,
          borderRadius: 15,
          padding: compact ? '18px 16px' : '30px 24px',
          textAlign: 'center',
          alignItems: 'center',
          gap: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: compact ? 40 : 52, height: compact ? 40 : 52,
            borderRadius: '50%',
            background: `linear-gradient(140deg, #E8CE95, ${C.gold})`,
            color: C.white,
            boxShadow: `0 10px 22px -8px ${C.gold}B3`,
            marginBottom: 14,
          }}
        >
          {icon || (
            <svg width={compact ? 17 : 21} height={compact ? 17 : 21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
        </span>

        <PlanLockBadge label="Plan feature" />

        <h3
          style={{
            margin: '12px 0 0',
            fontFamily: 'var(--font-serif)',
            fontSize: compact ? 17 : 21,
            fontWeight: 600,
            color: C.ink,
            lineHeight: 1.3,
            textWrap: 'balance',
          }}
        >
          {title}
        </h3>

        {description && (
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 13,
              lineHeight: 1.65,
              color: C.stone,
              maxWidth: '46ch',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {description}
          </p>
        )}

        {where && (
          <p
            style={{
              margin: '12px 0 0',
              fontSize: 12.5,
              color: C.goldDeep,
              fontWeight: 700,
              fontFamily: 'var(--font-sans)',
            }}
          >
            Included with {where}
          </p>
        )}

        {/* Said here as well as on the plan card, because this is the screen
            where somebody decides to upgrade FOR this feature. Finding out
            afterwards that messages cost extra is the kind of surprise that
            turns an upgrade into a refund request. */}
        {meteredNote && (
          <p
            style={{
              margin: '3px 0 0',
              fontSize: 11.5,
              color: C.stone,
              fontFamily: 'var(--font-sans)',
            }}
          >
            {meteredNote}
          </p>
        )}

        {onUpgrade && (
          <button
            type="button"
            onClick={onUpgrade}
            style={{
              marginTop: 18,
              minHeight: 'var(--fx-touch)',
              padding: '11px 22px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              background: `linear-gradient(135deg, #D7BE80, ${C.gold})`,
              color: C.white,
              fontSize: 13.5,
              fontWeight: 700,
              fontFamily: 'var(--font-sans)',
              boxShadow: `0 10px 20px -8px ${C.gold}CC`,
            }}
          >
            {upgradeLabel}
          </button>
        )}

        {children && <div style={{ marginTop: 18, width: '100%' }}>{children}</div>}
      </div>
    </div>
  );
}
