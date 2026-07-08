'use client';

import React from 'react';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';

/* Transport / parking / directions notes, headed by a car line-icon in a
   soft circle. Reads its text from the ha_getting_there field. */
export default function GettingThereSection({ text, isRTL }) {
  const C = useFullPageTheme();
  if (!text || !text.trim()) return null;

  return (
    <SectionShell>
      <span style={{
        width: '64px', height: '64px', borderRadius: '50%', background: `${C.maroon}10`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px',
      }} aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={C.maroon} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13M5 13h14v4a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
          <circle cx="7.5" cy="15.5" r="0.6" fill={C.maroon} />
          <circle cx="16.5" cy="15.5" r="0.6" fill={C.maroon} />
        </svg>
      </span>

      <SectionHeading isRTL={isRTL}>{isRTL ? 'كيفية الوصول' : 'Getting There'}</SectionHeading>

      <p style={{
        maxWidth: '600px', textAlign: 'center', fontSize: '15px', lineHeight: 1.8,
        color: C.ink, opacity: 0.85, fontFamily: 'var(--font-sans)', whiteSpace: 'pre-wrap',
      }}>
        {text}
      </p>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
