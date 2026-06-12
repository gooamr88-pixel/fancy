'use client';
import React, { useState, useEffect } from 'react';

export default function RsvpProgressDonut({ rsvpOverview }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const { acceptedCount, declinedCount, pendingCount, acceptedPercent } = rsvpOverview;
  const total = acceptedCount + declinedCount + pendingCount;

  const segments = [
    { label: 'Accepted', count: acceptedCount, color: '#B8944F' },
    { label: 'Declined', count: declinedCount, color: '#77736A' },
    { label: 'Pending', count: pendingCount, color: '#D7BE80' },
  ];

  // SVG donut calculations
  const cx = 60;
  const cy = 60;
  const r = 44;
  const circumference = 2 * Math.PI * r;

  // Build segment arcs
  let cumulativeOffset = 0;
  const arcs = segments.map((seg) => {
    const fraction = total > 0 ? seg.count / total : 0;
    const dashLength = circumference * fraction;
    const gap = circumference - dashLength;
    const offset = -cumulativeOffset;
    cumulativeOffset += dashLength;
    return { ...seg, dashArray: `${dashLength} ${gap}`, offset };
  });

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E2D6',
        borderRadius: '12px',
        padding: '28px',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '16px',
          fontWeight: 600,
          color: '#191B1E',
          margin: '0 0 20px 0',
        }}
      >
        RSVP Progress
      </h3>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '32px',
        }}
      >
        {/* Donut */}
        <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
          <svg viewBox="0 0 120 120" width="120" height="120">
            {/* Background track */}
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="#F0ECE3"
              strokeWidth="12"
            />
            {/* Segments */}
            {arcs.map((arc, idx) => (
              <circle
                key={idx}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={arc.color}
                strokeWidth="12"
                strokeDasharray={animated ? arc.dashArray : `0 ${circumference}`}
                strokeDashoffset={arc.offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{
                  transition: 'stroke-dasharray 1s ease-out',
                }}
              />
            ))}
          </svg>
          {/* Center text */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: '#191B1E',
                fontFamily: 'var(--font-sans)',
                lineHeight: 1,
              }}
            >
              {acceptedPercent}%
            </span>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                color: '#B8944F',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontFamily: 'var(--font-sans)',
                marginTop: '3px',
              }}
            >
              Accepted
            </span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {segments.map((seg) => (
            <div
              key={seg.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: seg.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  color: '#191B1E',
                  minWidth: '70px',
                }}
              >
                {seg.label}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  color: '#77736A',
                  fontWeight: 600,
                }}
              >
                {seg.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
