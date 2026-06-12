'use client';

import React, { useState, useEffect, useRef } from 'react';

/* ── Utilities ──────────────────────────────────────────────── */

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

/* ── Constants ──────────────────────────────────────────────── */

const CX = 80;
const CY = 80;
const RADIUS = 58;
const STROKE_W = 16;
const GAP_DEG = 3; // gap between segments

const SEGMENTS_CONFIG = [
  { key: 'accepted', label: 'Accepted', color: '#B8944F' },
  { key: 'declined', label: 'Declined', color: '#77736A' },
  { key: 'pending', label: 'Pending', color: '#D7BE80' },
];

/* ── Animated Arc ───────────────────────────────────────────── */

function AnimatedArc({ cx, cy, r, startAngle, endAngle, color, delay, animate }) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (!animate || endAngle - startAngle <= 0) return;
    const duration = 1200;
    startTimeRef.current = null;

    const step = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current - delay;
      if (elapsed < 0) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      const t = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animate, startAngle, endAngle, delay]);

  const currentEnd = startAngle + (endAngle - startAngle) * progress;
  if (currentEnd - startAngle < 0.5) return null;

  const d = describeArc(cx, cy, r, startAngle, currentEnd);

  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={STROKE_W}
      strokeLinecap="round"
    />
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
        padding: '40px 0',
        gap: 12,
      }}
    >
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="16" stroke="#E8E2D6" strokeWidth="2" strokeDasharray="4 3" />
        <path d="M14 20h12" stroke="#A9A5A0" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: '#A9A5A0',
          fontWeight: 500,
        }}
      >
        No RSVP data yet
      </span>
    </div>
  );
}

/* ── Stat Row ───────────────────────────────────────────────── */

function StatRow({ color, label, count, percentage }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingLeft: 12,
        borderLeft: `3px solid ${color}`,
        borderRadius: '0 0 0 0',
      }}
    >
      {/* Color dot */}
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      {/* Label */}
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
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
          fontSize: 14,
          fontWeight: 700,
          color: '#191B1E',
          marginRight: 8,
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
          background: `${color}1A`, // 10% opacity
          borderRadius: 12,
          padding: '2px 8px',
          minWidth: 32,
          textAlign: 'center',
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
  const containerRef = useRef(null);

  const accepted = rsvpOverview.accepted || 0;
  const declined = rsvpOverview.declined || 0;
  const pending = rsvpOverview.pending || 0;
  const total = accepted + declined + pending;

  useEffect(() => {
    // Trigger animation on mount
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (total === 0) {
    return (
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E2D6',
          borderRadius: 14,
          padding: 28,
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 17,
              fontWeight: 600,
              color: '#191B1E',
              margin: 0,
            }}
          >
            RSVP Progress
          </h3>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              color: '#A9A5A0',
              margin: '4px 0 0 0',
            }}
          >
            Response distribution across all events
          </p>
        </div>
        <EmptyState />
      </div>
    );
  }

  const acceptedPct = Math.round((accepted / total) * 100);
  const declinedPct = Math.round((declined / total) * 100);
  const pendingPct = 100 - acceptedPct - declinedPct;

  // Build segment angles
  const segments = [];
  const values = [accepted, declined, pending];
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
      pct: i === 0 ? acceptedPct : i === 1 ? declinedPct : pendingPct,
    });
    currentAngle += sweep + GAP_DEG;
  }

  return (
    <div
      ref={containerRef}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E2D6',
        borderRadius: 14,
        padding: 28,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h3
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 17,
            fontWeight: 600,
            color: '#191B1E',
            margin: 0,
          }}
        >
          RSVP Progress
        </h3>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            color: '#A9A5A0',
            margin: '4px 0 0 0',
          }}
        >
          Response distribution across all events
        </p>
      </div>

      {/* Layout: donut left, stats right */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 32,
        }}
      >
        {/* Donut */}
        <div
          style={{
            position: 'relative',
            width: 160,
            height: 160,
            flexShrink: 0,
          }}
        >
          <svg
            viewBox="0 0 160 160"
            width="160"
            height="160"
            style={{ display: 'block' }}
          >
            {/* Background track */}
            <circle
              cx={CX}
              cy={CY}
              r={RADIUS}
              fill="none"
              stroke="#F0ECE3"
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
                delay={i * 150}
                animate={animate}
              />
            ))}
          </svg>

          {/* Center text */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 30,
                fontWeight: 800,
                color: '#191B1E',
                lineHeight: 1,
              }}
            >
              {acceptedPct}%
            </div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 9,
                fontWeight: 700,
                color: '#B8944F',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginTop: 3,
              }}
            >
              Accepted
            </div>
          </div>
        </div>

        {/* Stats Panel */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {SEGMENTS_CONFIG.map((cfg) => {
            const seg = segments.find((s) => s.key === cfg.key);
            return (
              <StatRow
                key={cfg.key}
                color={cfg.color}
                label={cfg.label}
                count={seg ? seg.count : 0}
                percentage={seg ? seg.pct : 0}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
