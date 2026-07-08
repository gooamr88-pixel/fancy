'use client';

import React from 'react';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';

export default function OurStorySection({ story, isRTL }) {
  const C = useFullPageTheme();
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
