'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useFullPageTheme } from '../theme';
import { SectionShell, DiamondDivider } from '../shared';
import Icon from '../../../icons/Icon';

// The event's date/time, promoted to its own full section right after the
// Hero/invitation card instead of a small pill crammed underneath it — the
// single most important fact on the page deserves a moment of its own, not
// an afterthought. Both date and time share one serif treatment (the
// template's own configured heading font, never a hardcoded one, so this
// still recolors/refonts correctly across every style variant) instead of
// mixing an elegant serif date with a bold sans time, which read as two
// unrelated pieces of UI rather than one clear answer to "when."
export default function EventDateSection({ dateLine, timeLine, isRTL }) {
  const C = useFullPageTheme();
  const reduce = useReducedMotion();
  if (!dateLine) return null;

  return (
    <SectionShell background={C.paper}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center' }}
      >
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
          letterSpacing: isRTL ? 'normal' : '0.32em', textTransform: isRTL ? 'none' : 'uppercase', color: C.gold,
        }}>
          {isRTL ? 'موعد الاحتفال' : 'Save the Date'}
        </span>

        <Icon name="calendar" size={26} color={C.gold} strokeWidth={1.4} />

        <h2 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 600, color: C.maroon,
          fontSize: 'clamp(30px, 6.4vw, 52px)', letterSpacing: isRTL ? 'normal' : '0.02em', lineHeight: 1.15, margin: 0,
        }}>
          {dateLine}
        </h2>

        {timeLine && (
          <>
            <DiamondDivider color={C.gold} />
            <p style={{
              fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 500,
              fontSize: 'clamp(20px, 3.8vw, 28px)', color: C.ink, letterSpacing: isRTL ? 'normal' : '0.03em', margin: 0,
            }}>
              {timeLine}
            </p>
          </>
        )}
      </motion.div>
    </SectionShell>
  );
}
