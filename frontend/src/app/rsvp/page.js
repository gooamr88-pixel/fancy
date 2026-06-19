'use client';

// One-click RSVP confirmation landing page.
//
// Reached from the Accept / Decline / Maybe buttons in the invitation email.
// Each button carries a signed token (?token=...). We resolve it (read-only),
// show the guest the response they picked pre-selected, and only RECORD it when
// they press Confirm — so email security scanners that pre-fetch the link can't
// register a false response.

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FadeInUp,
  ScaleIn,
  ShimmerPlaceholder,
  PageTransition,
  ConfettiExplosion,
  GlowPulse,
  AnimatedText,
} from '../components/guest/GuestAnimations';
import {
  GlassmorphismCard,
  PremiumButton,
  AttendanceCard,
  PartySizeStepper,
  CalendarButton,
  ShareButton,
} from '../components/guest/GuestUI';

const COLORS = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF',
  green: '#10b981', red: '#ef4444', maybe: '#6366f1',
};

const RESPONSE_META = {
  yes: { label: 'Accept', verb: 'attending', color: COLORS.green, emoji: '✓' },
  maybe: { label: 'Maybe', verb: 'tentatively responding', color: COLORS.maybe, emoji: '?' },
  no: { label: 'Decline', verb: 'declining', color: COLORS.red, emoji: '✕' },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/* ═══════════════════════════════════════════════════════════════
   Shell — Enhanced with gradient background + glassmorphism card
   ═══════════════════════════════════════════════════════════════ */
function Shell({ children }) {
  return (
    <PageTransition>
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(165deg, #F8F4EC 0%, #F3EDE0 40%, #EDE5D4 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-sans)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle decorative orb top-right */}
        <div style={{
          position: 'absolute', top: '-120px', right: '-80px',
          width: '320px', height: '320px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(184,148,79,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {/* Subtle decorative orb bottom-left */}
        <div style={{
          position: 'absolute', bottom: '-100px', left: '-60px',
          width: '280px', height: '280px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(215,190,128,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.1 }}
          style={{ maxWidth: '500px', width: '100%', position: 'relative', zIndex: 1 }}
        >
          <GlassmorphismCard
            bg="rgba(255, 255, 255, 0.88)"
            blur={20}
            border="rgba(232, 226, 214, 0.6)"
            hoverable={false}
            style={{ padding: '44px 36px', borderRadius: '24px' }}
          >
            {children}
          </GlassmorphismCard>
        </motion.div>
      </div>
    </PageTransition>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Success Checkmark — animated SVG for done state
   ═══════════════════════════════════════════════════════════════ */
function AnimatedCheckmark({ color = COLORS.green, size = 72 }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: `${color}14`,
        border: `2px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
      }}
    >
      <motion.svg
        width={size * 0.42} height={size * 0.42}
        viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
      >
        <motion.polyline
          points="20 6 9 17 4 12"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </motion.svg>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Animated Error Icon
   ═══════════════════════════════════════════════════════════════ */
function AnimatedErrorIcon() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 12 }}
      style={{
        width: '72px', height: '72px', borderRadius: '50%',
        background: 'rgba(239, 68, 68, 0.08)',
        border: '2px solid rgba(239, 68, 68, 0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px', fontSize: '32px',
      }}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        ⚠️
      </motion.span>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Decorative Divider
   ═══════════════════════════════════════════════════════════════ */
function GoldDivider() {
  return (
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{
        height: '1px', margin: '20px auto',
        background: `linear-gradient(90deg, transparent, ${COLORS.champagne}, transparent)`,
        maxWidth: '200px',
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════════════════ */
export default function RsvpConfirmPage() {
  const [token, setToken] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error | done | closed
  const [error, setError] = useState('');
  const [invite, setInvite] = useState(null);
  const [selected, setSelected] = useState('yes');
  const [partySize, setPartySize] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [finalResponse, setFinalResponse] = useState(null);

  // Resolve the token from the URL on the client only (no Suspense boundary needed).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    if (!t) { setStatus('error'); setError('No invitation token was provided. Please use the link from your email.'); return; }
    setToken(t);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/public/rsvp/invite?token=${encodeURIComponent(t)}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'This invitation link is invalid or has expired.');
        }
        setInvite(data);
        setSelected(data.intendedResponse || data.guest.response || 'yes');
        setPartySize(data.guest.party_size || 1);
        if (data.deadlinePassed) setStatus('closed');
        else setStatus('ready');
      } catch (err) {
        setStatus('error');
        setError(err.message);
      }
    })();
  }, []);

  const submit = async () => {
    if (!token || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/public/rsvp/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, response: selected, partySize: selected === 'yes' ? partySize : 1 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not record your response. Please try again.');
      setFinalResponse(data.response);
      setStatus('done');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ════════════════════════════════════════════
     Loading State — Shimmer skeleton
     ════════════════════════════════════════════ */
  if (status === 'loading') {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          {/* Shimmer skeleton placeholders */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <ShimmerPlaceholder width="100px" height="14px" borderRadius="4px" />
            <ShimmerPlaceholder width="260px" height="28px" borderRadius="8px" />
            <ShimmerPlaceholder width="180px" height="14px" borderRadius="4px" />
            <div style={{ height: '8px' }} />
            <ShimmerPlaceholder width="100%" height="80px" borderRadius="14px" />
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <ShimmerPlaceholder width="100%" height="100px" borderRadius="14px" />
              <ShimmerPlaceholder width="100%" height="100px" borderRadius="14px" />
              <ShimmerPlaceholder width="100%" height="100px" borderRadius="14px" />
            </div>
            <ShimmerPlaceholder width="100%" height="52px" borderRadius="12px" />
          </div>
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ color: COLORS.stone, fontSize: '13px', marginTop: '24px', fontWeight: 500 }}
          >
            Loading your invitation…
          </motion.p>
        </div>
      </Shell>
    );
  }

  /* ════════════════════════════════════════════
     Error State
     ════════════════════════════════════════════ */
  if (status === 'error') {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <AnimatedErrorIcon />
          <FadeInUp delay={0.2}>
            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600,
              color: COLORS.charcoal, marginTop: '4px',
            }}>
              Invitation Unavailable
            </h1>
          </FadeInUp>
          <FadeInUp delay={0.35}>
            <p style={{
              color: COLORS.stone, marginTop: '14px', fontSize: '14px',
              lineHeight: 1.7, maxWidth: '340px', margin: '14px auto 0',
            }}>
              {error}
            </p>
          </FadeInUp>
        </div>
      </Shell>
    );
  }

  const ev = invite?.event;
  const dateStr = ev?.event_date ? new Date(ev.event_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : null;

  /* ════════════════════════════════════════════
     Done State — Response Recorded
     ════════════════════════════════════════════ */
  if (status === 'done') {
    const meta = RESPONSE_META[finalResponse] || RESPONSE_META.yes;
    const isYes = finalResponse === 'yes';
    const isMaybe = finalResponse === 'maybe';

    return (
      <Shell>
        {/* Confetti for accepted responses */}
        <ConfettiExplosion active={isYes} duration={4500} particleCount={140} />

        <div style={{ textAlign: 'center' }}>
          {/* Animated checkmark/icon */}
          <AnimatedCheckmark color={meta.color} size={72} />

          <FadeInUp delay={0.3}>
            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600,
              color: COLORS.charcoal, margin: 0,
            }}>
              {isYes ? 'We Can\'t Wait to See You!' : isMaybe ? 'Response Noted' : 'Response Recorded'}
            </h1>
          </FadeInUp>

          <GoldDivider />

          <FadeInUp delay={0.45}>
            <p style={{ color: COLORS.stone, fontSize: '14px', lineHeight: 1.8 }}>
              Thank you, <strong style={{ color: COLORS.gold, fontWeight: 700 }}>{invite.guest.guest_name}</strong>. You're marked as{' '}
              <strong style={{ color: meta.color }}>{meta.label === 'Accept' ? 'Attending' : meta.label}</strong>
              {isYes ? ` with a party of ${partySize}.` : ' for this event.'}
            </p>
          </FadeInUp>

          <FadeInUp delay={0.55}>
            <p style={{
              color: COLORS.stone, marginTop: '8px', fontSize: '13px',
              lineHeight: 1.6, opacity: 0.8,
            }}>
              Changed your mind? You can return to this email link anytime before the deadline to update your response.
            </p>
          </FadeInUp>

          {/* Action buttons */}
          <FadeInUp delay={0.65}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '12px', marginTop: '28px',
            }}>
              {/* Calendar & Share row */}
              {ev && (
                <div style={{
                  display: 'flex', gap: '12px', flexWrap: 'wrap',
                  justifyContent: 'center', width: '100%',
                }}>
                  <CalendarButton event={ev} />
                  <ShareButton
                    title={ev.title || 'Event Invitation'}
                    text={`You're invited to ${ev.title || 'an event'}!`}
                  />
                </div>
              )}

              {/* View Event Details */}
              {ev?.slug && (
                <div style={{ marginTop: '8px', width: '100%' }}>
                  <GlowPulse color={COLORS.gold} intensity={0.2}>
                    <Link href={`/${ev.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                      <PremiumButton variant="dark" fullWidth>
                        View Event Details
                      </PremiumButton>
                    </Link>
                  </GlowPulse>
                </div>
              )}
            </div>
          </FadeInUp>
        </div>
      </Shell>
    );
  }

  /* ════════════════════════════════════════════
     Closed State — Deadline passed
     ════════════════════════════════════════════ */
  if (status === 'closed') {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'rgba(184, 148, 79, 0.08)',
              border: '2px solid rgba(184, 148, 79, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: '32px',
            }}
          >
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              ⌛
            </motion.span>
          </motion.div>

          <FadeInUp delay={0.2}>
            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600,
              color: COLORS.charcoal, marginTop: '4px',
            }}>
              RSVPs Are Closed
            </h1>
          </FadeInUp>

          <GoldDivider />

          <FadeInUp delay={0.4}>
            <p style={{
              color: COLORS.stone, marginTop: '4px', fontSize: '14px',
              lineHeight: 1.7, maxWidth: '340px', margin: '4px auto 0',
            }}>
              The RSVP deadline for <strong style={{ color: COLORS.charcoal }}>{ev?.title}</strong> has passed. Please contact the organizer if you need to update your response.
            </p>
          </FadeInUp>

          {ev?.slug && (
            <FadeInUp delay={0.5}>
              <div style={{ marginTop: '28px' }}>
                <Link href={`/${ev.slug}`} style={{ textDecoration: 'none' }}>
                  <PremiumButton variant="outline">
                    View Event Details
                  </PremiumButton>
                </Link>
              </div>
            </FadeInUp>
          )}
        </div>
      </Shell>
    );
  }

  /* ════════════════════════════════════════════
     Ready State — Confirm Form
     ════════════════════════════════════════════ */
  return (
    <Shell>
      {/* Header: badge + event title + date/location */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <FadeInUp delay={0.1}>
          <motion.span
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            style={{
              display: 'inline-block', padding: '6px 18px',
              background: 'rgba(184, 148, 79, 0.08)',
              border: '1px solid rgba(184, 148, 79, 0.2)',
              borderRadius: '100px',
              fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.22em',
              color: COLORS.gold, fontWeight: 700,
            }}
          >
            You're Invited
          </motion.span>
        </FadeInUp>

        <FadeInUp delay={0.25}>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600,
            color: COLORS.charcoal, margin: '14px 0 0', lineHeight: 1.2,
          }}>
            {ev?.title}
          </h1>
        </FadeInUp>

        {(dateStr || ev?.location) && (
          <FadeInUp delay={0.35}>
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              {dateStr && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: COLORS.stone, fontSize: '13px' }}>
                  <span style={{ opacity: 0.6 }}>📅</span>
                  <span>{dateStr}</span>
                </div>
              )}
              {ev?.location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: COLORS.stone, fontSize: '13px' }}>
                  <span style={{ opacity: 0.6 }}>📍</span>
                  <span>{ev.location}</span>
                </div>
              )}
            </div>
          </FadeInUp>
        )}
      </div>

      <GoldDivider />

      {/* Personalized greeting */}
      <FadeInUp delay={0.4}>
        <p style={{
          color: COLORS.charcoal, fontSize: '15px', textAlign: 'center',
          marginBottom: '20px', lineHeight: 1.6,
        }}>
          Hi <strong style={{ color: COLORS.gold, fontWeight: 700 }}>{invite.guest.guest_name}</strong> — will you attend?
        </p>
      </FadeInUp>

      {/* Response selector — AttendanceCards */}
      <FadeInUp delay={0.5}>
        <div
          className="attendance-cards-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          {['yes', 'maybe', 'no'].map(key => (
            <AttendanceCard
              key={key}
              type={key}
              selected={selected}
              onClick={setSelected}
            />
          ))}
        </div>
      </FadeInUp>

      {/* Party size (only when attending) */}
      <AnimatePresence mode="wait">
        {selected === 'yes' && (
          <motion.div
            key="party-size"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden', marginBottom: '20px' }}
          >
            <ScaleIn delay={0.1}>
              <PartySizeStepper
                value={partySize}
                onChange={setPartySize}
                min={1}
                max={20}
                label="Total party size (including you)"
              />
            </ScaleIn>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontSize: '13px', color: COLORS.red,
              background: '#FEF2F2', padding: '12px 16px',
              borderRadius: '12px', border: '1px solid #FECACA',
              marginBottom: '16px', overflow: 'hidden',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm button with GlowPulse */}
      <FadeInUp delay={0.6}>
        <GlowPulse color={RESPONSE_META[selected].color} intensity={0.25}>
          <PremiumButton
            onClick={submit}
            disabled={submitting}
            loading={submitting}
            variant="gold"
            size="lg"
            fullWidth
            style={{ borderRadius: '14px' }}
          >
            {submitting ? 'Recording…' : `Confirm — ${RESPONSE_META[selected].label}`}
          </PremiumButton>
        </GlowPulse>
      </FadeInUp>

      {/* Subtle footer note */}
      <FadeInUp delay={0.7}>
        <p style={{
          textAlign: 'center', fontSize: '11px', color: COLORS.stone,
          marginTop: '20px', opacity: 0.6, lineHeight: 1.5,
        }}>
          Your response will be securely recorded and the organizer will be notified.
        </p>
      </FadeInUp>
    </Shell>
  );
}
