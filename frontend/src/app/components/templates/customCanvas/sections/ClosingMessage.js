'use client';

import React from 'react';
import { FadeInUp } from '../../../guest/GuestAnimations';
import { useLiteralTheme } from '../theme';

/* ClosingMessage — the reference's closing line ("Au plaisir de vous
   accueillir"). New template_data.closingMessage field, plain JSON — no
   migration needed, same pattern as every other Custom-Canvas-editable
   field (e.g. ha_getting_there). */
export default function ClosingMessage({ text, isRTL }) {
  const C = useLiteralTheme();
  if (!text?.trim()) return null;

  return (
    <div style={{
      minHeight: '50dvh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: C.background, padding: 'clamp(48px, 10vh, 80px) 24px', boxSizing: 'border-box',
    }}>
      <FadeInUp>
        <p
          dir={isRTL ? 'rtl' : 'ltr'}
          style={{
            maxWidth: 520, textAlign: 'center', fontFamily: 'var(--font-serif)', fontStyle: 'italic',
            fontSize: 'clamp(20px, 3.5vw, 28px)', color: C.gold, lineHeight: 1.6, margin: 0,
          }}
        >
          {text}
        </p>
      </FadeInUp>
    </div>
  );
}
