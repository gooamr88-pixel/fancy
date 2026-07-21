'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { deriveIdentity, buildBotanicalPalette } from '../../guest/InvitationReveal';

/* CoverReveal — the Custom Canvas literal port's own petal-open cover,
   replacing InvitationReveal for THIS template only (see EventPageClient.js's
   couple-category branch). Reuses InvitationReveal's identity/no-kids-notice
   logic (exported for this purpose) so nothing already built there is lost —
   only the visual (rotated petal images sliding apart, matching the reference
   file) is different from the generated wax-seal envelope.

   The petal/flower-line imagery below is the reference file's own asset URLs,
   used directly per instruction — third-party (Tilda CDN) hosting, flagged in
   the plan as needing to move to this app's own storage before a real launch. */
const PETAL_IMG = 'https://static.tildacdn.net/tild6233-6433-4662-a437-316665346637/Gemini_Generated_Ima.png';
const FLOWER_LINE_IMG = 'https://static.tildacdn.net/tild6566-6361-4436-a235-323435366264/line_flower_1.png';

export default function CoverReveal({ event, guestName, isRTL, onOpen }) {
  const reduceMotion = useReducedMotion();
  const [opening, setOpening] = useState(false);
  const identity = deriveIdentity(event, isRTL ? 'ar' : 'en');
  const palette = buildBotanicalPalette(event?.custom_colors);
  // Same organizer-controlled, off-by-default flag InvitationReveal already
  // reads — carried forward so nothing regresses for this template.
  const showNoKids = (event?.template_type === 'wedding' || event?.template_type === 'engagement' || event?.template_type === 'custom') && !!event?.no_kids_allowed;
  const promptText = guestName
    ? (isRTL ? `${guestName}، اضغط للفتح` : `${guestName}, tap to open`)
    : (isRTL ? 'اضغط على الختم لفتح الدعوة' : 'Tap the seal to open');

  const handleOpen = useCallback(() => {
    if (opening) return;
    setOpening(true);
    setTimeout(() => { onOpen?.(); }, reduceMotion ? 0 : 900);
  }, [opening, onOpen, reduceMotion]);

  return (
    <AnimatePresence>
      <motion.div
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        data-testid="custom-canvas-cover-reveal"
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: palette.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {[0, 90, 180, 270].map((deg, i) => {
          const dir = i % 2 === 0 ? 1 : -1;
          return (
            <motion.div
              key={deg}
              aria-hidden="true"
              initial={false}
              animate={opening ? { x: dir * 260, opacity: 0 } : { x: 0, opacity: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.6, 0, 0.4, 1], delay: reduceMotion ? 0 : i * 0.05 }}
              style={{
                position: 'absolute', width: 'min(70vw, 380px)', height: 'min(70vw, 380px)',
                backgroundImage: `url(${PETAL_IMG})`, backgroundSize: 'cover', backgroundPosition: 'center',
                transform: `rotate(${deg}deg)`, opacity: 0.9,
              }}
            />
          );
        })}

        <motion.div
          initial={false}
          animate={opening ? { opacity: 0, scale: 0.9 } : { opacity: 1, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.5 }}
          style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center', padding: 24 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FLOWER_LINE_IMG} alt="" aria-hidden="true" style={{ width: 160, opacity: 0.85 }} />
          <h2 style={{ fontFamily: 'var(--font-serif)', color: palette.accent, fontSize: 'clamp(24px, 5vw, 34px)', margin: 0, fontWeight: 600 }}>
            {identity.full}
          </h2>
          <button
            type="button"
            onClick={handleOpen}
            aria-label={isRTL ? 'افتح الدعوة' : 'Open the invitation'}
            style={{
              width: 96, height: 96, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: `radial-gradient(circle at 35% 30%, ${palette.waxHi}, ${palette.wax} 60%, ${palette.waxLo})`,
              boxShadow: `0 12px 30px ${palette.waxLo}66`,
              color: palette.card, fontFamily: "'Mrs Saint Delafield', var(--font-script), cursive",
              fontSize: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {identity.sealText}
          </button>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: palette.accent }}>
            {promptText}
          </span>
          {showNoKids && (
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, letterSpacing: '0.06em', color: palette.inkSoft, opacity: 0.75 }}>
              {isRTL ? 'دعوة خاصة بالكبار فقط' : 'No Kids Allowed'}
            </span>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
