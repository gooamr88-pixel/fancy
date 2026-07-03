'use client';

/**
 * DigitalEnvelope — the luxury "digital wax seal" landing experience that gates
 * the public RSVP route (/[slug]/rsvp). It mounts as a fixed full-screen overlay
 * ON TOP of the already-rendered RSVP form / AlreadyRegistered card.
 *
 * Visual layers (back → front):
 *   1. Stage      — ivory→champagne wash + (optional) embossed arabesque pattern.
 *   2. God-rays   — conic-gradient spoke disc, radially masked (light beams).
 *   3. Down-beam  — clipPath triangle of gold light flooding downward.
 *   4. Core bloom — radial-gradient orb erupting from the seal centre.
 *   5. Seal       — the 3D metallic bronze medallion (image asset OR CSS fallback)
 *                   with the guest's name CAST into the metal via background-clip:text.
 *   6. Whiteout   — full-screen white→gold radial overlay; the cinematic gateway.
 *
 * Phase machine:  idle → igniting → flooding → reveal
 *   • Every animated property is transform / opacity / filter (GPU-composited),
 *     so the whole sequence stays at 60fps on mobile.
 *   • On the final `reveal` fade the form underneath cross-dissolves into view;
 *     onAnimationComplete fires onOpen() to unmount this overlay.
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { lighten, darken } from '../../utils/color';
import { getCelebrationPreset } from '../../utils/patternCelebration';
import { playSealOpen } from '../../utils/sound';
import { buzz } from './GuestUI';
import { FloatingParticles, ConfettiExplosion } from './GuestAnimations';

/* ═══ Palette derivation — every event gets its OWN "molten seal" palette,
   built from its actual theme colors instead of one fixed warm gold. The
   ignite sequence (medallion, god-rays, molten glow) stays identical in
   structure; only the color story changes, so a Nordic Frost event opens
   into icy silver-blue light while a Midnight Orchid event opens into
   gilded plum, instead of every event sharing the same bronze wax seal. ═══*/
function derivePalette(primary, secondary) {
  const p = primary || '#B8944F';
  const s = secondary || lighten(p, 0.35);
  return {
    ivory: lighten(s, 0.86),
    ivoryDeep: lighten(s, 0.74),
    champagne: lighten(s, 0.3),
    champagneLt: lighten(s, 0.55),
    bronze: p,
    bronzeDeep: darken(p, 0.55),
    bronzeShadow: darken(p, 0.75),
    gold: lighten(p, 0.15),
    goldBright: lighten(p, 0.42),
    white: '#FFFCEF',
  };
}

/* Static spoke geometry → deterministic, no hydration mismatch. */
const RAY_MASK = 'radial-gradient(circle, transparent 16%, #000 30%, #000 60%, transparent 78%)';

export default function DigitalEnvelope({
  guestName = '',
  eventTitle = '',
  isRTL = false,
  themeColor = '#B8944F',
  secondaryColor = null,
  /* The event's template_type — drives the ambient particle atmosphere
     (petals/snow/gold dust) so the envelope already feels like THIS
     invitation before it's even opened. */
  pattern = null,
  /* Drop the carved-medallion PNG here (transparent centre). Falls back to a
     fully CSS-generated bronze disc when absent. */
  sealImageUrl = null,
  /* Optional glowing/gold variant cross-faded in on tap (defaults to the base
     seal so a single asset still works). */
  sealImageGoldUrl = null,
  /* The embossed arabesque background tile. Falls back to CSS gradients. */
  patternUrl = null,
  onOpen,
}) {
  const C = useMemo(() => derivePalette(themeColor, secondaryColor), [themeColor, secondaryColor]);
  const resolvedSecondary = secondaryColor || C.champagne;
  const ambient = useMemo(() => getCelebrationPreset(pattern), [pattern]);
  const [phase, setPhase] = useState('idle');
  const timers = useRef([]);
  const reduced = useRef(false);

  /* ── Magnetic tilt: the seal leans toward the cursor/finger before it's
     tapped, like a real medallion catching the light — an invitation to
     touch it, not just a static button. Disabled once ignited. ── */
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const sealRotateX = useTransform(tiltY, [-0.5, 0.5], [12, -12]);
  const sealRotateY = useTransform(tiltX, [-0.5, 0.5], [-12, 12]);
  const handleSealPointerMove = useCallback((e) => {
    if (reduced.current || phase !== 'idle') return;
    const rect = e.currentTarget.getBoundingClientRect();
    tiltX.set((e.clientX - rect.left) / rect.width - 0.5);
    tiltY.set((e.clientY - rect.top) / rect.height - 0.5);
  }, [tiltX, tiltY, phase]);
  const handleSealPointerLeave = useCallback(() => { tiltX.set(0); tiltY.set(0); }, [tiltX, tiltY]);

  useEffect(() => {
    reduced.current =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Capture the stable timers array so cleanup clears exactly what we scheduled.
    const scheduled = timers.current;
    return () => scheduled.forEach(clearTimeout);
  }, []);

  const ignite = useCallback(() => {
    if (phase !== 'idle') return;
    buzz([10, 30, 10, 30, 40]); // a little ramp, like the seal cracking then flooding with light
    playSealOpen();
    const r = reduced.current;
    const at = (ms, fn) => timers.current.push(setTimeout(fn, r ? ms * 0.35 : ms));
    setPhase('igniting');
    at(480, () => setPhase('flooding'));
    at(1500, () => setPhase('reveal'));
    // onOpen is fired by the whiteout's onAnimationComplete in the reveal phase,
    // guaranteeing the form is revealed only after the cross-dissolve finishes.
  }, [phase]);

  const is = (...p) => p.includes(phase);
  const lit = is('igniting', 'flooding', 'reveal');

  /* ── Seal text: dynamic, derived from guest_name (falls back to title). ── */
  const rawText = (guestName || eventTitle || (isRTL ? 'ضيفنا الكريم' : 'Our Guest')).trim();
  // Keep the medallion centre legible: long names collapse to initials.
  const sealText =
    rawText.length <= 12
      ? rawText
      : rawText.split(/\s+/).map(w => w.charAt(0)).join('').slice(0, 3).toUpperCase();
  const sealFontSize = Math.max(20, Math.min(46, 300 / Math.max(sealText.length, 2)));
  const calligraphyFont = isRTL
    ? 'var(--font-arabic-display), var(--font-arabic), serif'
    : 'var(--font-serif), Georgia, serif';

  /* ── Engraved (idle) vs molten (lit) text treatments ── */
  const metalGradient = `linear-gradient(160deg, ${C.champagneLt} 0%, ${C.bronze} 42%, ${C.bronzeDeep} 70%, ${C.champagne} 100%)`;
  const moltenGradient = `linear-gradient(160deg, ${C.white} 0%, ${C.goldBright} 35%, ${C.gold} 75%, ${C.goldBright} 100%)`;
  const engravedShadow = [
    `0 1px 0 ${hexA(C.champagneLt, 0.6)}`,   // raised lip catching light
    `0 -1px 1px ${hexA(C.bronzeShadow, 0.7)}`, // debossed inner recess
    `0 2px 4px ${hexA(C.bronzeShadow, 0.55)}`, // cast contact shadow
  ].join(', ');
  const moltenShadow = [
    `0 0 14px ${hexA(C.gold, 0.95)}`,
    `0 0 36px ${hexA(C.goldBright, 0.85)}`,
    `0 0 70px ${hexA(C.gold, 0.6)}`,
  ].join(', ');

  return (
    <motion.div
      key="digital-envelope"
      dir={isRTL ? 'rtl' : 'ltr'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-sans)', WebkitTapHighlightColor: 'transparent',
        background: `radial-gradient(130% 110% at 50% 8%, ${hexA(resolvedSecondary, 0.35)} 0%, ${C.ivory} 42%, ${C.ivoryDeep} 100%)`,
      }}
    >
      {/* ═══ Layer 1a: ambient atmosphere — drifting petals/snow/gold dust
           matched to this event's template, present before the seal is even
           tapped, fading out once the light takes over. ═══ */}
      <motion.div
        aria-hidden
        initial={false}
        animate={{ opacity: is('idle') ? 1 : 0 }}
        transition={{ duration: 0.6 }}
        style={{ position: 'absolute', inset: 0, zIndex: 0 }}
      >
        <FloatingParticles count={22} color={ambient.ambientColor || resolvedSecondary} shape={ambient.ambient} />
      </motion.div>

      {/* ═══ Layer 1b: embossed arabesque pattern (graceful fallback) ═══ */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: patternUrl
            ? `url(${patternUrl})`
            : `var(--envelope-pattern,
                repeating-conic-gradient(from 0deg at 50% 50%, ${hexA(C.bronze, 0.05)} 0deg 12deg, transparent 12deg 24deg),
                radial-gradient(circle at 50% 50%, ${hexA(C.bronze, 0.06)} 0%, transparent 60%))`,
          backgroundSize: patternUrl ? '420px' : 'auto',
          backgroundRepeat: 'repeat',
          opacity: 0.5,
          mixBlendMode: 'multiply',
          // Pressed-paper vignette to add depth around the edges.
          boxShadow: `inset 0 0 220px ${hexA(C.bronzeDeep, 0.16)}`,
        }}
      />

      {/* ═══ Layer 2: god-rays (conic spokes, radially masked) ═══ */}
      <motion.div
        aria-hidden
        initial={false}
        animate={{
          scale: is('flooding', 'reveal') ? 3.2 : is('igniting') ? 1.1 : 0.6,
          opacity: is('flooding') ? 1 : is('reveal') ? 0.4 : 0,
          rotate: lit ? 26 : 0,
        }}
        transition={{ duration: is('reveal') ? 0.6 : 1.1, ease: 'easeOut' }}
        style={{
          position: 'absolute', top: '44%', left: '50%',
          width: 'min(120vw, 900px)', height: 'min(120vw, 900px)',
          transform: 'translate(-50%, -50%)', transformOrigin: 'center',
          willChange: 'transform, opacity', pointerEvents: 'none',
          background: `repeating-conic-gradient(from 0deg,
            ${hexA(C.goldBright, 0)} 0deg 5deg,
            ${hexA(C.goldBright, 0.7)} 6deg 7deg,
            ${hexA(C.gold, 0)} 8deg 10deg)`,
          WebkitMaskImage: RAY_MASK, maskImage: RAY_MASK,
          filter: 'blur(0.5px)',
        }}
      />

      {/* ═══ Layer 3: downward flood beam (V-shaped cone) ═══ */}
      <motion.div
        aria-hidden
        initial={false}
        animate={{
          scaleY: is('flooding', 'reveal') ? 1 : 0.1,
          opacity: is('flooding') ? 0.95 : is('reveal') ? 0.5 : 0,
        }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        style={{
          position: 'absolute', top: '46%', left: '50%',
          width: 'min(90vw, 620px)', height: '70vh',
          transform: 'translateX(-50%)', transformOrigin: 'top center',
          willChange: 'transform, opacity', pointerEvents: 'none',
          background: `linear-gradient(180deg, ${hexA(C.goldBright, 0.9)} 0%, ${hexA(C.gold, 0.45)} 35%, ${hexA(C.gold, 0)} 100%)`,
          clipPath: 'polygon(38% 0, 62% 0, 100% 100%, 0 100%)',
          filter: 'blur(6px)',
        }}
      />

      {/* ═══ Layer 4: core bloom (erupts from the seal centre) ═══ */}
      <motion.div
        aria-hidden
        initial={false}
        animate={{
          scale: is('flooding', 'reveal') ? 3 : is('igniting') ? 1.5 : 0.4,
          opacity: lit ? 1 : 0,
        }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        style={{
          position: 'absolute', top: '44%', left: '50%',
          width: 360, height: 360, transform: 'translate(-50%, -50%)',
          willChange: 'transform, opacity', pointerEvents: 'none',
          background: `radial-gradient(circle, ${hexA(C.white, 0.95)} 0%, ${hexA(C.goldBright, 0.8)} 25%, ${hexA(C.gold, 0.35)} 50%, ${hexA(C.gold, 0)} 75%)`,
        }}
      />

      {/* A quick themed burst — the same petals/stars/snow family as the rest
          of the guest journey — right as the seal floods with light, instead
          of the ignition being color-only. */}
      {is('flooding') && !reduced.current && (
        <ConfettiExplosion active duration={1300} particleCount={44} spread={0.65} colors={ambient.colors} shapes={ambient.shapes} />
      )}

      {/* ═══ Stage content (seal + copy) ═══ */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34, padding: 24, perspective: 900 }}>

        {/* ── The 3D metallic seal — leans toward the cursor/finger like a real medallion ── */}
        <motion.button
          onClick={ignite}
          onPointerMove={handleSealPointerMove}
          onPointerLeave={handleSealPointerLeave}
          aria-label="Open invitation"
          disabled={phase !== 'idle'}
          whileTap={phase === 'idle' ? { scale: 0.96 } : {}}
          initial={false}
          animate={{
            scale: is('igniting') ? 1.08 : is('flooding', 'reveal') ? 1.18 : 1,
            filter: lit ? 'brightness(1.5)' : 'brightness(1)',
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            position: 'relative', width: 'min(62vw, 250px)', aspectRatio: '1',
            border: 'none', padding: 0, background: 'transparent',
            cursor: phase === 'idle' ? 'pointer' : 'default',
            willChange: 'transform, filter', borderRadius: '50%',
            rotateX: sealRotateX, rotateY: sealRotateY, transformStyle: 'preserve-3d',
          }}
        >
          {/* Idle breathing aura behind the disc */}
          <motion.span
            aria-hidden
            animate={phase === 'idle' ? { opacity: [0.35, 0.6, 0.35], scale: [1, 1.08, 1] } : { opacity: 0 }}
            transition={phase === 'idle' ? { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
            style={{
              position: 'absolute', inset: '-14%', borderRadius: '50%',
              background: `radial-gradient(circle, ${hexA(themeColor, 0.45)} 0%, ${hexA(themeColor, 0)} 70%)`,
              pointerEvents: 'none',
            }}
          />

          {/* The carved bronze disc — image asset OR CSS-generated medallion */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            ...(sealImageUrl
              ? { backgroundImage: `url(${sealImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : cssMedallion(C)),
            boxShadow: `0 22px 48px -12px ${hexA(C.bronzeShadow, 0.6)},
                        inset 0 3px 6px ${hexA(C.champagneLt, 0.55)},
                        inset 0 -10px 22px ${hexA(C.bronzeShadow, 0.55)}`,
          }} />

          {/* The wax seal cracking open — a burst of jagged fissures that
              flashes across the medallion the instant it's tapped, before
              the light takes over. Purely decorative, so it's skipped
              entirely once lit fades it back out. */}
          <motion.svg
            aria-hidden
            viewBox="0 0 100 100"
            initial={false}
            animate={{ opacity: is('igniting') ? 1 : 0 }}
            transition={{ duration: is('igniting') ? 0.12 : 0.4 }}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {[
              'M50 50 L18 28', 'M50 50 L82 22', 'M50 50 L14 62',
              'M50 50 L86 68', 'M50 50 L46 92', 'M50 50 L60 12',
            ].map((d, i) => (
              <path key={i} d={d} stroke={C.white} strokeWidth="0.8" strokeLinecap="round" fill="none"
                opacity="0.85" style={{ filter: `drop-shadow(0 0 3px ${hexA(C.goldBright, 0.9)})` }} />
            ))}
          </motion.svg>

          {/* Gold/glowing seal variant — cross-faded in on tap (image seals only) */}
          {sealImageUrl && sealImageGoldUrl && sealImageGoldUrl !== sealImageUrl && (
            <motion.div
              aria-hidden
              initial={false}
              animate={{ opacity: lit ? 1 : 0 }}
              transition={{ duration: 0.5 }}
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                backgroundImage: `url(${sealImageGoldUrl})`, backgroundSize: 'cover', backgroundPosition: 'center',
                willChange: 'opacity', pointerEvents: 'none',
              }}
            />
          )}

          {/* Dynamic engraved calligraphy — always cast into the metal, including
              over a custom seal (organizer seals ship with a transparent centre
              so our CSS engraves the guest's own name into them). */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '24%',
          }}>
            <motion.span
              initial={false}
              animate={{ scale: lit ? 1.04 : 1 }}
              transition={{ duration: 0.5 }}
              style={{
                fontFamily: calligraphyFont,
                fontSize: sealFontSize, fontWeight: 700, lineHeight: 1.05,
                textAlign: 'center', letterSpacing: isRTL ? 0 : '0.02em',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                // Layer 1 — the metal fill (clipped to the glyphs):
                backgroundImage: lit ? moltenGradient : metalGradient,
                WebkitBackgroundClip: 'text', backgroundClip: 'text',
                WebkitTextFillColor: 'transparent', color: 'transparent',
                // Layer 2 — bevel / molten glow:
                textShadow: lit ? moltenShadow : engravedShadow,
                transition: 'background-image 0.5s ease, text-shadow 0.5s ease',
                filter: lit ? `drop-shadow(0 0 18px ${hexA(C.gold, 0.7)})` : 'none',
              }}
            >
              {sealText}
            </motion.span>
          </div>
        </motion.button>

        {/* ── Copy (fades out as the seal ignites) ── */}
        <motion.div
          initial={false}
          animate={{ opacity: phase === 'idle' ? 1 : 0, y: phase === 'idle' ? 0 : 8 }}
          transition={{ duration: 0.4 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center' }}
        >
          <span style={{
            fontFamily: 'var(--font-serif)', fontStyle: 'italic',
            fontSize: 'clamp(13px, 3.4vw, 16px)', letterSpacing: '0.04em',
            color: C.bronzeDeep, maxWidth: 320, lineHeight: 1.6,
          }}>
            {isRTL ? 'يسعدنا دعوتكم لمشاركتنا يومنا المميز' : 'You are invited for our special day'}
          </span>
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.32em',
              textTransform: 'uppercase', color: themeColor,
            }}
          >
            {isRTL ? 'اضغط للفتح' : 'Tap to open'}
          </motion.span>
        </motion.div>
      </div>

      {/* ═══ Layer 6: whiteout gateway (the cinematic cross-dissolve) ═══ */}
      <motion.div
        aria-hidden
        initial={false}
        animate={{ opacity: is('flooding') ? 1 : is('reveal') ? 0 : 0 }}
        transition={{ duration: is('reveal') ? 0.65 : 0.7, ease: 'easeInOut' }}
        onAnimationComplete={() => { if (phase === 'reveal') onOpen && onOpen(); }}
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          willChange: 'opacity',
          background: `radial-gradient(circle at 50% 44%, ${C.white} 0%, ${C.goldBright} 40%, ${C.gold} 100%)`,
        }}
      />
    </motion.div>
  );
}

/* ── CSS-generated bronze medallion (used when no seal image is supplied) ── */
function cssMedallion(C) {
  return {
    background: `
      radial-gradient(circle at 50% 50%, ${hexA(C.champagneLt, 0.9)} 0%, ${hexA(C.champagneLt, 0)} 30%),
      repeating-conic-gradient(from 0deg at 50% 50%, ${C.bronzeDeep} 0deg 3deg, ${C.bronze} 3deg 6deg),
      radial-gradient(circle at 38% 32%, ${C.champagneLt} 0%, ${C.bronze} 45%, ${C.bronzeDeep} 100%)`,
    backgroundBlendMode: 'overlay, soft-light, normal',
    border: `2px solid ${hexA(C.bronzeShadow, 0.5)}`,
  };
}

/* Hex (#RRGGBB) → rgba() with alpha. */
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
