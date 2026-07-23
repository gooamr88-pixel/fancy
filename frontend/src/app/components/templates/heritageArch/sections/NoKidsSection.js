'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useFullPageTheme } from '../theme';
import { SectionShell, DiamondDivider } from '../shared';

// A small closing seal — a heart cradled in a thin gold ring — under the
// "thank you for understanding" line, so the notice closes on a warm,
// deliberate flourish instead of just trailing off after the paragraph.
function GraciousBadge({ color, isRTL, reduce }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={reduce ? { duration: 0 } : { duration: 0.5, delay: 0.15, type: 'spring', stiffness: 260, damping: 18 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
    >
      <span style={{
        width: '52px', height: '52px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${color}`, boxShadow: `inset 0 0 0 1px ${color}30`,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill={color} aria-hidden="true">
          <path d="M12 21s-7.5-4.6-10.2-9.3C.3 8.7 1.6 5 5 4.2c2.1-.5 4 .5 5 2.3 1-1.8 2.9-2.8 5-2.3 3.4.8 4.7 4.5 3.2 7.5C19.5 16.4 12 21 12 21Z" />
        </svg>
      </span>
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 700,
        letterSpacing: isRTL ? 'normal' : '0.14em', textTransform: isRTL ? 'none' : 'uppercase', color, opacity: 0.85,
      }}>
        {isRTL ? 'بكل محبة' : 'With Love'}
      </span>
    </motion.div>
  );
}

// A clear, unmistakable "no kids allowed" marker — thin-stroke pictogram (a
// figure with a single diagonal bar, the same universal mark used on venue
// signage) inside a pill badge, so the policy itself is legible at a glance
// even if a guest skips the paragraph. Kept fine-line and gold-on-paper
// rather than a bold red prohibition icon, so it still reads as refined.
function NoKidsBadge({ color, isRTL }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '8px 16px', borderRadius: '999px',
      border: `1px solid ${color}`, background: `${color}14`,
    }}>
      <svg width="16" height="16" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <circle cx="14" cy="8" r="3.4" stroke={color} strokeWidth="1.6" />
        <path d="M14 11.8c-3.6 0-6.4 2.4-6.8 6.6h13.6c-.4-4.2-3.2-6.6-6.8-6.6Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
        <line x1="5" y1="23" x2="23" y2="5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: '10.5px', fontWeight: 700,
        letterSpacing: isRTL ? 'normal' : '0.16em', textTransform: isRTL ? 'none' : 'uppercase', color,
      }}>
        {isRTL ? 'ممنوع اصطحاب الأطفال' : 'No Kids Allowed'}
      </span>
    </div>
  );
}

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
  const reduce = useReducedMotion();
  return (
    <SectionShell background={C.paper}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', maxWidth: '480px' }}>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
          letterSpacing: isRTL ? 'normal' : '0.3em', textTransform: isRTL ? 'none' : 'uppercase', color: C.gold,
        }}>
          {isRTL ? 'ملاحظة من قلبنا' : 'A Kind Note'}
        </span>

        <NoKidsBadge color={C.gold} isRTL={isRTL} />

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

        <div style={{ marginTop: '4px' }}>
          <GraciousBadge color={C.gold} isRTL={isRTL} reduce={reduce} />
        </div>
      </div>
    </SectionShell>
  );
}
