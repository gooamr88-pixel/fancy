'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════
   ANIMATED NUMBER COUNTER HOOK
   Uses easeOutExpo for a satisfying deceleration curve
   ═══════════════════════════════════════════════════════════════ */

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function useAnimatedCounter(end, duration = 1500, delay = 0) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (end === 0) return;

    const timeout = setTimeout(() => {
      hasStarted.current = true;
      startTimeRef.current = null;

      const animate = (timestamp) => {
        if (!startTimeRef.current) startTimeRef.current = timestamp;
        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutExpo(progress);

        setValue(Math.round(easedProgress * end));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [end, duration, delay]);

  // When end is 0, the animation never starts (value may still hold a stale
  // count from a previous non-zero `end`) — clamp it to 0 here at the render
  // site instead of setting state from the effect's early-return guard.
  return end === 0 ? 0 : value;
}

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS — each tuned for its card gradient
   ═══════════════════════════════════════════════════════════════ */

function CalendarIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="3" stroke={color} strokeWidth="1.6" />
      <path d="M3 10h18" stroke={color} strokeWidth="1.6" />
      <path d="M8 2v4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 2v4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <rect x="7" y="13" width="2.5" height="2.5" rx="0.5" fill={color} opacity="0.6" />
      <rect x="10.75" y="13" width="2.5" height="2.5" rx="0.5" fill={color} opacity="0.4" />
      <rect x="14.5" y="13" width="2.5" height="2.5" rx="0.5" fill={color} opacity="0.2" />
    </svg>
  );
}

function UsersIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="3.5" stroke={color} strokeWidth="1.5" />
      <path d="M2 20c0-3.5 3-6.5 7-6.5s7 3 7 6.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="17" cy="8" r="2.5" stroke={color} strokeWidth="1.3" opacity="0.6" />
      <path d="M17 12.5c2.8 0 5 2.2 5 5" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function EnvelopeIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="3" stroke={color} strokeWidth="1.5" />
      <path d="M2 7l8.8 5.3a2 2 0 002.4 0L22 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="15" r="1.2" fill={color} opacity="0.3" />
    </svg>
  );
}

function CheckCircleIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
      <path d="M8 12.5l2.5 2.5 5.5-5.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="0.5" opacity="0.2" strokeDasharray="3 3" />
    </svg>
  );
}

function ClockIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
      <path d="M12 6v6.5l4 2.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1.5" fill={color} opacity="0.3" />
    </svg>
  );
}

function SparkleIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M18 3l.8 2.2L21 6l-2.2.8L18 9l-.8-2.2L15 6l2.2-.8L18 3z" fill={color} opacity="0.3" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MINI PROGRESS BAR (for RSVP breakdown)
   ═══════════════════════════════════════════════════════════════ */

function MiniProgressBar({ label, count, total, color, colorLight, delay }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const [animatedWidth, setAnimatedWidth] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimatedWidth(pct), delay + 400);
    return () => clearTimeout(timeout);
  }, [pct, delay]);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Label row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
      }}>
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 10,
          fontWeight: 600,
          color: color,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          fontWeight: 700,
          color: color,
        }}>
          {count}
        </span>
      </div>
      {/* Bar track */}
      <div style={{
        height: 6,
        borderRadius: 3,
        background: colorLight || '#F0ECE3',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          height: '100%',
          borderRadius: 3,
          background: `linear-gradient(90deg, ${color}, ${colorLight || color})`,
          width: `${animatedWidth}%`,
          transition: 'width 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
          boxShadow: `0 0 8px ${color}33`,
        }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAT CARD
   ═══════════════════════════════════════════════════════════════ */

function StatCard({
  accent,
  accentLight,
  icon,
  label,
  value,
  subtext,
  span,
  index = 0,
  children,
}) {
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const entranceDelay = index * 80;

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), entranceDelay + 50);
    return () => clearTimeout(timeout);
  }, [entranceDelay]);

  const iconBgStyle = {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${accentLight || accent}22, ${accent}15)`,
    border: `1px solid ${accent}20`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.3s ease',
    transform: hovered ? 'scale(1.08)' : 'scale(1)',
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={span === 2 ? 'osc-rsvp-span' : ''}
      style={{
        position: 'relative',
        background: '#FFFFFF',
        border: `1px solid ${hovered ? '#D4CFC5' : '#E8E2D6'}`,
        borderRadius: 16,
        padding: '24px 22px 20px',
        opacity: visible ? 1 : 0,
        transform: visible
          ? (hovered ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(1)')
          : 'translateY(24px) scale(0.97)',
        boxShadow: hovered
          ? '0 16px 40px rgba(184,148,79,0.12), 0 4px 12px rgba(184,148,79,0.06)'
          : '0 1px 3px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)',
        transition: 'all 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
        overflow: 'hidden',
        cursor: 'default',
        willChange: 'transform, opacity, box-shadow',
      }}
    >
      {/* ── Gradient accent bar ── */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 12,
        right: 12,
        height: 4,
        borderRadius: '0 0 4px 4px',
        background: `linear-gradient(90deg, ${accent}, ${accentLight || accent})`,
        opacity: hovered ? 1 : 0.85,
        transition: 'opacity 0.3s ease',
      }} />

      {/* ── Header row: icon + label ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        marginTop: 4,
      }}>
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 11,
          fontWeight: 600,
          color: '#77736A',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          paddingTop: 8,
        }}>
          {label}
        </span>
        <div style={iconBgStyle}>
          {icon}
        </div>
      </div>

      {/* ── Value ── */}
      <div className="osc-value" style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 36,
        fontWeight: 700,
        color: '#191B1E',
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
        marginBottom: 4,
      }}>
        {value}
      </div>

      {/* ── Subtext ── */}
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        fontWeight: 400,
        color: '#77736A',
        lineHeight: 1.4,
      }}>
        {subtext}
      </div>

      {/* ── Extra content (RSVP bars, etc.) ── */}
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CSS KEYFRAMES  (injected once)
   ═══════════════════════════════════════════════════════════════ */

const keyframesCSS = `
  @keyframes osc-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }

  @keyframes osc-pulse-ring {
    0%   { transform: scale(1);   opacity: 0.5; }
    50%  { transform: scale(1.1); opacity: 0.2; }
    100% { transform: scale(1);   opacity: 0.5; }
  }

  .osc-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  .osc-rsvp-span {
    grid-column: span 2;
  }

  @media (max-width: 1024px) {
    .osc-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .osc-rsvp-span { grid-column: span 2 !important; }
  }

  /* Small phones: two compact cards per row instead of one giant card each —
     six full-width cards made the overview an endless heavy stack. The RSVP
     card keeps the full row (it carries the three progress bars). Trim the
     card padding and the 36px value so the denser grid still breathes. */
  @media (max-width: 640px) {
    .osc-grid {
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .osc-rsvp-span { grid-column: 1 / -1 !important; }
    .osc-grid > div { padding: 16px 15px 15px !important; }
    .osc-value { font-size: 27px !important; }
    .osc-rsvp-bars {
      flex-direction: column !important;
      gap: 10px !important;
    }
  }
  /* Very narrow (small/older phones): fall back to a single column so the
     compact cards never get uncomfortably cramped. */
  @media (max-width: 380px) {
    .osc-grid { grid-template-columns: 1fr; }
  }
`;

/* ═══════════════════════════════════════════════════════════════
   CARD CONFIGS
   ═══════════════════════════════════════════════════════════════ */

const CARD_GRADIENTS = {
  events:    { accent: '#B8944F', light: '#D7BE80' },
  guests:    { accent: '#6B8EAE', light: '#A3C1D9' },
  rsvp:      { accent: '#4A7C59', light: '#7AB08A' },
  checkedin: { accent: '#8B7EC8', light: '#B0A6D9' },
  notArrived:{ accent: '#C4956A', light: '#E0B98E' },
  confirmed: { accent: '#C4787A', light: '#E0A6A8' },
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function OverviewStatCards({
  totalEvents = 0,
  activeEvents = 0,
  totalGuests = 0,
  rsvpOverview = {},
  checkedIn = 0,
  notArrived = 0,
  totalGuestsAccepted = 0,
}) {
  const accepted = rsvpOverview.accepted || 0;
  const declined = rsvpOverview.declined || 0;
  const pending  = rsvpOverview.pending  || 0;
  const rsvpTotal = accepted + declined + pending;
  const rsvpRate = rsvpTotal > 0 ? Math.round((accepted / rsvpTotal) * 100) : 0;

  // Animated counters
  const aTotalEvents    = useAnimatedCounter(totalEvents, 1500, 0);
  const aTotalGuests    = useAnimatedCounter(totalGuests, 1500, 80);
  const aRsvpRate       = useAnimatedCounter(rsvpRate, 1500, 160);
  const aCheckedIn      = useAnimatedCounter(checkedIn, 1500, 240);
  const aNotArrived     = useAnimatedCounter(notArrived, 1500, 320);
  const aConfirmed      = useAnimatedCounter(totalGuestsAccepted, 1500, 400);

  return (
    <>
      <style>{keyframesCSS}</style>

      <div className="osc-grid">

        {/* ── 1. Total Events ── */}
        <StatCard
          index={0}
          accent={CARD_GRADIENTS.events.accent}
          accentLight={CARD_GRADIENTS.events.light}
          icon={<CalendarIcon color={CARD_GRADIENTS.events.accent} />}
          label="Total Events"
          value={aTotalEvents}
          subtext={<>{activeEvents} <span style={{ color: '#4A7C59', fontWeight: 600 }}>active</span> right now</>}
        />

        {/* ── 2. Total Guests ── */}
        <StatCard
          index={1}
          accent={CARD_GRADIENTS.guests.accent}
          accentLight={CARD_GRADIENTS.guests.light}
          icon={<UsersIcon color={CARD_GRADIENTS.guests.accent} />}
          label="Total Guests"
          value={aTotalGuests.toLocaleString()}
          subtext="Guests invited across all events"
        />

        {/* ── 3. RSVP Rate (spans 2 cols on tablet+) ── */}
        <StatCard
          index={2}
          accent={CARD_GRADIENTS.rsvp.accent}
          accentLight={CARD_GRADIENTS.rsvp.light}
          icon={<EnvelopeIcon color={CARD_GRADIENTS.rsvp.accent} />}
          label="RSVP Rate"
          value={<>{aRsvpRate}<span style={{ fontSize: 22, fontWeight: 500, opacity: 0.6 }}>%</span></>}
          subtext="Acceptance rate of all invitations"
          span={2}
        >
          {/* Sparkline mini-bars */}
          <div className="osc-rsvp-bars" style={{
            display: 'flex',
            gap: 16,
            marginTop: 18,
            paddingTop: 16,
            borderTop: '1px solid #E8E2D616',
          }}>
            <MiniProgressBar
              label="Accepted"
              count={accepted}
              total={rsvpTotal}
              color="#4A7C59"
              colorLight="#E8F5E9"
              delay={200}
            />
            <MiniProgressBar
              label="Declined"
              count={declined}
              total={rsvpTotal}
              color="#C45E5E"
              colorLight="#FCEAEA"
              delay={300}
            />
            <MiniProgressBar
              label="Pending"
              count={pending}
              total={rsvpTotal}
              color="#B8944F"
              colorLight="#FBF5E9"
              delay={400}
            />
          </div>
        </StatCard>

        {/* ── 4. Checked In ── */}
        <StatCard
          index={3}
          accent={CARD_GRADIENTS.checkedin.accent}
          accentLight={CARD_GRADIENTS.checkedin.light}
          icon={<CheckCircleIcon color={CARD_GRADIENTS.checkedin.accent} />}
          label="Checked In"
          value={aCheckedIn}
          subtext="Guests who have arrived"
        />

        {/* ── 5. Not Arrived ── */}
        <StatCard
          index={4}
          accent={CARD_GRADIENTS.notArrived.accent}
          accentLight={CARD_GRADIENTS.notArrived.light}
          icon={<ClockIcon color={CARD_GRADIENTS.notArrived.accent} />}
          label="Not Arrived"
          value={aNotArrived}
          subtext="Still expected to arrive"
        />

        {/* ── 6. Confirmed ── */}
        <StatCard
          index={5}
          accent={CARD_GRADIENTS.confirmed.accent}
          accentLight={CARD_GRADIENTS.confirmed.light}
          icon={<SparkleIcon color={CARD_GRADIENTS.confirmed.accent} />}
          label="Confirmed"
          value={aConfirmed}
          subtext="Guests confirmed attendance"
        />

      </div>
    </>
  );
}
