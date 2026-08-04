'use client';

import React from 'react';

/**
 * "Of your 3 guests: 2 fish, 1 beef."
 *
 * Companions are recorded as names only, so a companion has no meal of their
 * own to pick — the party carries a tally instead
 * (`rsvp_parties.companion_meal_counts`). That is a deliberate trade: the
 * caterer still gets an exact head count per dish, and nobody gets a place card
 * with a dish on it, because nobody said which guest eats what.
 *
 * Without this the caterer's breakdown counted every companion as
 * "No Selection" and under-ordered every real dish.
 *
 * Used by all three surfaces (the wizard, the full-page template, and the
 * organizer's edit modal) so the arithmetic and the "N of M chosen" wording
 * can't drift between them.
 */
/**
 * Reduces a tally so it never totals more than `capacity` meals.
 *
 * Needed whenever the party shrinks: the counter would otherwise hold a total
 * for a group that no longer exists, and the guest would be blocked by "too many
 * meals chosen" about companions they had just removed. Trims from the smallest
 * count first, so the dominant choice survives a one-guest reduction intact.
 */
export function trimMealCounts(counts, capacity) {
  const entries = Object.entries(counts || {})
    .map(([meal, n]) => [meal, Number(n) || 0])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]); // largest first

  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  // Return the original object when nothing needs trimming, so a party-size
  // change that doesn't affect the tally doesn't churn state identity.
  if (total <= capacity) return counts || {};

  // Fill up to capacity, biggest choice first, and drop whatever doesn't fit —
  // the dish most of the party picked survives a one-guest reduction intact.
  let remaining = Math.max(0, capacity);
  const out = {};
  for (const [meal, n] of entries) {
    if (remaining <= 0) break;
    const keep = Math.min(n, remaining);
    out[meal] = keep;
    remaining -= keep;
  }
  return out;
}

export default function CompanionMealCounter({
  options = [],
  counts = {},
  onChange,
  companionCount = 0,
  required = false,
  isRTL = false,
  accentColor = '#B8944F',
  invalid = false,
}) {
  if (!options.length || companionCount < 1) return null;

  const assigned = Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const remaining = companionCount - assigned;
  // Over-assigning is always wrong; leaving some unchosen is only wrong when the
  // organizer marked the meal question required.
  const isOver = remaining < 0;
  const isShort = required && remaining > 0;
  const showProblem = invalid || isOver || isShort;

  const status = isOver
    ? (isRTL ? `اخترت ${assigned} وجبة لـ ${companionCount} ضيف` : `${assigned} meals chosen for ${companionCount} guests`)
    : (isRTL ? `${assigned} من ${companionCount}` : `${assigned} of ${companionCount} chosen`);

  return (
    <div style={{
      border: `1px solid ${showProblem ? '#ef4444' : '#E8E2D6'}`,
      borderRadius: '14px',
      padding: '16px',
      background: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      textAlign: isRTL ? 'right' : 'left',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: isRTL ? 0 : '0.12em',
          textTransform: isRTL ? 'none' : 'uppercase', color: '#77736A', fontFamily: 'var(--font-sans)',
        }}>
          {isRTL ? 'وجبات ضيوفك' : "Your guests' meals"}
          {required && <span style={{ color: '#ef4444' }}> *</span>}
        </span>
        <span style={{
          fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)',
          color: showProblem ? '#ef4444' : (remaining === 0 ? '#3B9B6D' : '#A09A91'),
        }}>
          {status}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: '12px', color: '#A09A91', lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
        {isRTL
          ? 'اختار عدد كل وجبة — مش محتاج تحدد مين بياكل إيه.'
          : "Just how many of each — you don't need to say who's having what."}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {options.map((option) => {
          const value = Number(counts[option]) || 0;
          // Capped at what is left so the total can never be pushed over the
          // party size by tapping +, rather than letting it go wrong and
          // complaining about it afterwards.
          const canAdd = remaining > 0;
          return (
            <div key={option} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
              padding: '8px 12px', borderRadius: '10px',
              background: value > 0 ? `${accentColor}0F` : '#FAF8F3',
              border: `1px solid ${value > 0 ? `${accentColor}44` : '#F0ECE3'}`,
            }}>
              <span style={{ fontSize: '14px', color: '#191B1E', fontFamily: 'var(--font-sans)', minWidth: 0, overflowWrap: 'anywhere' }}>
                {option}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <StepButton
                  label={isRTL ? `تقليل ${option}` : `One fewer ${option}`}
                  disabled={value <= 0}
                  onClick={() => onChange(option, value - 1)}
                  accentColor={accentColor}
                >−</StepButton>
                <span aria-live="polite" style={{
                  minWidth: '28px', textAlign: 'center', fontSize: '15px', fontWeight: 700,
                  color: '#191B1E', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums',
                }}>{value}</span>
                <StepButton
                  label={isRTL ? `زيادة ${option}` : `One more ${option}`}
                  disabled={!canAdd}
                  onClick={() => onChange(option, value + 1)}
                  accentColor={accentColor}
                >+</StepButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepButton({ children, label, disabled, onClick, accentColor }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '44px', height: '44px', borderRadius: '10px',
        border: `1px solid ${disabled ? '#E8E2D6' : accentColor}`,
        background: '#FFFFFF',
        color: disabled ? '#D6D0C4' : accentColor,
        fontSize: '18px', lineHeight: 1, fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {children}
    </button>
  );
}
