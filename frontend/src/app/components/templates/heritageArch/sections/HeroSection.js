'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  partner1, partner2, title, tagline, titleAr,
  invitationPattern, invitationTheme, invitationGuestName, invitationData,
  categoryBadge, isRTL, t, heroVideoUrl,
}) {
  const C = useFullPageTheme();
  const reduce = useReducedMotion();
  const [downloading, setDownloading] = useState(false);

  // Lets a guest save the invitation card itself as a real PNG — same
  // html-to-image capture EventPageClient's legacy continuous-scroll path
  // already has (#invitation-card-capture there); HeritageArch and its 12
  // style variants never had an equivalent until now.
  const handleDownloadCard = useCallback(async () => {
    setDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const node = document.getElementById('ha-invitation-card-capture');
      if (!node) throw new Error('Card element not found');

      // Wait a tiny moment to ensure fonts are fully layout-rendered
      await new Promise((r) => setTimeout(r, 100));

      const dataUrl = await toPng(node, {
        quality: 0.98,
        pixelRatio: 2.5,
        style: { transform: 'scale(1)', borderRadius: '0px' },
        cacheBust: true,
      });

      const link = document.createElement('a');
      link.download = `${title || 'invitation'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to download invitation card:', error);
    } finally {
      setDownloading(false);
    }
  }, [title]);

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
            letterSpacing: isRTL ? 'normal' : '0.14em', textTransform: isRTL ? 'none' : 'uppercase', color: C.gold,
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
            // Wide tracking + uppercase is the intended look on English —
            // both break Arabic's connected letterforms into disjointed
            // separate glyphs (confirmed live on iOS: "تمت خطوبتنا!" was
            // rendering as broken-apart letters).
            letterSpacing: isRTL ? 'normal' : '0.32em', textTransform: isRTL ? 'none' : 'uppercase', color: C.gold,
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
            id="ha-invitation-card-capture"
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

        {/* Download the invitation card — same html-to-image capture the
            legacy continuous-scroll templates already offer, now available
            for HeritageArch and its 12 style variants too. */}
        <motion.button
          type="button"
          onClick={handleDownloadCard}
          disabled={downloading}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          style={{
            marginTop: 'clamp(14px, 2.6vw, 20px)',
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            padding: '11px 24px', background: `${C.gold}14`,
            border: `1.5px solid ${C.gold}55`, borderRadius: '12px',
            color: C.maroon, fontSize: '13px', fontWeight: 700,
            cursor: downloading ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
          }}
        >
          {downloading ? (
            <>
              <span aria-hidden style={{ width: '15px', height: '15px', border: '2px solid transparent', borderTop: '2px solid currentColor', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              <span>{isRTL ? 'جاري التحميل...' : 'Downloading...'}</span>
            </>
          ) : (
            <>
              <Icon name="download" size={15} strokeWidth={1.8} />
              <span>{isRTL ? 'تحميل بطاقة الدعوة' : 'Download Invitation'}</span>
            </>
          )}
        </motion.button>
      </motion.div>

      {/* The date/time itself now lives in its own dedicated EventDateSection
          right after this Hero — see HeritageArchPage.js — instead of a small
          pill crowded under the invitation card and the download button. */}

      <ScrollToRsvpHint isRTL={isRTL} />
    </div>
  );
}
