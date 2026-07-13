'use client';

import React from 'react';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';
import Icon from '../../../icons/Icon';

// The event's own "Description" (Core Event Details, Stage 2 / Settings) —
// distinct from "Our Story"/love-story text. Previously computed but never
// actually rendered anywhere in the full-page guest experience (wedding,
// engagement, and every Custom Canvas category all use this full-page shell),
// so organizers filling it in — English or the Arabic override — had no way
// to know it silently never reached guests.
export default function AboutSection({ text, isRTL }) {
  const C = useFullPageTheme();
  return (
    <SectionShell>
      <Icon name="info" size={28} color={C.gold} strokeWidth={1.3} style={{ marginBottom: '8px' }} />
      <SectionHeading isRTL={isRTL}>{isRTL ? 'عن الفعالية' : 'About This Event'}</SectionHeading>

      <p style={{
        maxWidth: '620px', textAlign: 'center', fontSize: '16px', lineHeight: 1.9,
        color: C.ink, opacity: 0.85, fontFamily: 'var(--font-sans)', whiteSpace: 'pre-wrap',
      }}>
        {text}
      </p>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
