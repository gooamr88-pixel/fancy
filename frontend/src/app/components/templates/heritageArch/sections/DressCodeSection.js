'use client';

import React from 'react';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';

// A simple line-art illustration of two elegantly dressed guests — decorative,
// bundled with the template rather than an organizer upload, tinted from the
// event's own palette so it never clashes with a chosen color story.
function AttireIllustration({ color }) {
  return (
    <svg width="120" height="90" viewBox="0 0 120 90" fill="none" aria-hidden="true">
      {/* Dress silhouette */}
      <path d="M40 14c0 5-2 8-2 8s10 3 10 16c0 10-6 12-14 12s-14-2-14-12c0-13 10-16 10-16s-2-3-2-8a6 6 0 0 1 12 0Z" stroke={color} strokeWidth="1.4" opacity="0.75" />
      <circle cx="34" cy="14" r="6" stroke={color} strokeWidth="1.4" opacity="0.75" />
      {/* Suit silhouette */}
      <path d="M82 16v6l6 4-3 12h-6l-2 12h-16l-2-12h-6l-3-12 6-4v-6Z" stroke={color} strokeWidth="1.4" opacity="0.75" />
      <path d="M82 16 86 22 82 34 78 22Z" stroke={color} strokeWidth="1.2" opacity="0.6" />
      <circle cx="86" cy="10" r="6" stroke={color} strokeWidth="1.4" opacity="0.75" />
    </svg>
  );
}

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
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: C.maroon, margin: 0, textAlign: 'center' }}>
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

        <AttireIllustration color={C.gold} />

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
