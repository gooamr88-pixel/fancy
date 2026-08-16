'use client';

import React from 'react';
import Icon from '../../../components/icons/Icon';

/* ═══════════════════════════════════════════════════════════════
   CustomBuilder — the "design your own page" panel for Custom Canvas.

   Every control here changes the guest page live in the phone beside it.
   That sentence is the whole contract of the panel, and until now it was
   false in two places:

     BACKGROUND  the swatch fed a preview event that dropped the key on the
                 way through, so it moved nothing — and then moved everything
                 once the event was saved.
     TYPOGRAPHY  the heading face reached the small invitation card and
                 nothing else. Every heading on the page stayed on the brand
                 serif, so picking "Whimsical" appeared to do nothing.

   Both are fixed at their source (Stage1_TemplatesSimulator's preview event
   and HeritageArchPage's --font-serif override respectively). What this file
   owes them is a layout that says what each control governs, rather than
   three unlabelled swatches and a row of Aa tiles.

   Content — what kind of event this is, and the sections that follow from it —
   stays on the next step. This panel is look and feel only.
   ═══════════════════════════════════════════════════════════════ */

const FONTS = [
  { key: 'serif', label: 'Elegant', css: 'var(--font-serif)' },
  { key: 'display', label: 'Bold', css: 'var(--font-display)' },
  { key: 'sans', label: 'Modern', css: 'var(--font-sans)' },
  { key: 'minimal', label: 'Minimal', css: 'var(--font-minimal)' },
  { key: 'script', label: 'Romantic', css: 'var(--font-script)' },
  { key: 'whimsical', label: 'Whimsical', css: 'var(--font-whimsical)' },
];
const SCRIPT_FONT_KEYS = new Set(['script', 'whimsical']);

const PALETTES = [
  { name: 'Linen', primary: '#8B7355', secondary: '#D4C5A9', accent: '#8B7355', background: '#FAF8F5' },
  { name: 'Blush', primary: '#C96A7B', secondary: '#F3D3DA', accent: '#C96A7B', background: '#FFF7F8' },
  { name: 'Ocean', primary: '#2B6E8F', secondary: '#BFE0EC', accent: '#2B6E8F', background: '#F2FAFC' },
  { name: 'Forest', primary: '#3C6E47', secondary: '#BFE0C5', accent: '#3C6E47', background: '#F4FAF5' },
  { name: 'Slate', primary: '#475569', secondary: '#CBD5E1', accent: '#475569', background: '#F8FAFC' },
  { name: 'Plum', primary: '#6D4C7D', secondary: '#D9C7E4', accent: '#6D4C7D', background: '#FBF6FE' },
];

const C = { gold: '#B8944F', charcoal: '#191B1E', stone: '#77736A', border: '#E8E2D6' };

/* A field's caption says what the colour DOES on the page, not what the
   variable is called. "Accent" was the label on a control writing `secondary`,
   while the swatch row beside it showed `primary` — two names for two
   different things, neither of which told the organizer where it would land. */
const COLOR_FIELDS = [
  { key: 'primary', label: 'Headings', hint: 'Names, titles, buttons' },
  { key: 'secondary', label: 'Accent', hint: 'Labels, rules, icons' },
  { key: 'background', label: 'Background', hint: 'The page itself' },
];

function GroupLabel({ children, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
      <span style={{
        fontSize: 'var(--fx-micro)', fontWeight: 700, color: C.charcoal, textTransform: 'uppercase',
        letterSpacing: '0.09em', fontFamily: 'var(--font-sans)',
      }}>{children}</span>
      {note && (
        <span style={{ fontSize: 'var(--fx-micro)', color: C.stone, fontFamily: 'var(--font-sans)' }}>{note}</span>
      )}
    </div>
  );
}

function ColorField({ label, hint, value, onChange }) {
  const id = `cb-color-${label.toLowerCase()}`;
  return (
    <label
      htmlFor={id}
      className="cb-color"
      style={{
        // Wrappable per the ratchet in test/mobileFit.test.js. A no-op at the
        // widths this tile reaches — .fx-grid drops to one column long before
        // a 26px swatch and its caption stop fitting side by side.
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, cursor: 'pointer',
        border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', background: '#fff',
        minHeight: 'var(--fx-touch)',
      }}
    >
      <span style={{
        width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: value,
        boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.12)`,
      }} />
      <span className="fx-min0" style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: 700, color: C.charcoal }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fx-micro)', color: C.stone }} className="fx-truncate">{hint}</span>
      </span>
      {/* The native picker itself, kept in the layout (not display:none) so it
          stays keyboard-reachable, but sized to the swatch it sits under. */}
      <input
        id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          width: 1, height: 1, padding: 0, margin: 0, border: 'none',
          opacity: 0, position: 'absolute', pointerEvents: 'none',
        }}
      />
    </label>
  );
}

export default function CustomBuilder({ config, onChange }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(184,148,79,0.18)',
      borderRadius: 18, padding: 18, boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: 'rgba(184,148,79,0.10)', border: '1px solid rgba(184,148,79,0.2)',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="palette" size={15} color={C.gold} strokeWidth={1.6} />
        </span>
        <span className="fx-min0" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 600, color: C.charcoal }}>
            Design your page
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.stone }}>
            Everything here changes the invitation beside you as you set it
          </span>
        </span>
      </div>

      {/* ── Palette presets ── */}
      <div>
        <GroupLabel note="A starting point — tune it below">Palette</GroupLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {PALETTES.map((p) => {
            const active = config.primary === p.primary && config.background === p.background;
            return (
              <button
                key={p.name} type="button" title={p.name}
                onClick={() => onChange({ primary: p.primary, secondary: p.secondary, accent: p.accent, background: p.background })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 5px',
                  minHeight: 'var(--fx-touch)', borderRadius: 999, cursor: 'pointer',
                  border: `1.5px solid ${active ? C.gold : 'rgba(184,148,79,0.18)'}`,
                  background: active ? 'rgba(184,148,79,0.08)' : '#fff',
                  boxShadow: active ? '0 2px 8px rgba(184,148,79,0.15)' : 'none', transition: 'all 0.2s',
                }}
              >
                <span style={{ display: 'flex' }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: p.primary, border: '1.5px solid #fff' }} />
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: p.secondary, border: '1.5px solid #fff', marginLeft: -7 }} />
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: p.background, border: '1.5px solid #fff', marginLeft: -7 }} />
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: C.charcoal }}>{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── The three colours, each captioned with where it lands ── */}
      <div>
        <GroupLabel note="Click a swatch to pick your own">Colours</GroupLabel>
        {/* .fx-grid, not repeat(3, 1fr): three fixed columns have a min-content
            width of 3x the widest tile, which does not fit a phone. auto-fit
            drops to one column on its own, with no media query to keep in
            sync. */}
        <div className="fx-grid fx-grid--6 fx-grid--gap-sm">
          {COLOR_FIELDS.map((f) => (
            <ColorField
              key={f.key}
              label={f.label}
              hint={f.hint}
              value={config[f.key]}
              onChange={(v) => onChange(
                // Headings and the solid CTA fill are one colour on the page
                // (buildPalette's `accent` → `solidFill`), so the picker sets
                // both rather than leaving `accent` on a stale value.
                f.key === 'primary' ? { primary: v, accent: v } : { [f.key]: v },
              )}
            />
          ))}
        </div>
      </div>

      {/* ── Typography ── */}
      <div>
        <GroupLabel note="Sets every heading on the page">Heading typography</GroupLabel>
        {/* A wrapping flex row rather than a grid: its min-content width is the
            widest single tile (see AGENTS.md), so six of these fit a phone by
            reflowing instead of by dropping to one per line. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {FONTS.map((f) => {
            const active = config.headingFont === f.key;
            return (
              <button
                key={f.key} type="button" onClick={() => onChange({ headingFont: f.key })}
                style={{
                  flex: '1 1 84px', minWidth: 78,
                  padding: '9px 6px', minHeight: 'var(--fx-touch)', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${active ? C.gold : C.border}`,
                  background: active ? 'rgba(184,148,79,0.08)' : '#fff', transition: 'all 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                }}
              >
                {/* A word, not "Aa": two letters do not show what a face does
                    to a name, which is the only place the organizer will
                    actually see it. */}
                <span style={{
                  fontFamily: f.css, fontSize: SCRIPT_FONT_KEYS.has(f.key) ? 19 : 15,
                  color: active ? C.charcoal : '#3d3a35', lineHeight: 1.1,
                }}>Amira</span>
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--fx-micro)', fontWeight: 600,
                  color: active ? C.gold : C.stone,
                }}>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content — which kind of event this is, the cover image, and every
          section (schedule, venues, accommodation, FAQ, gift list, gallery,
          dress code and the rest) — is configured with real data on the next
          step. Custom gets every feature every other template has, so there is
          a lot to fit; this panel stays on look and feel. */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 9, padding: '10px 12px',
        borderRadius: 10, background: 'rgba(184,148,79,0.06)', border: '1px solid rgba(184,148,79,0.15)',
      }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}>
          <Icon name="info" size={13} color={C.gold} strokeWidth={1.8} />
        </span>
        {/* flex-basis, not `auto`: a paragraph's max-content width is the whole
            sentence on one line, so an auto-basis child in a wrapping row
            always wraps to its own line — which put this icon alone above the
            text at every width instead of beside it. */}
        <span style={{
          flex: '1 1 200px', minWidth: 0,
          fontFamily: 'var(--font-sans)', fontSize: 11.5, color: C.stone, lineHeight: 1.45,
        }}>
          Next step: choose what kind of event this is, then add your story, schedule, venues, gift list and
          FAQ — every section optional and yours to switch on or off.
        </span>
      </div>

      <style jsx>{`
        .cb-color { position: relative; transition: border-color 0.2s, box-shadow 0.2s; }
        .cb-color:hover { border-color: ${C.gold}; box-shadow: 0 2px 10px rgba(184,148,79,0.12); }
        .cb-color:focus-within { border-color: ${C.gold}; box-shadow: 0 0 0 3px rgba(184,148,79,0.15); }
      `}</style>
    </div>
  );
}
