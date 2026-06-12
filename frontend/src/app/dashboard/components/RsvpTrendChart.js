'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

/* ── Constants ──────────────────────────────────────────────── */

const SERIES_CONFIG = [
  { key: 'accepted', label: 'Accepted', color: '#B8944F', gradFrom: 'rgba(184,148,79,0.30)', gradTo: 'rgba(184,148,79,0.02)' },
  { key: 'declined', label: 'Declined', color: '#77736A', gradFrom: 'rgba(119,115,106,0.25)', gradTo: 'rgba(119,115,106,0.02)' },
  { key: 'pending',  label: 'Pending',  color: '#D7BE80', gradFrom: 'rgba(215,190,128,0.28)', gradTo: 'rgba(215,190,128,0.02)' },
];

const PAD = { l: 52, r: 24, t: 20, b: 40 };
const STYLES_ID = 'rsvp-trend-premium-styles';

/* ── Injected CSS ──────────────────────────────────────────── */

const CSS = `
@keyframes rsvpTrendFadeIn {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes rsvpTrendDrawLine {
  from { stroke-dashoffset: var(--dash-total); }
  to   { stroke-dashoffset: 0; }
}
@keyframes rsvpTrendAreaReveal {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes rsvpTrendEmptyFloat {
  0%, 100% { transform: translateY(0px); }
  50%      { transform: translateY(-5px); }
}
@keyframes rsvpTrendEmptyDash {
  to { stroke-dashoffset: 0; }
}
@keyframes rsvpTrendDotPop {
  from { r: 0; opacity: 0; }
  to   { r: 4; opacity: 1; }
}
.rsvp-trend-legend-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 5px 12px; border-radius: 20px;
  border: 1px solid #E8E2D6; background: #FAFAF8;
  cursor: pointer; transition: all 0.25s ease;
  font-family: var(--font-sans); font-size: 11px;
  font-weight: 500; color: #191B1E;
}
.rsvp-trend-legend-btn:hover {
  background: #F0ECE3; transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.rsvp-trend-legend-btn[data-active="false"] {
  opacity: 0.4; background: #F5F5F5; border-color: #E0E0E0;
}
.rsvp-trend-tooltip {
  position: absolute; pointer-events: none;
  background: rgba(25,27,30,0.92); backdrop-filter: blur(12px);
  border: 1px solid rgba(184,148,79,0.2);
  border-radius: 12px; padding: 12px 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  font-family: var(--font-sans); color: #F8F4EC;
  transition: opacity 0.18s ease, transform 0.18s ease;
  z-index: 20; min-width: 140px;
}
`;

/* ── Catmull-Rom Interpolation ─────────────────────────────── */

function catmullRomToBezier(pts, tension = 0.3) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
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

function approxPathLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.sqrt(Math.pow(pts[i].x - pts[i - 1].x, 2) + Math.pow(pts[i].y - pts[i - 1].y, 2));
  }
  return len * 1.15; // approximate bezier length
}

/* ── Date Format ───────────────────────────────────────────── */

function formatDate(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return String(d);
  }
}

/* ── Empty State ────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div
      style={{
        minHeight: 280,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
      }}
    >
      <div style={{ animation: 'rsvpTrendEmptyFloat 3s ease-in-out infinite' }}>
        <svg width="72" height="56" viewBox="0 0 72 56" fill="none">
          {/* Grid lines */}
          <line x1="8" y1="12" x2="64" y2="12" stroke="#E8E2D6" strokeWidth="0.8" />
          <line x1="8" y1="24" x2="64" y2="24" stroke="#E8E2D6" strokeWidth="0.8" />
          <line x1="8" y1="36" x2="64" y2="36" stroke="#E8E2D6" strokeWidth="0.8" />
          <line x1="8" y1="48" x2="64" y2="48" stroke="#E8E2D6" strokeWidth="1" />
          {/* Smooth curve placeholder */}
          <path
            d="M12,40 Q24,20 36,28 T60,16"
            stroke="#D7BE80"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="80"
            strokeDashoffset="80"
            style={{ animation: 'rsvpTrendEmptyDash 2s ease-out 0.3s forwards' }}
          />
          {/* Dots */}
          <circle cx="12" cy="40" r="2.5" fill="#D7BE80" opacity="0.6" />
          <circle cx="36" cy="28" r="2.5" fill="#B8944F" opacity="0.7" />
          <circle cx="60" cy="16" r="3" fill="#B8944F" opacity="0.8" />
          {/* Sparkle */}
          <path d="M62 8l0.7 2 2 0.7-2 0.7-0.7 2-0.7-2-2-0.7 2-0.7z" fill="#B8944F" opacity="0.5" />
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
          No trend data yet
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: '#A9A5A0',
            lineHeight: 1.5,
          }}
        >
          RSVPs will appear here as guests respond
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */

export default function RsvpTrendChart({ rsvpTrend = [] }) {
  const data = useMemo(() => (Array.isArray(rsvpTrend) ? rsvpTrend : []), [rsvpTrend]);
  const hasData = data.length >= 1;

  const [enabledSeries, setEnabledSeries] = useState({
    accepted: true,
    declined: true,
    pending: true,
  });
  const [hoverIdx, setHoverIdx] = useState(-1);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);
  const containerRef = useRef(null);

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

  /* ── Compute chart dimensions ─── */
  const svgW = 580;
  const svgH = 280;
  const chartW = svgW - PAD.l - PAD.r;
  const chartH = svgH - PAD.t - PAD.b;

  /* ── Compute max Y value for enabled series ─── */
  const maxY = useMemo(() => {
    if (!hasData) return 100;
    let max = 0;
    data.forEach((d) => {
      SERIES_CONFIG.forEach((s) => {
        if (enabledSeries[s.key]) {
          max = Math.max(max, (d[s.key] || 0));
        }
      });
    });
    return max > 0 ? Math.ceil(max * 1.15) : 10;
  }, [data, enabledSeries, hasData]);

  /* ── Y-axis ticks ─── */
  const yTicks = useMemo(() => {
    const step = maxY <= 10 ? 2 : maxY <= 50 ? 10 : maxY <= 100 ? 25 : Math.ceil(maxY / 5 / 10) * 10;
    const ticks = [];
    for (let v = 0; v <= maxY; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] < maxY) ticks.push(maxY);
    return ticks;
  }, [maxY]);

  /* ── Map data to pixel coords per series ─── */
  const seriesMapped = useMemo(() => {
    if (!hasData) return {};
    const result = {};
    SERIES_CONFIG.forEach((s) => {
      result[s.key] = data.map((d, i) => ({
        x: PAD.l + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
        y: PAD.t + chartH - ((d[s.key] || 0) / maxY) * chartH,
        value: d[s.key] || 0,
        date: d.date || d.label || '',
      }));
    });
    return result;
  }, [data, hasData, maxY, chartW, chartH]);

  /* ── X labels logic ─── */
  const showEveryN = data.length > 12 ? 3 : data.length > 7 ? 2 : 1;

  /* ── SVG mouse move for crosshair ─── */
  const handleMouseMove = useCallback(
    (e) => {
      if (!svgRef.current || !hasData || data.length < 2) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const svgScale = svgW / rect.width;
      const scaledX = mouseX * svgScale;

      // Find nearest data index
      let nearest = -1;
      let minDist = Infinity;
      const firstSeries = seriesMapped[SERIES_CONFIG[0].key];
      if (!firstSeries) return;
      firstSeries.forEach((pt, i) => {
        const dist = Math.abs(pt.x - scaledX);
        if (dist < minDist) {
          minDist = dist;
          nearest = i;
        }
      });

      const snapThreshold = chartW / (data.length - 1) * 0.6;
      if (minDist > snapThreshold) {
        setHoverIdx(-1);
        return;
      }

      setHoverIdx(nearest);
      setTooltipPos({ x: e.clientX, y: e.clientY });
    },
    [hasData, data, seriesMapped, chartW, svgW],
  );

  const handleMouseLeave = useCallback(() => setHoverIdx(-1), []);

  const toggleSeries = useCallback((key) => {
    setEnabledSeries((prev) => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      if (prev[key] && activeCount <= 1) return prev; // keep at least one
      return { ...prev, [key]: !prev[key] };
    });
  }, []);

  /* ── Card style ─── */
  const cardStyle = {
    background: '#FFFFFF',
    border: '1px solid #E8E2D6',
    borderRadius: 16,
    padding: '28px 28px 24px',
    animation: 'rsvpTrendFadeIn 0.7s ease-out both',
    overflow: 'hidden',
    position: 'relative',
  };

  /* ── Header + Legend ─── */
  const headerBlock = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 18,
            fontFamily: 'var(--font-serif)',
            color: '#191B1E',
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          RSVP Trend
        </div>
        <div
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-sans)',
            color: '#A9A5A0',
            marginTop: 4,
            letterSpacing: '0.01em',
          }}
        >
          Response breakdown over time
        </div>
      </div>
      {hasData && (
        <div style={{ display: 'flex', gap: 6 }}>
          {SERIES_CONFIG.map((s) => (
            <button
              key={s.key}
              className="rsvp-trend-legend-btn"
              data-active={String(enabledSeries[s.key])}
              onClick={() => toggleSeries(s.key)}
              type="button"
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: enabledSeries[s.key] ? s.color : '#C0C0C0',
                  display: 'inline-block',
                  transition: 'background 0.2s',
                }}
              />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (!hasData) {
    return (
      <div style={cardStyle}>
        {headerBlock}
        <EmptyState />
      </div>
    );
  }

  /* ── Build paths for each enabled series ─── */
  const paths = SERIES_CONFIG.filter((s) => enabledSeries[s.key]).map((s) => {
    const pts = seriesMapped[s.key];
    if (!pts || pts.length === 0) return null;
    const linePath = catmullRomToBezier(pts);
    const pathLen = approxPathLength(pts);

    // Area path
    let areaPath = '';
    if (pts.length >= 2) {
      areaPath =
        linePath +
        ` L${pts[pts.length - 1].x},${PAD.t + chartH} L${pts[0].x},${PAD.t + chartH} Z`;
    }

    return { ...s, pts, linePath, areaPath, pathLen };
  }).filter(Boolean);

  /* ── Tooltip data ─── */
  const tooltipData =
    hoverIdx >= 0
      ? {
          date: formatDate(data[hoverIdx]?.date || data[hoverIdx]?.label),
          values: SERIES_CONFIG.filter((s) => enabledSeries[s.key]).map((s) => ({
            label: s.label,
            color: s.color,
            value: data[hoverIdx]?.[s.key] || 0,
          })),
        }
      : null;

  return (
    <div ref={containerRef} style={cardStyle}>
      {/* Subtle decorative gradient orb */}
      <div
        style={{
          position: 'absolute',
          top: -30,
          left: -30,
          width: 100,
          height: 100,
          background: 'radial-gradient(circle, rgba(184,148,79,0.05) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />

      {headerBlock}

      {/* Chart area */}
      <div style={{ position: 'relative', width: '100%' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Gradients for each series area fill */}
            {SERIES_CONFIG.map((s) => (
              <linearGradient key={`grad-${s.key}`} id={`rsvp-trend-area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.gradFrom} />
                <stop offset="100%" stopColor={s.gradTo} />
              </linearGradient>
            ))}
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick) => {
            const y = PAD.t + chartH - (tick / maxY) * chartH;
            return (
              <g key={tick}>
                <line
                  x1={PAD.l}
                  y1={y}
                  x2={PAD.l + chartW}
                  y2={y}
                  stroke={tick === 0 ? '#E0DCD4' : '#F2EFE8'}
                  strokeWidth={tick === 0 ? '1' : '0.6'}
                />
                <text
                  x={PAD.l - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  style={{
                    fontSize: 9,
                    fontFamily: 'var(--font-sans)',
                    fill: '#B5B1AA',
                    fontWeight: 500,
                  }}
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Area fills — rendered first (behind lines) */}
          {paths.map((p, idx) => (
            p.areaPath && (
              <path
                key={`area-${p.key}`}
                d={p.areaPath}
                fill={`url(#rsvp-trend-area-${p.key})`}
                style={{
                  animation: `rsvpTrendAreaReveal 0.8s ease-out ${0.6 + idx * 0.2}s both`,
                }}
              />
            )
          ))}

          {/* Lines with draw animation */}
          {paths.map((p, idx) => (
            <path
              key={`line-${p.key}`}
              d={p.linePath}
              fill="none"
              stroke={p.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={p.pathLen}
              strokeDashoffset={p.pathLen}
              style={{
                '--dash-total': p.pathLen,
                animation: `rsvpTrendDrawLine 1.2s ease-out ${0.2 + idx * 0.15}s forwards`,
              }}
            />
          ))}

          {/* Static data dots (small, subtle) */}
          {paths.map((p) =>
            p.pts.map((pt, i) => (
              <circle
                key={`dot-${p.key}-${i}`}
                cx={pt.x}
                cy={pt.y}
                r={hoverIdx === i ? 5 : 0}
                fill={p.color}
                stroke="#FFFFFF"
                strokeWidth="2.5"
                style={{
                  transition: 'r 0.2s ease, opacity 0.2s ease',
                  opacity: hoverIdx === i ? 1 : 0,
                  filter: hoverIdx === i ? `drop-shadow(0 0 4px ${p.color})` : 'none',
                }}
              />
            )),
          )}

          {/* Vertical crosshair line */}
          {hoverIdx >= 0 && seriesMapped[SERIES_CONFIG[0].key] && (
            <line
              x1={seriesMapped[SERIES_CONFIG[0].key][hoverIdx].x}
              y1={PAD.t}
              x2={seriesMapped[SERIES_CONFIG[0].key][hoverIdx].x}
              y2={PAD.t + chartH}
              stroke="rgba(184,148,79,0.3)"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          )}

          {/* X-axis labels */}
          {seriesMapped[SERIES_CONFIG[0].key]?.map((pt, i) => {
            if (i % showEveryN !== 0 && i !== data.length - 1) return null;
            return (
              <text
                key={`x-${i}`}
                x={pt.x}
                y={PAD.t + chartH + 24}
                textAnchor="middle"
                style={{
                  fontSize: 9,
                  fontFamily: 'var(--font-sans)',
                  fill: hoverIdx === i ? '#191B1E' : '#B5B1AA',
                  fontWeight: hoverIdx === i ? 600 : 500,
                  transition: 'fill 0.2s, font-weight 0.2s',
                }}
              >
                {formatDate(pt.date)}
              </text>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltipData && containerRef.current && (() => {
          const containerRect = containerRef.current.getBoundingClientRect();
          const tLeft = tooltipPos.x - containerRect.left + 16;
          const tTop = tooltipPos.y - containerRect.top - 20;
          const flipX = tLeft + 160 > containerRect.width;
          return (
            <div
              className="rsvp-trend-tooltip"
              style={{
                left: flipX ? tLeft - 176 : tLeft,
                top: tTop,
                opacity: 1,
                transform: 'translateY(-8px)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#D7BE80',
                  marginBottom: 8,
                  letterSpacing: '0.02em',
                }}
              >
                {tooltipData.date}
              </div>
              {tooltipData.values.map((v) => (
                <div
                  key={v.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    marginBottom: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: v.color,
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#B5B1AA' }}>{v.label}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#F8F4EC' }}>
                    {v.value}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
