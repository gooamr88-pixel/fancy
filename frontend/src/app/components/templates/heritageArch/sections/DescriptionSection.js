'use client';

import React from 'react';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';
import Icon from '../../../icons/Icon';

// The organizer's general event description (Stage 2 "Description" / "Arabic
// Description", event.description / template_data.description_ar) — every
// other full-page template already surfaces this in EventPageClient's own
// hero, but HeritageArchPage never rendered it anywhere. Kept as its own
// slide (same pattern as OurStorySection) rather than appending it to Hero,
// which is already a tightly packed single viewport (badge, tagline, title,
// invitation card, download button) — a paragraph of prose there would
// crowd it instead of reading as a deliberate section.
export default function DescriptionSection({ text, isRTL }) {
  const C = useFullPageTheme();
  return (
    <SectionShell>
      <Icon name="info" size={30} color={C.gold} strokeWidth={1.3} style={{ marginBottom: '8px' }} />
      <SectionHeading isRTL={isRTL}>{isRTL ? 'عن المناسبة' : 'About This Event'}</SectionHeading>

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
