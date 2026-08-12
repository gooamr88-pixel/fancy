'use client';

import React, { useId, useMemo, useRef, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   ANALYTICS VISUALISATION PRIMITIVES

   Hand-rolled SVG/HTML — the app ships no charting library and this doesn't
   justify adding one. Every mark spec below (thin bars, 2px lines, 4px
   rounded data-ends, 2px surface gaps, hairline solid grid, selective direct
   labels) is fixed, not per-chart taste.

   COLOUR. Chosen by the job the colour does, and every set below was run
   through a CVD/contrast validator against this dashboard's own white card
   surface rather than eyeballed:

     • SERIES (identity, 2+ things told apart) — worst adjacent pair CVD
       ΔE 17.3, normal-vision ΔE 23.7, all ≥ 3:1 on white. Valid for
       adjacent forms — lines, bars, stacks. NOT for scatter/bubble/small
       multiples: on the all-pairs test gold↔terracotta measures 13.8, under
       the 15 floor. Hence the small multiples below use ONE hue and let
       each panel's title carry identity.
     • ORDINAL (ranked stages — the funnel) — one hue, light→dark, monotone
       lightness, every step gap ≥ 0.06 L, light end 2.10:1 on white.
     • STATUS (state, not identity) — the product's own response colours,
       already what a guest sees on the invitation. Never reused as a series
       hue, and always shipped with a written label, never colour alone.

   Text never wears a data colour: values and labels use ink tokens, and a
   coloured swatch beside them carries identity.
   ═══════════════════════════════════════════════════════════════════════════ */

export const VIZ = {
  surface: '#FFFFFF',
  plane: '#FAFAF8',
  ink: '#191B1E',
  inkSecondary: '#52514E',
  inkMuted: '#898781',
  grid: '#EDE8DD',
  axis: '#D6D0C4',
  border: '#E8E2D6',
  gold: '#B8944F',

  series: ['#A87519', '#1C6E9C', '#B33A2B'],
  ordinal: ['#D3AE5C', '#C29A3D', '#AF8322', '#996C14', '#7D560F', '#5E3F0A'],
  // A lighter step of the meter's own hue for the unfilled track, so state
  // reads across the whole bar instead of the fill floating on grey.
  track: '#F0E4CB',

  status: {
    yes: { color: '#3B9B6D', label: 'Attending' },
    no: { color: '#C45E5E', label: 'Declined' },
    maybe: { color: '#6366F1', label: 'Tentative' },
    pending: { color: '#8A857B', label: 'No reply yet' },
  },
};

const SANS = 'var(--font-sans)';

/* ─── formatting ───
   Compact for display values; full precision stays reachable in the table
   view under every chart, so nothing is gated behind an abbreviation. */
export function compact(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const v = Number(n);
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(v) >= 10_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return v.toLocaleString('en-US');
}

export function duration(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

/* ═══ Card — the shell every chart lives in ═══
   Owns the table-view toggle, so no chart has to reimplement it and none can
   ship without one. `table` is {columns, rows}; when absent the toggle is
   simply not rendered (a stat-only card has nothing to tabulate). */
export function Card({ title, hint, table, children, span = 1 }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section style={{
      gridColumn: `span ${span}`,
      background: VIZ.surface,
      border: `1px solid ${VIZ.border}`,
      borderRadius: 14,
      padding: '20px 22px 22px',
      minWidth: 0,
    }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, marginBottom: hint ? 4 : 18 }}>
        <h2 style={{ margin: 0, fontFamily: SANS, fontSize: 13, fontWeight: 700, letterSpacing: '.02em', color: VIZ.ink }}>{title}</h2>
        {table && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            style={{
              marginInlineStart: 'auto', border: `1px solid ${VIZ.border}`, background: showTable ? VIZ.plane : 'transparent',
              color: VIZ.inkSecondary, borderRadius: 999, padding: '4px 12px', minHeight: 28,
              fontFamily: SANS, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {showTable ? 'Chart' : 'Table'}
          </button>
        )}
      </header>
      {hint && <p style={{ margin: '0 0 18px', fontFamily: SANS, fontSize: 11.5, lineHeight: 1.5, color: VIZ.inkMuted }}>{hint}</p>}
      {showTable && table ? <DataTable {...table} /> : children}
    </section>
  );
}

/* The WCAG-clean twin of every chart. tabular-nums here (and only here and on
   axis ticks) — columns of numbers have to align vertically. */
/* .fx-scroll-x rather than a bare overflowX:auto — it adds the
   max-width:100% that stops this port from being the thing that overflows,
   momentum scrolling on iOS, and overscroll-behavior-x so a swipe past the
   end of the table does not trigger browser back-navigation. This table is
   load-bearing on a phone: it is the accessible twin every chart above
   falls back to. */
export function DataTable({ columns, rows }) {
  return (
    <div className="fx-scroll-x">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: 12 }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c} scope="col" style={{
                textAlign: i === 0 ? 'start' : 'end', padding: '7px 10px', color: VIZ.inkMuted,
                fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${VIZ.border}`, whiteSpace: 'nowrap',
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td key={ci} style={{
                  textAlign: ci === 0 ? 'start' : 'end', padding: '7px 10px',
                  color: ci === 0 ? VIZ.inkSecondary : VIZ.ink,
                  fontVariantNumeric: ci === 0 ? 'normal' : 'tabular-nums',
                  borderBottom: `1px solid ${VIZ.grid}`, whiteSpace: 'nowrap',
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══ Hero figure — the one number the view leads with ═══
   Same sans as everything else (a serif here reads as decoration), and
   proportional figures: tabular-nums makes a number like 121 look loose at
   display sizes. */
export function Hero({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: VIZ.inkMuted }}>{label}</div>
      <div style={{ fontFamily: SANS, fontSize: 54, lineHeight: 1.05, fontWeight: 700, color: VIZ.ink, margin: '6px 0 2px' }}>{value}</div>
      {sub && <div style={{ fontFamily: SANS, fontSize: 12.5, color: VIZ.inkSecondary }}>{sub}</div>}
    </div>
  );
}

/* ═══ Stat tile ═══ */
export function Stat({ label, value, sub, tone }) {
  const toneColor = tone ? VIZ.status[tone]?.color : null;
  return (
    <div style={{
      background: VIZ.surface, border: `1px solid ${VIZ.border}`, borderRadius: 12,
      padding: '14px 16px', minWidth: 0,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 }}>
        {toneColor && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: toneColor, flex: 'none' }} />}
        <span style={{ fontFamily: SANS, fontSize: 11.5, color: VIZ.inkMuted, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </div>
      <div style={{ fontFamily: SANS, fontSize: 26, fontWeight: 700, color: VIZ.ink, marginTop: 4, lineHeight: 1.15 }}>{value}</div>
      {sub && <div style={{ fontFamily: SANS, fontSize: 11, color: VIZ.inkMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ═══ Meter — one ratio against its limit ═══
   Track is a lighter step of the fill's own hue, not grey, so the whole bar
   reads as one scale. */
export function Meter({ value, max = 100, label, caption }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontFamily: SANS, fontSize: 11.5, color: VIZ.inkMuted, fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: SANS, fontSize: 22, fontWeight: 700, color: VIZ.ink }}>{Math.round(pct)}%</span>
      </div>
      <div
        role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
        style={{ height: 10, borderRadius: 5, background: VIZ.track, overflow: 'hidden', marginTop: 8 }}
      >
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 5, background: VIZ.series[0] }} />
      </div>
      {caption && <div style={{ fontFamily: SANS, fontSize: 11, color: VIZ.inkMuted, marginTop: 7 }}>{caption}</div>}
    </div>
  );
}

/* ═══ Horizontal bars ═══
   For NOMINAL categories every bar is the same hue — colouring darker-where-
   bigger would double-encode length as hue and burn the only free channel on
   information the bar already shows. Ranked stages pass `ramp` instead.

   Labels sit outside the bar end, always: an in-bar value is unreadable on a
   short bar and clipping it is worse than not drawing it. */
export function BarList({ items, ramp, valueFormat = compact, emptyText = 'Nothing recorded yet' }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <Empty text={emptyText} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((item, i) => (
        <div key={item.label}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 5 }}>
            <span style={{ fontFamily: SANS, fontSize: 12, color: VIZ.inkSecondary, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
            <span style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 700, color: VIZ.ink, flex: 'none' }}>
              {valueFormat(item.value)}
              {item.note && <span style={{ fontWeight: 500, color: VIZ.inkMuted, marginInlineStart: 8 }}>{item.note}</span>}
            </span>
          </div>
          {/* 8px bar, 4px rounded data-end, square at the baseline. */}
          <div style={{ height: 8, background: VIZ.grid, borderRadius: 4 }}>
            <div style={{
              width: `${(item.value / max) * 100}%`, height: '100%',
              background: ramp ? ramp[Math.min(i, ramp.length - 1)] : VIZ.series[0],
              borderRadius: '0 4px 4px 0',
              minWidth: item.value > 0 ? 3 : 0,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══ Stacked bar — part-to-whole ═══
   Segments separated by a 2px gap in the surface colour, never a stroke. */
export function StackedBar({ segments, total }) {
  const sum = total || segments.reduce((s, x) => s + x.value, 0);
  if (!sum) return <Empty text="No responses yet" />;
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, height: 14 }}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.label} title={`${s.label}: ${s.value}`} style={{
            flex: `${s.value} 1 0`, background: s.color, borderRadius: 3, minWidth: 3,
          }} />
        ))}
      </div>
      {/* Legend is always present for 2+ series — identity never rests on
          colour alone, and each entry carries its own number. */}
      <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
        {segments.map((s) => (
          <li key={s.label} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, fontFamily: SANS, fontSize: 12 }}>
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flex: 'none' }} />
            <span style={{ color: VIZ.inkSecondary }}>{s.label}</span>
            <span style={{ color: VIZ.ink, fontWeight: 700 }}>{compact(s.value)}</span>
            <span style={{ color: VIZ.inkMuted }}>{Math.round((s.value / sum) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ═══ Small-multiple line panel ═══
   Three metrics whose magnitudes differ by an order of magnitude cannot share
   one y-axis without the small one lying flat on the floor — and a second
   y-axis would invent a correlation that isn't in the data. So each metric
   gets its own panel and its own scale, sharing the x-axis underneath.

   One hue across all panels: each panel is a single series titled by name, so
   colour has no identity work to do here, and the series palette is not
   all-pairs safe at three slots anyway. */
export function LinePanel({ title, points, color = VIZ.series[0], height = 92 }) {
  const uid = useId();
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);

  const W = 640;
  const padL = 8;
  const padR = 46;   // room for the end label
  const padT = 10;
  const padB = 4;
  const H = height;

  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = points.length > 1 ? (W - padL - padR) / (points.length - 1) : 0;
  const x = (i) => padL + i * stepX;
  const y = (v) => padT + (1 - v / max) * (H - padT - padB);

  const path = useMemo(
    () => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' '),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, max, stepX]
  );

  if (!points.length) return <div><PanelTitle title={title} /><Empty text="No activity in this range" /></div>;

  const last = points[points.length - 1];

  const onMove = (e) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return;
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(points.length - 1, Math.round((rel - padL) / (stepX || 1))));
    setHover(i);
  };

  return (
    <div>
      <PanelTitle title={title} value={compact(last.value)} color={color} />
      <div
        ref={wrapRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ position: 'relative', marginTop: 6 }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`${title} over time`} style={{ display: 'block', overflow: 'visible' }}>
          {/* Hairline, solid, recessive — never dashed. */}
          <line x1={padL} y1={y(0)} x2={W - padR} y2={y(0)} stroke={VIZ.axis} strokeWidth="1" />
          <line x1={padL} y1={y(max)} x2={W - padR} y2={y(max)} stroke={VIZ.grid} strokeWidth="1" />

          <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {hover != null && points[hover] && (
            <g>
              <line x1={x(hover)} y1={padT - 6} x2={x(hover)} y2={H - padB} stroke={VIZ.axis} strokeWidth="1" />
              <circle cx={x(hover)} cy={y(points[hover].value)} r="5" fill={color} stroke={VIZ.surface} strokeWidth="2" />
            </g>
          )}

          {/* End marker: r=4.5 with a 2px surface ring, so it stays legible
              where it crosses the axis. */}
          <circle cx={x(points.length - 1)} cy={y(last.value)} r="4.5" fill={color} stroke={VIZ.surface} strokeWidth="2" />
          <text
            x={x(points.length - 1) + 10} y={y(last.value) + 4}
            fontFamily={SANS} fontSize="11.5" fontWeight="700" fill={VIZ.ink}
          >{compact(last.value)}</text>
          <title id={uid}>{title}</title>
        </svg>

        {hover != null && points[hover] && (
          <div style={{
            position: 'absolute', top: -4, left: `${(x(hover) / W) * 100}%`, transform: 'translate(-50%,-100%)',
            background: VIZ.ink, color: VIZ.surface, borderRadius: 7, padding: '5px 9px',
            fontFamily: SANS, fontSize: 11, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2,
          }}>
            <strong style={{ fontWeight: 700 }}>{compact(points[hover].value)}</strong>
            <span style={{ opacity: .75, marginInlineStart: 7 }}>{points[hover].label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PanelTitle({ title, value, color }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {color && <span aria-hidden style={{ width: 9, height: 9, borderRadius: 2, background: color, flex: 'none' }} />}
      <span style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 600, color: VIZ.inkSecondary }}>{title}</span>
      {value != null && <span style={{ marginInlineStart: 'auto', fontFamily: SANS, fontSize: 11.5, color: VIZ.inkMuted }}>latest {value}</span>}
    </div>
  );
}

export function Empty({ text }) {
  return (
    <p style={{
      margin: 0, padding: '22px 0', textAlign: 'center',
      fontFamily: SANS, fontSize: 12, color: VIZ.inkMuted,
    }}>{text}</p>
  );
}

/* A status message that never rests on colour: icon + written label, always. */
export function StatusNote({ tone = 'critical', children }) {
  const color = tone === 'critical' ? '#C45E5E' : VIZ.gold;
  return (
    <p style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 8, margin: '14px 0 0', padding: '9px 12px',
      background: tone === 'critical' ? 'rgba(196,94,94,.07)' : 'rgba(184,148,79,.09)',
      border: `1px solid ${color}33`, borderRadius: 9,
      fontFamily: SANS, fontSize: 11.5, lineHeight: 1.5, color: VIZ.inkSecondary,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }} aria-hidden>
        <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" />
      </svg>
      <span>{children}</span>
    </p>
  );
}
