'use client';

import React, { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useFullPageTheme } from '../theme';
import { DiamondDivider, ScrollToRsvpHint } from '../shared';
import InvitationCard from '../../InvitationCard';
import EventCategoryIcon from '../../../icons/EventCategoryIcon';
import Icon from '../../../icons/Icon';

// A small corner flourish drawn in the theme's gold — mirrored into each corner
// of the stationery frame so the hero reads as an engraved invitation rather
// than a card floating on a flat fill.
function CornerFlourish({ color, style }) {
  return (
    <svg width="54" height="54" viewBox="0 0 54 54" fill="none" aria-hidden="true" style={{ position: 'absolute', ...style }}>
      <path d="M2 2 L2 20 M2 2 L20 2" stroke={color} strokeWidth="1.2" opacity="0.7" />
      <path d="M2 2 Q26 6 30 30" stroke={color} strokeWidth="1" fill="none" opacity="0.45" />
      <circle cx="2" cy="2" r="2.4" fill={color} opacity="0.6" />
    </svg>
  );
}

// Organizer-uploaded looping hero video, drawn through a canvas so the bottom
// edge can fade to transparent (destination-out punch-through) instead of
// cutting off hard — the video element itself stays hidden and is only the
// canvas's source frame. Falls back to nothing (parent keeps its gradient)
// if the video never becomes playable.
function HeroVideoBackground({ src }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf;
    let running = true;

    const resize = () => {
      if (!video.videoWidth) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    };
    const draw = () => {
      if (!running) return;
      if (!video.paused && !video.ended && video.videoWidth) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const gradient = ctx.createLinearGradient(0, canvas.height * 0.7, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = gradient;
        ctx.fillRect(0, canvas.height * 0.7, canvas.width, canvas.height * 0.3);
        ctx.globalCompositeOperation = 'source-over';
      }
      raf = requestAnimationFrame(draw);
    };
    const play = () => video.play().catch(() => {});

    video.addEventListener('loadedmetadata', resize);
    video.addEventListener('canplay', play);
    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      video.removeEventListener('loadedmetadata', resize);
      video.removeEventListener('canplay', play);
    };
  }, [src]);

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
      <video
        ref={videoRef} src={src} muted loop playsInline preload="auto"
        style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', visibility: 'hidden' }}
      />
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {/* Neutral dark scrim — works over any organizer-uploaded footage,
          unlike a theme-colored one which could clash with the video itself.
          Keeps foreground text legible regardless of what was uploaded. */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.32) 60%, rgba(0,0,0,0.5) 100%)',
      }} />
    </div>
  );
}

export default function HeroSection({
  partner1, partner2, title, tagline, dateLine, timeLine, titleAr,
  invitationPattern, invitationTheme, invitationGuestName, invitationData,
  categoryBadge, isRTL, t, heroVideoUrl,
}) {
  const C = useFullPageTheme();
  const reduce = useReducedMotion();
  // Wedding-style templates show the two partner names; every other template
  // (corporate/gala/birthday…) has no couple, so the hero shows the event title.
  const hasCouple = !!(partner1 && partner2);
  // An Arabic title override (typed in the wizard/EventSettings) replaces
  // whatever the English heading would've been — including the "A & B" couple
  // line — the same way the classic template's invitation card already does.
  const displayName = (isRTL && titleAr) ? titleAr : (hasCouple ? `${partner1} & ${partner2}` : (title || partner1 || partner2));
  const displayTagline = tagline || (hasCouple ? (isRTL ? 'يسعدنا زواجنا' : 'We are getting married') : '');

  return (
    <div style={{
      position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      padding: 'clamp(72px, 10vh, 100px) 20px clamp(80px, 11vh, 100px)', boxSizing: 'border-box',
      // Layered, luminous background — two soft radial pools of the theme's gold
      // and accent over a vertical gradient — instead of a single flat fill.
      // When an organizer-uploaded hero video is present, HeroVideoBackground
      // (its own scrim included) covers this entirely; kept as the fallback
      // for events with no video, and as the base layer video fades into.
      background: `
        radial-gradient(ellipse 70% 55% at 50% 8%, ${C.gold}26 0%, transparent 60%),
        radial-gradient(ellipse 90% 60% at 50% 100%, ${C.maroon}14 0%, transparent 55%),
        linear-gradient(176deg, ${C.cream} 0%, ${C.background} 55%, ${C.paper} 100%)
      `,
    }}>
      {heroVideoUrl && <HeroVideoBackground src={heroVideoUrl} />}

      {/* Engraved stationery frame — a thin double gold rule inset from the
          screen edge, with a flourish in each corner. */}
      <div aria-hidden="true" style={{
        position: 'absolute', zIndex: 1, inset: 'clamp(12px, 3vw, 26px)', borderRadius: '10px',
        border: `1px solid ${C.gold}55`, boxShadow: `inset 0 0 0 3px ${C.background}, inset 0 0 0 4px ${C.gold}22`,
        pointerEvents: 'none',
      }}>
        <CornerFlourish color={C.gold} style={{ top: 6, left: 6 }} />
        <CornerFlourish color={C.gold} style={{ top: 6, right: 6, transform: 'scaleX(-1)' }} />
        <CornerFlourish color={C.gold} style={{ bottom: 6, left: 6, transform: 'scaleY(-1)' }} />
        <CornerFlourish color={C.gold} style={{ bottom: 6, right: 6, transform: 'scale(-1)' }} />
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        style={{
          position: 'relative', zIndex: 1, textAlign: 'center', color: C.ink,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          maxWidth: '760px', width: '100%',
        }}
      >
        {categoryBadge && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', color: C.gold,
            background: `${C.gold}14`, border: `1px solid ${C.gold}40`,
            borderRadius: '100px', padding: '6px 16px', marginBottom: '16px',
          }}>
            <EventCategoryIcon name={categoryBadge.iconName} size={13} color={C.gold} strokeWidth={1.6} />
            {categoryBadge.label}
          </span>
        )}

        {displayTagline && (
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700,
            letterSpacing: '0.32em', textTransform: 'uppercase', color: C.gold,
            marginBottom: '14px',
          }}>
            {displayTagline}
          </span>
        )}

        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 700, color: C.maroon,
          fontSize: hasCouple ? 'clamp(38px, 7.2vw, 66px)' : 'clamp(32px, 6.2vw, 55px)',
          margin: 0, letterSpacing: '0.01em', lineHeight: 1.1,
        }}>
          {displayName}
        </h1>

        <DiamondDivider />

        {/* The invitation card — the exact template shape the organizer chose,
            presented as a lifted, gently floating stationery card. */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.94, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          style={{ perspective: '1400px', marginTop: '10px' }}
        >
          <motion.div
            animate={reduce ? undefined : { y: [0, -9, 0] }}
            transition={reduce ? undefined : { duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 'min(84vw, 322px)', aspectRatio: '210 / 290',
              borderRadius: '16px', overflow: 'hidden', background: '#FAF8F5',
              // Layered depth: a broad soft drop shadow, a tight contact shadow,
              // and a gold hairline + inner highlight for a printed-card edge.
              boxShadow: `0 50px 100px -20px rgba(20,12,10,0.55), 0 12px 30px -8px rgba(20,12,10,0.4), 0 0 0 1px ${C.gold}66, inset 0 0 0 1px rgba(255,255,255,0.4)`,
            }}
          >
            <InvitationCard
              template={{ pattern: invitationPattern }}
              theme={invitationTheme}
              guestName={invitationGuestName}
              data={invitationData}
            />
          </motion.div>
        </motion.div>

        {/* A dedicated "when" card instead of a plain caption line — the same
            gold→maroon hairline-edge-over-cream card language used for every
            other grouped block in this template (RSVP details, seating panel),
            so the date/time reads as a clear, deliberate piece of information
            instead of an afterthought floating under the invitation card. */}
        {dateLine && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            style={{
              marginTop: 'clamp(18px, 3.6vw, 26px)', padding: '1.5px', borderRadius: '20px',
              background: `linear-gradient(140deg, ${C.gold}8C, ${C.maroon}59 55%, ${C.gold}75)`,
              boxShadow: `0 20px 45px -22px ${C.maroon}66`,
            }}
          >
            <div style={{
              background: `linear-gradient(180deg, ${C.cream} 0%, ${C.background} 140%)`,
              borderRadius: '19px', padding: 'clamp(13px, 3vw, 18px) clamp(20px, 5vw, 34px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 'clamp(14px, 3vw, 24px)', flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <Icon name="calendar" size={17} color={C.gold} strokeWidth={1.7} />
                <span style={{
                  fontFamily: 'var(--font-serif)', fontWeight: 700, color: C.maroonDeep,
                  fontSize: 'clamp(15px, 2.8vw, 23px)', letterSpacing: '0.05em', textAlign: 'center',
                  // A multi-day range ("SEPTEMBER 12, 2026 - SEPTEMBER 14, 2026")
                  // is long enough to overflow this pill on a narrow phone —
                  // nowrap here would clip it rather than wrap, so this is
                  // allowed to break onto a second line instead.
                }}>
                  {dateLine}
                </span>
              </div>
              {timeLine && (
                <>
                  <span aria-hidden="true" style={{ width: '1px', height: '34px', background: `${C.gold}55`, flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <Icon name="clock" size={17} color={C.gold} strokeWidth={1.7} />
                    <span style={{
                      fontFamily: 'var(--font-sans)', fontWeight: 800, color: C.maroonDeep,
                      fontSize: 'clamp(14px, 2.1vw, 17px)', letterSpacing: '0.07em', whiteSpace: 'nowrap',
                    }}>
                      {timeLine}
                    </span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </div>
  );
}
