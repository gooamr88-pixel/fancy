'use client';
import React, { useMemo } from 'react';

export default function RsvpTrendChart({ rsvpTrend }) {
  // Chart dimensions
  const svgWidth = 480;
  const svgHeight = 260;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 32;
  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const yTicks = [0, 25, 50, 75, 100];

  const chartData = useMemo(() => {
    if (!rsvpTrend || rsvpTrend.length < 2) return null;

    const points = rsvpTrend.map((d, i) => {
      const total = d.accepted + d.declined + d.pending;
      const pct = total > 0 ? (d.accepted / total) * 100 : 0;
      const x = padLeft + (i / (rsvpTrend.length - 1)) * chartW;
      const y = padTop + chartH - (pct / 100) * chartH;
      return { x, y, pct, date: d.date };
    });

    // Build smooth quadratic bezier path
    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      linePath += ` Q ${cpx} ${prev.y}, ${(cpx + curr.x) / 2} ${(prev.y + curr.y) / 2}`;
    }
    // Final segment to last point
    const last = points[points.length - 1];
    linePath += ` L ${last.x} ${last.y}`;

    // Simpler smooth path using quadratic beziers between midpoints
    let smoothLine = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      if (i === 0) {
        smoothLine += ` Q ${p0.x} ${p0.y}, ${midX} ${midY}`;
      } else {
        smoothLine += ` Q ${p0.x} ${p0.y}, ${midX} ${midY}`;
      }
    }
    const lastPt = points[points.length - 1];
    const secondLast = points[points.length - 2];
    smoothLine += ` Q ${secondLast.x + (lastPt.x - secondLast.x) * 0.5} ${lastPt.y}, ${lastPt.x} ${lastPt.y}`;

    // Area path: line path + close to bottom
    const areaPath = smoothLine + ` L ${lastPt.x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`;

    return { points, smoothLine, areaPath };
  }, [rsvpTrend, chartW, chartH]);

  if (!rsvpTrend || rsvpTrend.length < 2) {
    return (
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E2D6',
          borderRadius: '12px',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
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
          RSVP Trend
        </h3>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '180px',
            color: '#77736A',
            fontSize: '13px',
            fontFamily: 'var(--font-sans)',
            fontStyle: 'italic',
          }}
        >
          No trend data yet
        </div>
      </div>
    );
  }

  const { points, smoothLine, areaPath } = chartData;

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
        RSVP Trend
      </h3>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(184,148,79,0.3)" />
            <stop offset="100%" stopColor="rgba(184,148,79,0.02)" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines + Y labels */}
        {yTicks.map((tick) => {
          const y = padTop + chartH - (tick / 100) * chartH;
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={padLeft + chartW}
                y2={y}
                stroke="#F0ECE3"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              <text
                x={padLeft - 8}
                y={y + 3}
                textAnchor="end"
                fill="#A9A5A0"
                fontSize="10"
                fontFamily="var(--font-sans)"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <path
          d={smoothLine}
          fill="none"
          stroke="#B8944F"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {points.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={3}
            fill="#B8944F"
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />
        ))}

        {/* X-axis labels */}
        {points.map((pt, i) => (
          <text
            key={i}
            x={pt.x}
            y={padTop + chartH + 18}
            textAnchor="middle"
            fill="#A9A5A0"
            fontSize="10"
            fontFamily="var(--font-sans)"
          >
            {pt.date}
          </text>
        ))}
      </svg>
    </div>
  );
}
