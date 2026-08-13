'use client';

import React from 'react';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';

/*
 * NO ILLUSTRATION HERE ANY MORE.
 *
 * This section used to centre a line-art "dress + suit" drawing between the
 * attire name and the Ladies/Gentlemen notes. It was removed deliberately, not
 * lost: two gendered silhouettes are a decoration that also makes a claim, and
 * the claim is wrong for plenty of events this template serves. It sat directly
 * above the only two sentences on the slide that carry actual instructions,
 * pushing them down and competing with them for attention.
 *
 * What replaces it is nothing — the attire name set large in the serif face,
 * the colour palette, and the notes. A dress code is text; the premium version
 * of it is typography, not clip art.
 */

export default function DressCodeSection({ dressCode, customColors, ladiesText, gentlemenText, isRTL }) {
  const C = useFullPageTheme();
  const label = dressCode || (isRTL ? 'شبه رسمي' : 'Semi-Formal');
  const swatches = ['primary', 'secondary', 'accent', 'background']
    .map((key) => customColors?.[key])
    .filter(Boolean);
  const hasSplit = !!(ladiesText || gentlemenText);

  return (
    <SectionShell background={C.paper}>
      <SectionHeading isRTL={isRTL}>{isRTL ? 'قواعد اللباس' : 'Dress Code'}</SectionHeading>

      <div style={{
        width: '100%', maxWidth: '640px', background: C.cream, borderRadius: '20px',
        border: `1px solid ${C.border}`, padding: '28px 24px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '20px',
      }}>
        {/* The attire name is now the whole visual weight of this card, so it
            carries the size the illustration used to take up.
            Fluid, not a flat 30px: this is free text an organizer types, and a
            single long unbreakable word ("Traditional", "Semi-Formal") at a
            fixed 30px has a min-content width of ~180px — against roughly 230px
            of usable space inside this card on a 320px phone, that is one
            slightly longer word away from pushing the page sideways. Same
            clamp() idiom NoKidsSection already uses for its headline. */}
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 5.2vw, 30px)', lineHeight: 1.25, color: C.maroon, margin: 0, textAlign: 'center', overflowWrap: 'anywhere' }}>
          {label}
        </h3>

        {swatches.length > 0 && (
          <div>
            <p style={{
              margin: '0 0 10px', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: '11px',
              fontWeight: 700, letterSpacing: isRTL ? 'normal' : '0.14em', textTransform: isRTL ? 'none' : 'uppercase', color: C.ink, opacity: 0.6,
            }}>
              {isRTL ? 'ألوان المناسبة' : 'Color Palette'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              {swatches.map((hex, i) => (
                <span key={i} aria-hidden="true" style={{
                  width: '32px', height: '32px', borderRadius: '50%', background: hex,
                  border: `2px solid ${C.background}`, boxShadow: `0 0 0 1px ${C.border}`,
                }} />
              ))}
            </div>
          </div>
        )}

        {hasSplit && (
          <div style={{
            width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '18px', marginTop: '4px',
          }}>
            {ladiesText && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '0 0 6px', fontFamily: 'var(--font-serif)', fontSize: '16px', color: C.maroon }}>
                  {isRTL ? 'للسيدات' : 'Ladies'}
                </p>
                <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7, color: C.ink, opacity: 0.8 }}>
                  {ladiesText}
                </p>
              </div>
            )}
            {gentlemenText && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '0 0 6px', fontFamily: 'var(--font-serif)', fontSize: '16px', color: C.maroon }}>
                  {isRTL ? 'للسادة' : 'Gentlemen'}
                </p>
                <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7, color: C.ink, opacity: 0.8 }}>
                  {gentlemenText}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
