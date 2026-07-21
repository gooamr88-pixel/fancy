'use client';

import React, { useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLiteralTheme } from '../theme';

/* HeroCouple — the reference file's video-faded couple hero. A CSS
   mask-image bottom fade stands in for the reference's manual canvas
   frame-redraw (same visual result, far cheaper). `revealed` gates video
   playback until CoverReveal has been dismissed — no point spending
   bandwidth/battery on a video hidden behind the cover for guests who
   never open it. Falls back to a plain gradient (today's behavior) when no
   hero video has been uploaded. */
export default function HeroCouple({ partner1, partner2, title, dateLine, timeLine, heroVideoUrl, revealed, isRTL }) {
  const C = useLiteralTheme();
  const reduceMotion = useReducedMotion();
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !heroVideoUrl || !revealed) return;
    const tryPlay = () => v.play().catch(() => {});
    tryPlay();
    document.addEventListener('touchstart', tryPlay, { once: true });
    return () => document.removeEventListener('touchstart', tryPlay);
  }, [heroVideoUrl, revealed]);

  const hasCouple = !!(partner1 && partner2);
  const displayName = hasCouple ? `${partner1} & ${partner2}` : (title || partner1 || partner2 || '');

  return (
    <div style={{
      position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      background: `linear-gradient(180deg, ${C.paper} 0%, ${C.background} 100%)`,
      padding: '80px 20px', boxSizing: 'border-box',
    }}>
      {heroVideoUrl && (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload={revealed ? 'auto' : 'none'}
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            // Bottom-fade mask — same visual effect as the reference's canvas
            // alpha-gradient hack, done in one CSS property instead of a
            // per-frame redraw loop.
            maskImage: 'linear-gradient(to bottom, black 78%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 78%, transparent 100%)',
          }}
        >
          <source src={heroVideoUrl} type="video/mp4" />
        </video>
      )}

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        style={{ position: 'relative', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
      >
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 500, color: C.gold, margin: 0,
          fontSize: 'clamp(38px, 8vw, 64px)', lineHeight: 1.15,
        }}>
          {displayName}
        </h1>

        <span aria-hidden="true" style={{ width: 64, height: 1, background: C.gold, opacity: 0.5 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {dateLine && (
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, letterSpacing: '0.05em', color: C.gold }}>
              {dateLine}
            </span>
          )}
          {dateLine && timeLine && <span aria-hidden="true" style={{ width: 1, height: 18, background: C.gold, opacity: 0.4 }} />}
          {timeLine && (
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, letterSpacing: '0.05em', color: C.gold }}>
              {timeLine}
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
