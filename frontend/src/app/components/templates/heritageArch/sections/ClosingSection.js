'use client';

import React from 'react';
import { useFullPageTheme } from '../theme';
import { SectionShell, DiamondDivider } from '../shared';

// A small decorative spray — leaves fanning from a stem, echoing the vine
// motifs used elsewhere in this template family (shared.js's VineLine) —
// tinted from the event's own gold, not an organizer upload.
function FarewellFlourish({ color }) {
  return (
    <svg width="90" height="46" viewBox="0 0 90 46" fill="none" aria-hidden="true">
      <path d="M45 44V10" stroke={color} strokeWidth="1.3" opacity="0.6" />
      {[-28, -16, -6, 6, 16, 28].map((dx, i) => (
        <ellipse key={i}
          cx={45 + dx} cy={26 - Math.abs(dx) * 0.35} rx="9" ry="3.6"
          fill={color} opacity={0.5 - Math.abs(dx) * 0.006}
          transform={`rotate(${dx > 0 ? -35 : 35} ${45 + dx} ${26 - Math.abs(dx) * 0.35})`}
        />
      ))}
      <circle cx="45" cy="8" r="4.5" fill={color} opacity="0.75" />
    </svg>
  );
}

export default function ClosingSection({ closingMessage, isRTL }) {
  const C = useFullPageTheme();
  const message = closingMessage || (isRTL ? 'بشغف ننتظر استقبالكم' : 'Looking forward to welcoming you');

  return (
    <SectionShell style={{ minHeight: '40dvh' }}>
      <h2 style={{
        fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 600,
        fontSize: 'clamp(26px, 4.6vw, 38px)', color: C.maroon, margin: 0, textAlign: 'center',
      }}>
        {message}
      </h2>
      <FarewellFlourish color={C.gold} />
      <DiamondDivider color={C.gold} />
    </SectionShell>
  );
}
