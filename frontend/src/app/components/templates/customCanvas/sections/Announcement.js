'use client';

import React from 'react';
import { FadeInUp } from '../../../guest/GuestAnimations';
import { useLiteralTheme } from '../theme';

/* Announcement — framed photo + a longer announcement paragraph (the
   reference's RTL Arabic invitation text block). Reuses the app's existing
   description/description_ar fields, so it's editable through the same
   Details panel every other template already writes to — no new field. */
export default function Announcement({ photoUrl, text, isRTL }) {
  const C = useLiteralTheme();
  if (!text?.trim() && !photoUrl) return null;

  return (
    <div style={{
      minHeight: '70dvh', width: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 32,
      background: C.background, padding: 'clamp(48px, 10vh, 80px) 24px', boxSizing: 'border-box',
    }}>
      {photoUrl && (
        <FadeInUp>
          <div style={{
            width: 'min(80vw, 340px)', aspectRatio: '4 / 5', borderRadius: 16, overflow: 'hidden',
            border: `6px solid ${C.paper}`, boxShadow: `0 24px 60px -20px ${C.gold}55`,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </FadeInUp>
      )}

      {text?.trim() && (
        <FadeInUp delay={0.1}>
          <p
            dir={isRTL ? 'rtl' : 'ltr'}
            lang={isRTL ? 'ar' : undefined}
            style={{
              maxWidth: 560, textAlign: 'center', fontFamily: isRTL ? 'var(--font-arabic-display, var(--font-serif))' : 'var(--font-sans)',
              fontSize: 'clamp(15px, 2.4vw, 18px)', lineHeight: 2, color: C.ink, whiteSpace: 'pre-line', margin: 0,
            }}
          >
            {text}
          </p>
        </FadeInUp>
      )}
    </div>
  );
}
