'use client';

import React from 'react';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';
import { DressCodeVisualizer } from '../../../guest/GuestUI';

export default function DressCodeSection({ dressCode, colors, isRTL }) {
  const C = useFullPageTheme();
  const swatchColors = colors?.swatches || [];
  const label = dressCode || (isRTL ? 'شبه رسمي' : 'Semi-Formal');

  return (
    <SectionShell background={C.paper}>
      <SectionHeading isRTL={isRTL}>{isRTL ? 'قواعد اللباس' : 'Dress Code'}</SectionHeading>

      <div style={{
        width: '100%', maxWidth: '640px', background: C.cream, borderRadius: '20px',
        border: `1px solid ${C.border}`, padding: '28px 24px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '8px',
      }}>
        {/* The chosen dress code, front and centre */}
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: C.maroon, margin: 0, textAlign: 'center' }}>
          {label}
        </h3>

        {/* Attire illustrations + guidance that actually match the chosen code
            (tuxedo for Black Tie, suit for Cocktail, etc.) — reuses the shared
            DressCodeVisualizer so the guest sees the same guidance the organizer
            previewed while configuring the event. */}
        <div style={{ width: '100%' }}>
          <DressCodeVisualizer dressCodeText={label} isRTL={isRTL} />
        </div>

        {swatchColors.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <span style={{ fontSize: '12px', letterSpacing: '0.06em', color: C.ink, opacity: 0.7 }}>
              {isRTL ? 'الألوان المقترحة' : 'Suggested colors'}
            </span>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
              {swatchColors.map((c, i) => (
                <span key={i} style={{ width: '26px', height: '26px', borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.08)' }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
