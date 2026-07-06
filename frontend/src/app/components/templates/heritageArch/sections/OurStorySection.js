'use client';

import React from 'react';
import { HERITAGE_ARCH_COLORS as C } from '../defaultContent';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';

export default function OurStorySection({ story, isRTL }) {
  return (
    <SectionShell>
      <span style={{ fontSize: '34px', marginBottom: '8px' }} aria-hidden="true">📖</span>
      <SectionHeading isRTL={isRTL}>{isRTL ? 'قصتنا' : 'Our Story'}</SectionHeading>

      <p style={{
        maxWidth: '620px', textAlign: 'center', fontSize: '16px', lineHeight: 1.9,
        color: C.ink, opacity: 0.85, fontFamily: 'var(--font-sans)',
      }}>
        {story}
      </p>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
