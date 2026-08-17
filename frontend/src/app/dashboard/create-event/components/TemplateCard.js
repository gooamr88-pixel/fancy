'use client';

import React, { useState } from 'react';
import InvitationCard from '../../../components/templates/InvitationCard';
import EventCategoryIcon from '../../../components/icons/EventCategoryIcon';
import { TEMPLATE_PREVIEW_PATTERN } from '../../../utils/curatedTemplates';
import { occasionPolicyFor } from '../../../utils/eventOccasion';

/* ═══════════════════════════════════════════════════════════════
   TemplateCard — the gallery card for the template picker.

   WHAT IT USED TO DRAW, AND WHY THAT WAS WRONG

   Every card rendered <InvitationCard template={{ pattern: template.pattern }}>.
   No entry in curatedTemplates.js has ever had a `pattern` key — the mapping
   lives in TEMPLATE_PREVIEW_PATTERN, keyed separately — so `pattern` was
   `undefined` on every card, InvitationCard's switch fell through to its
   `default:` arm, and all five templates drew the SAME generic card, reading
   "Aria & Julian · The Grand Ballroom, New York", differing only in the accent
   colour it was tinted with. Nothing errored, nothing warned, and the picker
   asked organizers to choose between five identical thumbnails.

   Threading the correct pattern through would not have fixed it: every curated
   template maps to 'serif'. The cards would have been identical and correct.

   WHAT IT DRAWS NOW

   `template.preview` says what this template actually looks like:

     kind: 'poster'  the template's own hero still — the exact first frame the
                     guest lands on. It cannot drift from the product, because
                     it IS the product's opening.
     kind: 'card'    Custom Canvas has no photography; it is whatever the
                     organizer's colours and typography make it. So it renders
                     the live builder-driven `custom` InvitationCard, which
                     changes under their hands as they change the palette.
   ═══════════════════════════════════════════════════════════════ */

export default function TemplateCard({
  template, isSelected, onSelect, index, activePresetIndex, onPresetSelect,
  /* The live Custom builder config. Only Custom Canvas reads it — its card is
     a preview of the organizer's own choices, not a fixed piece of art. */
  customConfig,
}) {
  const [hovered, setHovered] = useState(false);
  const preset = template.presets[activePresetIndex || 0];
  const preview = template.preview || {};
  const isPoster = preview.kind === 'poster';

  // Name and tier sit over the artwork, so they need the contrast the artwork
  // gives them: light type over the dark cinematic stills, dark type over the
  // Custom card's cream ground.
  const overDark = preview.tone !== 'light';
  // What this template may be used for — the badge's only source of truth.
  const policy = occasionPolicyFor(template.key);
  const titleColor = overDark ? '#FFFFFF' : '#191B1E';
  const tierColor = overDark ? 'rgba(255,255,255,0.88)' : '#8A6D34';
  // Custom Canvas follows the live builder; the others follow their preset.
  const cardTint = customConfig?.primary || preset?.primary || '#B8944F';

  return (
    <div
      onClick={() => onSelect(template.key)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="tc-card"
      data-testid={`template-card-${template.key}`}
      style={{
        position: 'relative', cursor: 'pointer',
        borderRadius: 18, overflow: 'hidden',
        background: '#FFFFFF',
        border: isSelected ? '2px solid #B8944F' : hovered ? '1.5px solid rgba(184,148,79,0.4)' : '1px solid rgba(184,148,79,0.14)',
        boxShadow: isSelected
          ? '0 16px 36px rgba(184,148,79,0.18), 0 6px 20px rgba(0,0,0,0.06)'
          : hovered ? '0 14px 34px rgba(0,0,0,0.10)' : '0 3px 14px rgba(0,0,0,0.04)',
        transform: hovered && !isSelected ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'border-color 0.3s, box-shadow 0.35s, transform 0.35s cubic-bezier(0.16,1,0.3,1)',
        animation: `tc-entrance 0.4s cubic-bezier(0.16,1,0.3,1) ${Math.min(index, 12) * 0.045}s both`,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Selected check badge */}
      {isSelected && (
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 10,
          width: 22, height: 22, borderRadius: '50%', background: '#B8944F',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(184,148,79,0.4)', animation: 'tc-pop 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
        </div>
      )}

      {/* ── What this template is FOR ──────────────────────────────────
          The one thing the card has to answer before anything else, and it
          had no answer: `tier` read "Any occasion" as small type over the
          artwork, on Velvet Ring too, which is not true of a ring box.

          Opposite corner from the selected check so the two never collide.
          Text and icon come from occasionPolicyFor(), the same source the
          pickers offer from — so this cannot promise a freedom the next
          screen refuses. */}
      <div
        className="tc-badge"
        data-testid={`template-badge-${template.key}`}
        title={policy.note}
        style={{
          position: 'absolute', top: 10, insetInlineStart: 10, zIndex: 10,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 10px 5px 8px', borderRadius: 999,
          border: `1px solid ${overDark ? 'rgba(255,255,255,0.34)' : 'rgba(184,148,79,0.45)'}`,
          background: overDark ? 'rgba(16,12,9,0.52)' : 'rgba(255,255,255,0.82)',
          WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)',
          boxShadow: overDark ? '0 2px 10px rgba(0,0,0,0.35)' : '0 2px 10px rgba(0,0,0,0.08)',
          maxWidth: 'calc(100% - 52px)',
        }}
      >
        <EventCategoryIcon
          name={policy.iconName}
          size={12}
          color={overDark ? '#F2E4C4' : '#8A6D34'}
          strokeWidth={1.8}
        />
        <span className="fx-break" style={{
          fontFamily: 'var(--font-sans)', fontSize: 9.5, fontWeight: 700,
          letterSpacing: '0.07em', textTransform: 'uppercase',
          color: overDark ? '#F2E4C4' : '#8A6D34', lineHeight: 1.2,
        }}>{policy.label}</span>
      </div>

      {/* ── Artwork ── */}
      <div
        className="tc-hero"
        style={{
          background: isPoster
            ? '#15100d'
            /* A wash of the organizer's OWN primary, not a flat cream. Custom
               Canvas's palettes are pale by design, so a gradient built only
               from the background colour was indistinguishable from white and
               left the card sitting on nothing — the one template with no
               photography also had the emptiest thumbnail. The tint is what
               tells them, at a glance, which palette is loaded. */
            : `radial-gradient(ellipse 120% 90% at 50% 15%, ${cardTint}22 0%, transparent 70%),
               linear-gradient(160deg, ${preset?.background || '#FAF8F5'} 0%, #FFFFFF 120%)`,
        }}
      >
        {isPoster ? (
          <img
            className="tc-poster"
            src={preview.src}
            alt=""
            // Decorative: the label beside it already names the template, so a
            // screen reader repeating the filename adds nothing.
            aria-hidden="true"
            loading="lazy"
            style={{ objectPosition: preview.position || '50% 50%' }}
          />
        ) : (
          <div className="tc-card-art">
            {/* InvitationCard's type is fixed px, sized for the ~260x360 card
                the guest page and the phone simulator render. Shrinking the box
                around it does not shrink the type — the first pass here gave it
                a 132px box and got "You're Invited" at 20px spilling out of the
                frame and the addressee clipped in half. So the card is rendered
                at its true size and the whole thing is scaled, exactly as the
                phone simulator scales its handset. */}
            <div className="tc-card-scale">
            <InvitationCard
              // The real pattern, from the real map. Never `template.pattern`
              // — see the header note.
              template={{ pattern: TEMPLATE_PREVIEW_PATTERN[template.key] }}
              theme={{
                primary: customConfig?.primary || preset?.primary,
                secondary: customConfig?.secondary || preset?.secondary,
              }}
              config={{
                ...(customConfig || {}),
                background: customConfig?.background || preset?.background,
              }}
            />
            </div>
          </div>
        )}

        {/* Scrim — a legibility floor for the type below, not a decoration.
            The cinematic stills are photographs and their lower third is not
            reliably dark. */}
        <div className="tc-scrim" style={{
          background: overDark
            ? 'linear-gradient(to top, rgba(10,7,5,0.92) 0%, rgba(10,7,5,0.55) 38%, transparent 78%)'
            : 'linear-gradient(to top, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.72) 38%, transparent 78%)',
        }} />

        <div className="tc-caption">
          <h3 style={{
            fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 600,
            color: titleColor, margin: 0, lineHeight: 1.15,
            textShadow: overDark ? '0 1px 6px rgba(0,0,0,0.5)' : 'none',
          }}>{template.label}</h3>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.09em', textTransform: 'uppercase', color: tierColor,
            textShadow: overDark ? '0 1px 4px rgba(0,0,0,0.5)' : 'none',
          }}>{template.tier}</span>
        </div>
      </div>

      {/* ── Footer: what makes this template this template, and its palettes ── */}
      <div style={{ padding: '10px 13px 12px', display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: 10.5, color: '#77736A', margin: 0, lineHeight: 1.35,
        }} className="fx-truncate">{template.tagline}</p>

        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {template.presets.map((p, pi) => (
            <button
              key={pi}
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(template.key); onPresetSelect(template.key, pi); }}
              title={p.name}
              aria-label={p.name}
              style={{
                width: 15, height: 15, padding: 0, borderRadius: '50%', background: p.primary, cursor: 'pointer',
                border: pi === (activePresetIndex || 0) ? '2px solid #B8944F' : '2px solid rgba(184,148,79,0.15)',
                boxShadow: pi === (activePresetIndex || 0) ? '0 0 0 2px rgba(184,148,79,0.25)' : 'none',
                transition: 'all 0.25s ease', transform: pi === (activePresetIndex || 0) ? 'scale(1.15)' : 'scale(1)',
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        .tc-hero {
          position: relative; overflow: hidden;
          aspect-ratio: 4 / 5;
          display: flex; align-items: center; justify-content: center;
        }
        /* An <img>, not a background-image: a background cannot be lazy-loaded
           and cannot be given an intrinsic aspect ratio, and these stills are
           200-300KB each. */
        .tc-poster {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          transition: transform 0.5s cubic-bezier(0.16,1,0.3,1);
        }
        .tc-scrim { position: absolute; inset: 0; pointer-events: none; }
        .tc-caption {
          position: absolute; inset-inline: 0; bottom: 0;
          padding: 12px 13px;
          display: flex; flex-direction: column; gap: 3;
        }
        /* Fixed px, not a percentage of the fluid column: the card inside is a
           fixed-size drawing that is scaled to fit this box, so the box has to
           be a size the scale factor can be written against. 132 x 182 keeps
           the 210:290 stationery ratio and clears the narrowest column the
           picker grid produces (180px). */
        .tc-card-art {
          position: relative;
          width: 132px; height: 182px; border-radius: 8px; overflow: hidden;
          box-shadow: 0 10px 26px -10px rgba(0,0,0,0.35);
          transition: transform 0.45s cubic-bezier(0.16,1,0.3,1);
          /* Above the scrim: the Custom card IS the artwork, and a white wash
             over its lower third would grey out the very colours the organizer
             just picked. */
          z-index: 1;
          margin-bottom: 30px;
        }
        .tc-card-scale {
          width: 260px; height: 359px;
          transform: scale(0.5077);   /* 132 / 260 */
          transform-origin: top left;
        }
        .tc-card:hover .tc-poster { transform: scale(1.05); }
        .tc-card:hover .tc-card-art { transform: translateY(-3px) scale(1.02); }

        @keyframes tc-entrance { from { opacity: 0; transform: translateY(18px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes tc-pop { from { transform: scale(0); } to { transform: scale(1); } }

        @media (prefers-reduced-motion: reduce) {
          .tc-card { animation: none !important; }
          .tc-poster, .tc-card-art { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
