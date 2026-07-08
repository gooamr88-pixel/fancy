'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { DiamondDivider, ScrollToRsvpHint } from '../shared';

export default function HeroSection({ partner1, partner2, title, tagline, dateLine, coverImageUrl, isRTL, t }) {
  // Wedding-style templates show the two partner names; every other template
  // (corporate/gala/birthday…) has no couple, so the hero shows the event title.
  const hasCouple = !!(partner1 && partner2);
  const displayTagline = tagline || (hasCouple ? (isRTL ? 'يسعدنا زواجنا' : 'We are getting married') : '');
  return (
    <div style={{ position: 'relative', minHeight: '100dvh', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <img
          src={coverImageUrl}
          alt=""
          aria-hidden="true"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(20,12,10,0.15) 0%, rgba(20,12,10,0.15) 45%, rgba(20,12,10,0.55) 100%)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.2 }}
        style={{ position: 'relative', zIndex: 1, textAlign: 'center', color: '#FFFDF8', padding: '0 24px 120px', maxWidth: '720px' }}
      >
        {hasCouple ? (
          <>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 'clamp(38px, 8vw, 68px)', margin: 0, letterSpacing: '0.02em', textShadow: '0 2px 24px rgba(0,0,0,0.35)' }}>
              {partner1}
            </h1>
            <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 'clamp(20px, 3vw, 28px)', margin: '6px 0' }}>&</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 'clamp(38px, 8vw, 68px)', margin: 0, letterSpacing: '0.02em', textShadow: '0 2px 24px rgba(0,0,0,0.35)' }}>
              {partner2}
            </h1>
          </>
        ) : (
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 'clamp(34px, 7vw, 60px)', margin: 0, letterSpacing: '0.02em', textShadow: '0 2px 24px rgba(0,0,0,0.35)' }}>
            {title || partner1 || partner2}
          </h1>
        )}

        {displayTagline && (
          <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 'clamp(15px, 2vw, 19px)', marginTop: '20px', letterSpacing: '0.06em', opacity: 0.95 }}>
            {displayTagline.toUpperCase()}
          </p>
        )}

        <DiamondDivider color="rgba(255,253,248,0.7)" />

        {dateLine && (
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(16px, 2.4vw, 22px)', letterSpacing: '0.03em' }}>
            {dateLine}
          </p>
        )}
      </motion.div>

      <ScrollToRsvpHint isRTL={isRTL} color="#FFFDF8" />
    </div>
  );
}
