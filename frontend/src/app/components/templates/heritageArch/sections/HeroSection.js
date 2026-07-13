'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useFullPageTheme } from '../theme';
import { DiamondDivider, ScrollToRsvpHint } from '../shared';
import InvitationCard from '../../InvitationCard';
import EventCategoryIcon from '../../../icons/EventCategoryIcon';

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

export default function HeroSection({
  partner1, partner2, title, tagline, dateLine, timeLine, titleAr,
  invitationPattern, invitationTheme, invitationGuestName, invitationData,
  categoryBadge, isRTL, t,
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
      padding: 'clamp(88px, 12vh, 120px) 20px clamp(96px, 14vh, 120px)', boxSizing: 'border-box',
      // Layered, luminous background — two soft radial pools of the theme's gold
      // and accent over a vertical gradient — instead of a single flat fill.
      background: `
        radial-gradient(ellipse 70% 55% at 50% 8%, ${C.gold}26 0%, transparent 60%),
        radial-gradient(ellipse 90% 60% at 50% 100%, ${C.maroon}14 0%, transparent 55%),
        linear-gradient(176deg, ${C.cream} 0%, ${C.background} 55%, ${C.paper} 100%)
      `,
    }}>
      {/* Engraved stationery frame — a thin double gold rule inset from the
          screen edge, with a flourish in each corner. */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 'clamp(12px, 3vw, 26px)', borderRadius: '10px',
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
            fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.32em', textTransform: 'uppercase', color: C.gold,
            marginBottom: '18px',
          }}>
            {displayTagline}
          </span>
        )}

        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 700, color: C.maroon,
          fontSize: hasCouple ? 'clamp(36px, 7vw, 62px)' : 'clamp(30px, 6vw, 52px)',
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
          style={{ perspective: '1400px', marginTop: '14px' }}
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

        {dateLine && (
          <p style={{
            fontFamily: 'var(--font-serif)', fontSize: 'clamp(15px, 2.2vw, 20px)',
            letterSpacing: '0.06em', marginTop: '30px', color: C.maroonDeep,
          }}>
            {dateLine}
          </p>
        )}
        {timeLine && (
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600,
            letterSpacing: '0.08em', marginTop: '6px', color: C.maroonDeep, opacity: 0.75,
          }}>
            {(t?.starting_at || (isRTL ? 'يبدأ في تمام الساعة' : 'Starting at'))} {timeLine}
          </p>
        )}
      </motion.div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </div>
  );
}
