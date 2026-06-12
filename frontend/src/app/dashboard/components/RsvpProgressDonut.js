'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ── Utilities ──────────────────────────────────────────────── */

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  if (endAngle - startAngle >= 359.99) {
    // Full circle — use two half-arcs
    const mid = startAngle + 180;
    const s1 = polarToCartesian(cx, cy, r, startAngle);
    const m1 = polarToCartesian(cx, cy, r, mid);
    return (
      `M ${s1.x} ${s1.y} A ${r} ${r} 0 1 1 ${m1.x} ${m1.y} ` +
      `A ${r} ${r} 0 1 1 ${s1.x} ${s1.y}`
    );
  }
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/* ── Constants ──────────────────────────────────────────────── */

const CX = 100;
const CY = 100;
const RADIUS = 70;
const STROKE_W = 18;
const GAP_DEG = 4;

const SEGMENTS_CONFIG = [
  { key: 'accepted', label: 'Accepted', color: '#B8944F', glowColor: 'rgba(184,148,79,0.35)' },
  { key: 'declined', label: 'Declined', color: '#77736A', glowColor: 'rgba(119,115,106,0.3)' },
  { key: 'pending',  label: 'Pending',  color: '#D7BE80', glowColor: 'rgba(215,190,128,0.3)' },
];

const STYLES_ID = 'rsvp-donut-premium-styles';

/* ── Injected CSS ──────────────────────────────────────────── */

const CSS = `
@keyframes rsvpDonutFadeIn {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes rsvpDonutPulseGlow {
  0%   { text-shadow: 0 0 8px rgba(184,148,79,0.25), 0 0 24px rgba(184,148,79,0.10); }
  50%  { text-shadow: 0 0 16px rgba(184,148,79,0.50), 0 0 40px rgba(184,148,79,0.20); }
  100% { text-shadow: 0 0 8px rgba(184,148,79,0.25), 0 0 24px rgba(184,148,79,0.10); }
}
@keyframes rsvpDonutRingPulse {
  0%   { opacity: 0.5; transform: scale(1); }
  100% { opacity: 0;   transform: scale(1.6); }
}
@keyframes rsvpDonutStatSlide {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes rsvpEmptyFloat {
  0%, 100% { transform: translateY(0px); }
  50%      { transform: translateY(-6px); }
}
@keyframes rsvpEmptyDash {
  to { stroke-dashoffset: 0; }
}
`;

/* ── Animated Counter Hook ─────────────────────────────────── */

function useAnimatedCounter(targetValue, duration = 1200, delay = 300) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (targetValue <= 0) { setValue(0); return; }
    let startTime = null;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime - delay;
      if (elapsed < 0) { rafRef.current = requestAnimationFrame(animate); return; }
      const t = Math.min(elapsed / duration, 1);
      setValue(Math.round(easeOutCubic(t) * targetValue));
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [targetValue, duration, delay]);

  return value;
}

/* ── Animated Arc Segment ──────────────────────────────────── */

function AnimatedArc({ cx, cy, r, startAngle, endAngle, color, glowColor, delay, animate }) {
  const [progress, setProgress] = useState(0);
  const [hovered, setHovered] = useState(false);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!animate || endAngle - startAngle <= 0) return;
    const duration = 1200;
    let startTime = null;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime - delay;
      if (elapsed < 0) { rafRef.current = requestAnimationFrame(step); return; }
      const t = Math.min(elapsed / duration, 1);
      setProgress(easeOutCubic(t));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [animate, startAngle, endAngle, delay]);

  const currentEnd = startAngle + (endAngle - startAngle) * progress;
  if (currentEnd - startAngle < 0.5) return null;

  const d = describeArc(cx, cy, r, startAngle, currentEnd);
  const expandedR = r + 4;
  const expandedD = describeArc(cx, cy, expandedR, startAngle, currentEnd);

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: 'pointer' }}
    >
      {/* Glow filter behind on hover */}
      {hovered && (
        <path
          d={expandedD}
          fill="none"
          stroke={glowColor}
          strokeWidth={STROKE_W + 8}
          strokeLinecap="round"
          style={{ filter: 'blur(6px)' }}
        />
      )}
      <path
        d={hovered ? expandedD : d}
        fill="none"
        stroke={color}
        strokeWidth={hovered ? STROKE_W + 2 : STROKE_W}
        strokeLinecap="round"
        style={{
          transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          filter: hovered ? `drop-shadow(0 0 8px ${glowColor})` : 'none',
        }}
      />
    </g>
  );
}

/* ── Empty State ────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 20px',
        gap: 16,
      }}
    >
      <div style={{ animation: 'rsvpEmptyFloat 3s ease-in-out infinite' }}>
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          {/* Outer decorative ring */}
          <circle
            cx="32" cy="32" r="26"
            stroke="#E8E2D6"
            strokeWidth="1.5"
            strokeDasharray="5 4"
            opacity="0.7"
          />
          {/* Inner circle */}
          <circle
            cx="32" cy="32" r="18"
            stroke="#D7BE80"
            strokeWidth="2"
            fill="none"
            strokeDasharray="113"
            strokeDashoffset="113"
            style={{ animation: 'rsvpEmptyDash 2s ease-out 0.5s forwards' }}
          />
          {/* Center dot cluster */}
          <circle cx="26" cy="32" r="2" fill="#D7BE80" opacity="0.5" />
          <circle cx="32" cy="32" r="2.5" fill="#B8944F" opacity="0.7" />
          <circle cx="38" cy="32" r="2" fill="#D7BE80" opacity="0.5" />
          {/* Sparkle */}
          <path d="M48 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#D7BE80" opacity="0.5" />
          <path d="M14 48l0.7 2.1 2.1 0.7-2.1 0.7-0.7 2.1-0.7-2.1-2.1-0.7 2.1-0.7z" fill="#B8944F" opacity="0.4" />
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 15,
            fontWeight: 600,
            color: '#191B1E',
            marginBottom: 4,
          }}
        >
          No RSVP data yet
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: '#A9A5A0',
            lineHeight: 1.5,
          }}
        >
          Responses will appear here as guests reply
        </div>
      </div>
    </div>
  );
}

/* ── Stat Row ───────────────────────────────────────────────── */

function StatRow({ color, label, count, percentage, delay }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 10,
        background: `${color}08`,
        border: `1px solid ${color}18`,
        animation: `rsvpDonutStatSlide 0.5s ease-out ${delay}ms both`,
        transition: 'background 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}15`;
        e.currentTarget.style.transform = 'translateX(4px)';
        e.currentTarget.style.boxShadow = `0 2px 12px ${color}20`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${color}08`;
        e.currentTarget.style.transform = 'translateX(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Color dot with ring */}
      <div style={{ position: 'relative', width: 14, height: 14, flexShrink: 0 }}>
        <div
          style={{
            position: 'absolute',
            top: 1, left: 1,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: color,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -1, left: -1,
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: `2px solid ${color}30`,
          }}
        />
      </div>
      {/* Label */}
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          fontWeight: 500,
          color: '#191B1E',
        }}
      >
        {label}
      </span>
      {/* Spacer */}
      <div style={{ flex: 1 }} />
      {/* Count */}
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 15,
          fontWeight: 700,
          color: '#191B1E',
          marginRight: 6,
        }}
      >
        {count}
      </span>
      {/* Pill badge */}
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 10,
          fontWeight: 600,
          color: color,
          background: `${color}1A`,
          borderRadius: 20,
          padding: '3px 10px',
          minWidth: 36,
          textAlign: 'center',
          letterSpacing: '0.02em',
        }}
      >
        {percentage}%
      </span>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */

export default function RsvpProgressDonut({ rsvpOverview = {} }) {
  const [animate, setAnimate] = useState(false);

  const accepted = rsvpOverview.accepted || 0;
  const declined = rsvpOverview.declined || 0;
  const pending = rsvpOverview.pending || 0;
  const total = accepted + declined + pending;

  const acceptedPct = total > 0 ? Math.round((accepted / total) * 100) : 0;
  const declinedPct = total > 0 ? Math.round((declined / total) * 100) : 0;
  const pendingPct = total > 0 ? 100 - acceptedPct - declinedPct : 0;

  const animatedPct = useAnimatedCounter(animate ? acceptedPct : 0, 1200, 200);

  // Inject styles once
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!document.getElementById(STYLES_ID)) {
      const el = document.createElement('style');
      el.id = STYLES_ID;
      el.textContent = CSS;
      document.head.appendChild(el);
    }
  }, []);

  // Trigger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 80);
    return () => clearTimeout(timer);
  }, []);

  /* ── Card wrapper ─── */
  const cardStyle = {
    background: '#FFFFFF',
    border: '1px solid #E8E2D6',
    borderRadius: 16,
    padding: '28px 28px 24px',
    animation: 'rsvpDonutFadeIn 0.7s ease-out both',
    overflow: 'hidden',
    position: 'relative',
  };

  /* ── Header ─── */
  const header = (
    <div style={{ marginBottom: 24 }}>
      <h3
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 18,
          fontWeight: 600,
          color: '#191B1E',
          margin: 0,
          letterSpacing: '-0.01em',
        }}
      >
        RSVP Progress
      </h3>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          color: '#A9A5A0',
          margin: '5px 0 0 0',
          letterSpacing: '0.01em',
        }}
      >
        Response distribution across all events
      </p>
    </div>
  );

  /* ── Empty state ─── */
  if (total === 0) {
    return (
      <div style={cardStyle}>
        {header}
        <EmptyState />
      </div>
    );
  }

  /* ── Build segment angles ─── */
  const segments = [];
  const values = [accepted, declined, pending];
  const pcts = [acceptedPct, declinedPct, pendingPct];
  const nonZeroCount = values.filter((v) => v > 0).length;
  const totalGapDeg = nonZeroCount > 1 ? GAP_DEG * nonZeroCount : 0;
  const availableDeg = 360 - totalGapDeg;

  let currentAngle = 0;
  for (let i = 0; i < 3; i++) {
    const val = values[i];
    if (val <= 0) continue;
    const sweep = (val / total) * availableDeg;
    segments.push({
      ...SEGMENTS_CONFIG[i],
      start: currentAngle,
      end: currentAngle + sweep,
      count: val,
      pct: pcts[i],
    });
    currentAngle += sweep + GAP_DEG;
  }

  return (
    <div style={cardStyle}>
      {/* Subtle decorative gradient orb */}
      <div
        style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 120,
          height: 120,
          background: 'radial-gradient(circle, rgba(184,148,79,0.06) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />

      {header}

      {/* Layout: donut left, stats right */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 32,
          flexWrap: 'wrap',
        }}
      >
        {/* Donut */}
        <div
          style={{
            position: 'relative',
            width: 200,
            height: 200,
            flexShrink: 0,
          }}
        >
          <svg
            viewBox="0 0 200 200"
            width="200"
            height="200"
            style={{ display: 'block', overflow: 'visible' }}
          >
            <defs>
              <filter id="donut-inner-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
                <feOffset dx="0" dy="1" result="offsetBlur" />
                <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="shadowDiff" />
                <feFlood floodColor="#000000" floodOpacity="0.06" />
                <feComposite in2="shadowDiff" operator="in" />
                <feComposite in2="SourceGraphic" operator="over" />
              </filter>
            </defs>

            {/* Background track */}
            <circle
              cx={CX}
              cy={CY}
              r={RADIUS}
              fill="none"
              stroke="#F5F1EA"
              strokeWidth={STROKE_W}
            />

            {/* Animated segments */}
            {segments.map((seg, i) => (
              <AnimatedArc
                key={seg.key}
                cx={CX}
                cy={CY}
                r={RADIUS}
                startAngle={seg.start}
                endAngle={seg.end}
                color={seg.color}
                glowColor={seg.glowColor}
                delay={i * 200}
                animate={animate}
              />
            ))}
          </svg>

          {/* Center content */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 36,
                fontWeight: 800,
                color: '#191B1E',
                lineHeight: 1,
                letterSpacing: '-0.03em',
                animation: 'rsvpDonutPulseGlow 3s ease-in-out infinite',
              }}
            >
              {animatedPct}
              <span style={{ fontSize: 20, fontWeight: 600, opacity: 0.7 }}>%</span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 9,
                fontWeight: 700,
                color: '#B8944F',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                marginTop: 2,
              }}
            >
              Accepted
            </div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 10,
                color: '#A9A5A0',
                marginTop: 2,
              }}
            >
              {total} total
            </div>
          </div>
        </div>

        {/* Stats Panel */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minWidth: 180,
          }}
        >
          {SEGMENTS_CONFIG.map((cfg, idx) => {
            const seg = segments.find((s) => s.key === cfg.key);
            return (
              <StatRow
                key={cfg.key}
                color={cfg.color}
                label={cfg.label}
                count={seg ? seg.count : 0}
                percentage={seg ? seg.pct : 0}
                delay={600 + idx * 120}
              />
            );
          })}

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: 'linear-gradient(90deg, transparent, #E8E2D6, transparent)',
              margin: '4px 0',
            }}
          />

          {/* Total row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 14px',
              animation: `rsvpDonutStatSlide 0.5s ease-out ${600 + 3 * 120}ms both`,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                fontWeight: 500,
                color: '#A9A5A0',
              }}
            >
              Total Responses
            </span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 16,
                fontWeight: 800,
                color: '#191B1E',
              }}
            >
              {total}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
