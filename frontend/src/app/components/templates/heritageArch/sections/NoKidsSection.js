'use client';

import React from 'react';
import { useFullPageTheme } from '../theme';
import { SectionShell, DiamondDivider } from '../shared';

// A warm, celebratory glyph (two champagne flutes mid-toast) rather than a
// literal crossed-out-child icon — the notice is about an adults-only
// evening, not a prohibition, and should read as gracious, not harsh.
function ChampagneGlyph({ color }) {
  return (
    <svg width="42" height="48" viewBox="0 0 42 48" fill="none" aria-hidden="true">
      <path d="M9 4h9c0 7.2-1.6 11.5-4.5 11.5S9 11.2 9 4Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M24 4h9c0 7.2-1.6 11.5-4.5 11.5S24 11.2 24 4Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M13.5 15.5v8.5M28.5 15.5v8.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M8.5 25h10M23.5 25h10" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M13.5 25v19M28.5 25v19" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M7 44h13M22 44h13" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="16.5" cy="7.5" r="1" fill={color} />
      <circle cx="12" cy="9.5" r="0.8" fill={color} opacity="0.7" />
      <circle cx="31.5" cy="7.5" r="1" fill={color} />
      <circle cx="27" cy="9.5" r="0.8" fill={color} opacity="0.7" />
    </svg>
  );
}

// Promoted to its own premium section — previously the only guest-facing
// trace of this toggle was 6.5px text on the miniature invitation card and a
// generic "Note" row in the reveal's expand panel, easy to miss entirely.
// Organizer-gated (EventSettings "Adults-Only Notice" toggle,
// event.no_kids_allowed) — off by default, wedding/engagement only.
export default function NoKidsSection({ isRTL }) {
  const C = useFullPageTheme();
  return (
    <SectionShell background={C.paper}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', maxWidth: '480px' }}>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
          letterSpacing: isRTL ? 'normal' : '0.3em', textTransform: isRTL ? 'none' : 'uppercase', color: C.gold,
        }}>
          {isRTL ? 'ملاحظة من قلبنا' : 'A Kind Note'}
        </span>

        <ChampagneGlyph color={C.gold} />

        <h2 style={{
          fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 600, color: C.maroon,
          fontSize: 'clamp(26px, 5.4vw, 38px)', margin: 0, lineHeight: 1.2,
        }}>
          {isRTL ? 'دعوة خاصة بالكبار فقط' : 'An Adults-Only Celebration'}
        </h2>

        <DiamondDivider color={C.gold} />

        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.8, color: C.ink, opacity: 0.82, margin: 0 }}>
          {isRTL
            ? 'نحب أطفالكم كثيرًا، إلا أننا اخترنا أن تكون هذه الليلة خاصة بضيوفنا الكبار فقط. شكرًا جزيلًا لتفهّمكم.'
            : "As much as we adore your little ones, we've chosen to celebrate this evening with our adult guests only. Thank you so much for understanding."}
        </p>
      </div>
    </SectionShell>
  );
}
