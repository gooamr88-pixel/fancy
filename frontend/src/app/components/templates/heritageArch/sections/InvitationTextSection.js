'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useFullPageTheme } from '../theme';
import { SectionShell, DiamondDivider } from '../shared';

// A formal invitation paragraph in an ornate frame, matching the reference's
// Arabic invitation panel — composed entirely from data the couple already
// entered (names/date/venue), not a new field, and only rendered for
// couple-style events (wedding/engagement) since the phrasing assumes two
// partners the way the reference's own wording does.
export default function InvitationTextSection({ partner1, partner2, dateLine, timeLine, venueName, isRTL }) {
  const C = useFullPageTheme();
  const reduce = useReducedMotion();

  const body = isRTL
    ? `الآنسة ${partner1} والسيد ${partner2} يسعدهما ويشرّفهما دعوتكم الكريمة لمشاركتهما فرحة زفافهما${dateLine ? `، وذلك يوم ${dateLine}` : ''}${timeLine ? ` عند الساعة ${timeLine}` : ''}${venueName ? `، بـ${venueName}` : ''}.`
    : `${partner1} and ${partner2} joyfully invite you to share in the celebration of their wedding${dateLine ? `, on ${dateLine}` : ''}${timeLine ? ` at ${timeLine}` : ''}${venueName ? `, at ${venueName}` : ''}.`;

  return (
    <SectionShell>
      <div style={{
        position: 'relative', maxWidth: '560px', width: '100%',
        padding: 'clamp(32px, 6vw, 48px) clamp(24px, 5vw, 40px)',
        border: `1px solid ${C.gold}55`, borderRadius: '4px',
        boxShadow: `inset 0 0 0 6px ${C.background}, inset 0 0 0 7px ${C.gold}30`,
      }}>
        {[
          { top: -1, left: -1, rotate: 0 },
          { top: -1, right: -1, rotate: 90 },
          { bottom: -1, right: -1, rotate: 180 },
          { bottom: -1, left: -1, rotate: 270 },
        ].map((pos, i) => (
          <svg key={i} width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true"
            style={{ position: 'absolute', ...pos, transform: `rotate(${pos.rotate}deg)` }}>
            <path d="M2 28 C2 14, 14 2, 28 2" stroke={C.gold} strokeWidth="1.4" opacity="0.6" fill="none" />
            <circle cx="4" cy="4" r="2.6" fill={C.gold} opacity="0.7" />
          </svg>
        ))}

        <p style={{
          textAlign: 'center', fontFamily: isRTL ? "'Traditional Arabic', var(--font-serif)" : 'var(--font-serif)',
          fontSize: isRTL ? 'clamp(18px, 3vw, 22px)' : 'clamp(16px, 2.6vw, 19px)',
          lineHeight: isRTL ? 2.1 : 1.9, color: C.ink, margin: 0,
        }}>
          {body}
        </p>

        <DiamondDivider color={C.gold} />

        <motion.div
          aria-hidden="true"
          animate={reduce ? undefined : { y: [0, -5, 0] }}
          transition={reduce ? undefined : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ display: 'flex', justifyContent: 'center' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={C.gold}>
            <path d="M12 21s-7.5-4.6-10.2-9.3C.3 8.7 1.6 5 5 4.2c2.1-.5 4 .5 5 2.3 1-1.8 2.9-2.8 5-2.3 3.4.8 4.7 4.5 3.2 7.5C19.5 16.4 12 21 12 21Z" />
          </svg>
        </motion.div>
      </div>
    </SectionShell>
  );
}
