'use client';

import { useEffect, useRef } from 'react';

export default function RsvpTrendChart({ rsvpTrend }) {
  const styleInjected = useRef(false);

  useEffect(() => {
    if (styleInjected.current) return;
    styleInjected.current = true;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse-ring {
        0% { transform: scale(1); opacity: 0.6; }
        100% { transform: scale(2.5); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      try { document.head.removeChild(style); } catch (e) {}
    };
  }, []);

  const data = Array.isArray(rsvpTrend) ? rsvpTrend : [];
  const hasData = data.length >= 2;

  // Compute acceptance percentages
  const points = data.map((d) => {
    const total = (d.accepted || 0) + (d.declined || 0) + (d.pending || 0);
    return {
      date: d.date || d.label || '',
      pct: total > 0 ? ((d.accepted || 0) / total) * 100 : 0,
    };
  });

  // SVG dimensions
  const padL = 45, padR = 15, padT = 15, padB = 30;
  const chartW = 460, chartH = 195;
  const svgW = 520, svgH = 240;

  // Map data to pixel coords
  const mapped = points.map((p, i) => ({
    x: padL + (points.length > 1 ? (i / (points.length - 1)) * chartW : chartW / 2),
    y: padT + chartH - (p.pct / 100) * chartH,
    date: p.date,
    pct: p.pct,
  }));

  // Catmull-Rom to cubic bezier
  function catmullRomToBezier(pts) {
    if (pts.length < 2) return '';
    const tension = 0.3;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 2] || pts[i - 1];
      const p1 = pts[i - 1];
      const p2 = pts[i];
      const p3 = pts[i + 1] || pts[i];
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  const linePath = catmullRomToBezier(mapped);
  const areaPath = mapped.length >= 2
    ? linePath + ` L${mapped[mapped.length - 1].x},${padT + chartH} L${mapped[0].x},${padT + chartH} Z`
    : '';

  // Y-axis ticks
  const yTicks = [0, 25, 50, 75, 100];

  // X-axis label logic
  const showEveryOther = points.length > 8;
  const formatDate = (d) => {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return d;
    }
  };

  const cardStyle = {
    background: '#FFFFFF',
    border: '1px solid #E8E2D6',
    borderRadius: 14,
    padding: 28,
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  };

  if (!hasData) {
    return (
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: 17, fontFamily: 'var(--font-serif)', color: '#191B1E', fontWeight: 600 }}>
              RSVP Trend
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: '#A9A5A0', marginTop: 2 }}>
              Acceptance rate over time
            </div>
          </div>
        </div>
        <div style={{
          minHeight: 240,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="4" y="18" width="8" height="22" rx="2" fill="#D7BE80" opacity="0.5" />
            <rect x="16" y="10" width="8" height="30" rx="2" fill="#D7BE80" opacity="0.7" />
            <rect x="28" y="14" width="8" height="26" rx="2" fill="#D7BE80" opacity="0.6" />
            <rect x="40" y="6" width="4" height="34" rx="2" fill="#D7BE80" opacity="0.8" />
            <line x1="2" y1="44" x2="46" y2="44" stroke="#D7BE80" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div style={{ fontSize: 14, fontFamily: 'var(--font-serif)', color: '#191B1E', fontWeight: 600 }}>
            No trend data yet
          </div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: '#A9A5A0' }}>
            RSVPs will appear here as guests respond
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <div style={{ fontSize: 17, fontFamily: 'var(--font-serif)', color: '#191B1E', fontWeight: 600 }}>
            RSVP Trend
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: '#A9A5A0', marginTop: 2 }}>
            Acceptance rate over time
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#B8944F', display: 'inline-block',
          }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: '#77736A' }}>
            Accepted
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="rsvp-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(184,148,79,0.25)" />
            <stop offset="100%" stopColor="rgba(184,148,79,0.01)" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((tick) => {
          const y = padT + chartH - (tick / 100) * chartH;
          return (
            <g key={tick}>
              <line
                x1={padL}
                y1={y}
                x2={padL + chartW}
                y2={y}
                stroke="#F0ECE3"
                strokeWidth="0.5"
              />
              <text
                x={padL - 8}
                y={y + 3}
                textAnchor="end"
                style={{ fontSize: 9, fontFamily: 'var(--font-sans)', fill: '#C4C0B9' }}
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#rsvp-area-grad)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#B8944F"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {mapped.map((pt, i) => {
          const isLast = i === mapped.length - 1;
          return (
            <g key={i}>
              {isLast && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="5"
                  fill="none"
                  stroke="#B8944F"
                  strokeWidth="2"
                  opacity="0.6"
                  style={{
                    transformOrigin: `${pt.x}px ${pt.y}px`,
                    animation: 'pulse-ring 2s ease-out infinite',
                  }}
                />
              )}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isLast ? 5 : 3.5}
                fill="#B8944F"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            </g>
          );
        })}

        {/* X-axis labels */}
        {mapped.map((pt, i) => {
          if (showEveryOther && i % 2 !== 0 && i !== mapped.length - 1) return null;
          return (
            <text
              key={`x-${i}`}
              x={pt.x}
              y={padT + chartH + 20}
              textAnchor="middle"
              style={{ fontSize: 9, fontFamily: 'var(--font-sans)', fill: '#C4C0B9' }}
            >
              {formatDate(pt.date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
