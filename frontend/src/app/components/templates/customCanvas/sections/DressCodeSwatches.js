'use client';

import React from 'react';
import { FadeInUp, StaggerChildren, StaggerItem } from '../../../guest/GuestAnimations';
import { useLiteralTheme, lighten, darken } from '../theme';

/* DressCodeSwatches — dress-code guidance text, a row of colour-palette
   swatches (the reference's 6-circle palette), and optional ladies/
   gentlemen guidance. Swatches are auto-derived from the already-resolved
   theme (useLiteralTheme(), itself derived from event.custom_colors) rather
   than requiring any new organizer colour-picker UI — zero backend change. */
export default function DressCodeSwatches({ dressCode, ladiesText, gentlemenText, isRTL }) {
  const C = useLiteralTheme();
  if (!dressCode?.trim()) return null;

  const swatches = [
    C.gold, C.goldSoft, lighten(C.gold, 0.35), darken(C.gold, 0.3), C.ink, lighten(C.ink, 0.7),
  ];

  return (
    <div style={{
      minHeight: '70dvh', width: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 28,
      background: C.paper, padding: 'clamp(48px, 10vh, 80px) 24px', boxSizing: 'border-box',
    }}>
      <FadeInUp style={{ textAlign: 'center', maxWidth: 480 }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', color: C.gold, fontSize: 'clamp(24px, 4.5vw, 34px)', margin: '0 0 12px' }}>
          {isRTL ? 'قواعد اللباس' : 'Dress Code'}
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: C.ink, opacity: 0.85, lineHeight: 1.7, margin: 0 }}>
          {dressCode}
        </p>
      </FadeInUp>

      <StaggerChildren style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        {swatches.map((hex, i) => (
          <StaggerItem key={i}>
            <span
              aria-hidden="true"
              style={{
                display: 'block', width: 40, height: 40, borderRadius: '50%',
                background: hex, boxShadow: `0 4px 10px ${C.ink}22, inset 0 0 0 1px rgba(255,255,255,0.4)`,
              }}
            />
          </StaggerItem>
        ))}
      </StaggerChildren>

      {(ladiesText || gentlemenText) && (
        <div style={{
          display: 'flex', gap: 40, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 560, marginTop: 8,
        }}>
          {ladiesText && (
            <div style={{ maxWidth: 220, textAlign: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', color: C.gold, fontSize: 20, margin: '0 0 8px' }}>
                {isRTL ? 'السيدات' : 'Ladies'}
              </h3>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: C.ink, opacity: 0.85, lineHeight: 1.6, margin: 0 }}>
                {ladiesText}
              </p>
            </div>
          )}
          {gentlemenText && (
            <div style={{ maxWidth: 220, textAlign: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', color: C.gold, fontSize: 20, margin: '0 0 8px' }}>
                {isRTL ? 'السادة' : 'Gentlemen'}
              </h3>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: C.ink, opacity: 0.85, lineHeight: 1.6, margin: 0 }}>
                {gentlemenText}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
