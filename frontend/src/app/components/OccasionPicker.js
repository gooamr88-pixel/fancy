'use client';

import React from 'react';
import { CUSTOM_CATEGORIES } from '../utils/customEventCategories';
import EventCategoryIcon from './icons/EventCategoryIcon';

/* ═══════════════════════════════════════════════════════════════
   "What kind of event is this?" — one control, both screens.

   This grid existed twice, once in the create-event wizard
   (Stage2_FormConfiguration) and once in the post-creation editor
   (EventSettings), with the same 25 tiles, the same keys and two slightly
   different sets of paddings. A third, two-tile copy was added when Swan Lake
   needed a wedding/engagement choice. Three copies of one control is three
   places for the catalogue to drift from the product.

   It is shown for EVERY template now. A template used to be an occasion —
   Velvet Ring was an engagement, Door of Joy a wedding — so only Custom
   Canvas asked. Now the template decides how the invitation looks and this
   decides what the event is, which is what lets a birthday use the velvet box.

   ── Layout ───────────────────────────────────────────────────────────────
   `.fx-grid--fill` rather than a fixed column count. Twenty-five tiles at a
   fixed 5 columns needs each tile's content to fit ~29px on a 320px screen
   (see the min-content arithmetic in frontend/AGENTS.md), which no icon plus
   label can do. The auto-fill track lets the row reflow to two columns on the
   narrowest phones instead of pushing the page sideways.
   ═══════════════════════════════════════════════════════════════ */

const COLORS = {
  gold: '#B8944F',
  border: '#E8E2D6',
  white: '#FFFFFF',
  stone: '#77736A',
  hint: '#A09A91',
};

export default function OccasionPicker({
  value,
  onChange,
  label = 'What kind of event is this?',
  hint = 'Shapes the fields below, the wording on your invitation, and how guest sides are labelled — change it any time.',
  labelStyle,
  hintStyle,
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={labelStyle}>{label}</label>
      {/* A group of pressed/unpressed buttons, NOT role="radiogroup".
          A radiogroup promises arrow-key navigation and a single tab stop,
          and implementing role="radio" without roving tabindex leaves a
          screen-reader user pressing arrows inside a group that does not
          respond — worse than the plain buttons this replaced. `aria-pressed`
          is the honest description of what these actually are. */}
      <div
        className="fx-grid fx-grid--fill fx-grid--gap-sm"
        /* `--fx-col` is the knob .fx-grid--2…--6 turn; none of them goes small
           enough for 25 icon tiles, so it is set directly. This is composing
           with the primitive, not overriding a responsive rule — unlike
           `--fx-pad-x`, which has a fluid clamp on :root that an inline value
           silently destroys (see test/inlineStyleTraps.test.js). The grid
           still reflows on its own; at 320px this yields three columns. */
        style={{ marginTop: 6, '--fx-col': '92px' }}
        role="group"
        aria-label={label}
        data-testid="occasion-picker"
      >
        {CUSTOM_CATEGORIES.map(({ key, label: catLabel }) => {
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(key)}
              data-testid={`occasion-${key}`}
              style={{
                /* flexWrap is load-bearing: an icon plus "Bachelor(ette)
                   Party" on one unbreakable line is what pushes the whole
                   step sideways on a phone. See test/mobileFit.test.js. */
                display: 'flex', flexDirection: 'column', flexWrap: 'wrap',
                alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                border: `1.5px solid ${active ? COLORS.gold : COLORS.border}`,
                background: active ? 'rgba(184,148,79,0.08)' : COLORS.white,
                transition: 'border-color 0.2s ease, background 0.2s ease',
              }}
            >
              <EventCategoryIcon name={key} size={17} color={active ? COLORS.gold : COLORS.stone} />
              <span
                className="fx-break"
                style={{
                  fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600,
                  color: active ? COLORS.gold : COLORS.stone, textAlign: 'center', lineHeight: 1.25,
                }}
              >
                {catLabel}
              </span>
            </button>
          );
        })}
      </div>
      {hint && (
        <p style={hintStyle || {
          fontSize: 'var(--fx-micro)', color: COLORS.hint, margin: '8px 0 0',
          fontFamily: 'var(--font-sans)', lineHeight: 1.55,
        }}>{hint}</p>
      )}
    </div>
  );
}
