'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading, DiamondDivider, ScrollToRsvpHint } from '../shared';
import { FloatingParticles } from '../../../guest/GuestAnimations';

// The event's cover photo, given its own framed slide. The template card is now
// the hero centerpiece, so the photo lives here as a tasteful standalone moment
// instead of a full-bleed hero background. Renders nothing without an image so
// an event with no cover photo simply skips this slide (graceful-hide, like the
// other optional sections).
export default function CoverPhotoSection({ imageUrl, isRTL }) {
  const C = useFullPageTheme();
  if (!imageUrl) return null;

  return (
    <SectionShell background={C.paper}>
      <SectionHeading isRTL={isRTL}>
        {isRTL ? 'لمحة' : 'A Glimpse'}
      </SectionHeading>
      <DiamondDivider />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative', width: '100%', maxWidth: '440px', aspectRatio: '4/5',
          borderRadius: '18px', overflow: 'hidden', marginTop: '8px',
          boxShadow: '0 28px 70px rgba(20,12,10,0.32)',
          border: `1px solid ${C.border}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* Thin inset frame line for a matted, gallery-print feel */}
        <div
          aria-hidden="true"
          style={{ position: 'absolute', inset: '10px', border: `1px solid rgba(255,255,255,0.35)`, borderRadius: '10px', pointerEvents: 'none' }}
        />
        {/* Small gold bokeh circles drifting over the photo — same ambient
            particle system used for the hero stage, scoped to this frame and
            tinted from the event's own palette so it never fights the photo. */}
        <FloatingParticles count={18} color={C.gold} shape="circle" />
      </motion.div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
