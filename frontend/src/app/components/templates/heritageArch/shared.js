'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { alpha } from '../../../utils/color';
import { useFullPageTheme } from './theme';

/* Shared visual language for every full-page section: the palette comes from
   useFullPageTheme() (Heritage Arch's cream/burgundy by default, or the
   event's own derived palette), serif headings, and the small chrome pieces
   (lang pill, music toggle, scroll-to-rsvp hint) repeated across sections. */

export const SECTION_PADDING = 'clamp(24px, 6vw, 64px)';

export function SectionShell({ children, background, style = {}, center = true }) {
  const C = useFullPageTheme();
  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: center ? 'center' : 'stretch',
        justifyContent: 'center',
        position: 'relative',
        background: background || C.background,
        padding: `96px ${SECTION_PADDING} 80px`,
        boxSizing: 'border-box',
        fontFamily: 'var(--font-sans)',
        color: C.ink,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionHeading({ children, subtitle, isRTL, style = {} }) {
  const C = useFullPageTheme();
  return (
    <div style={{ textAlign: 'center', marginBottom: '20px', ...style }}>
      <h2 style={{
        fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 600,
        fontSize: 'clamp(28px, 5vw, 44px)', color: C.maroon, margin: 0, letterSpacing: '0.01em',
      }}>
        {children}
      </h2>
      {subtitle && (
        <p style={{ marginTop: '10px', fontSize: '15px', color: C.ink, opacity: 0.75 }}>{subtitle}</p>
      )}
    </div>
  );
}

export function DiamondDivider({ color }) {
  const C = useFullPageTheme();
  const c = color || C.gold;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: '18px 0' }} aria-hidden="true">
      <span style={{ width: '48px', height: '1px', background: c, opacity: 0.6 }} />
      <span style={{ width: '7px', height: '7px', background: c, transform: 'rotate(45deg)', display: 'inline-block' }} />
      <span style={{ width: '48px', height: '1px', background: c, opacity: 0.6 }} />
    </div>
  );
}

export function DayTabs({ value, onChange, isRTL, dayLabels }) {
  const C = useFullPageTheme();
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '36px' }}>
      {['day1', 'day2'].map((d, i) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          style={{
            padding: '10px 22px', borderRadius: '999px', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-serif)', fontSize: '15px',
            background: value === d ? C.paper : 'transparent',
            color: C.maroon, fontWeight: value === d ? 700 : 500,
            transition: 'background 0.25s ease',
          }}
        >
          {dayLabels?.[i] || (d === 'day1' ? (isRTL ? 'اليوم الأول' : 'Day 1') : (isRTL ? 'اليوم الثاني' : 'Day 2'))}
        </button>
      ))}
    </div>
  );
}

// Bobbing "scroll to RSVP" hint repeated at the bottom of every section
// (matches the reference exactly: same label + mouse icon on every screen,
// always scrolling to the RSVP form rather than just the next section).
export function ScrollToRsvpHint({ isRTL, label, color }) {
  const C = useFullPageTheme();
  const c = color || C.maroon;
  const scroll = () => {
    const el = document.getElementById('ha-rsvp');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <button
      type="button"
      onClick={scroll}
      style={{
        position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
        background: 'none', border: 'none', cursor: 'pointer', color: c,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em' }}>
        {label || (isRTL ? 'مرر للأسفل لتأكيد الحضور' : 'SCROLL TO RSVP')}
      </span>
      <motion.span
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ display: 'flex' }}
        aria-hidden="true"
      >
        <svg width="22" height="34" viewBox="0 0 22 34" fill="none">
          <rect x="1" y="1" width="20" height="32" rx="10" stroke={c} strokeWidth="1.5" />
          <circle cx="11" cy="10" r="2.4" fill={c} />
        </svg>
      </motion.span>
    </button>
  );
}

const FLAG_GB = (
  <svg width="20" height="14" viewBox="0 0 60 42" style={{ borderRadius: '2px' }}>
    <rect width="60" height="42" fill="#00247d" />
    <path d="M0 0L60 42M60 0L0 42" stroke="#fff" strokeWidth="6" />
    <path d="M0 0L60 42M60 0L0 42" stroke="#cf142b" strokeWidth="3" />
    <path d="M30 0V42M0 21H60" stroke="#fff" strokeWidth="10" />
    <path d="M30 0V42M0 21H60" stroke="#cf142b" strokeWidth="6" />
  </svg>
);
const FLAG_EG = (
  <svg width="20" height="14" viewBox="0 0 60 42" style={{ borderRadius: '2px' }}>
    <rect width="60" height="14" y="0" fill="#ce1126" />
    <rect width="60" height="14" y="14" fill="#fff" />
    <rect width="60" height="14" y="28" fill="#000" />
  </svg>
);

export function LangPill({ lang, setLang, isRTL }) {
  const C = useFullPageTheme();
  return (
    <div
      className="ha-lang-pill"
      style={{
        position: 'fixed', top: '24px', zIndex: 20,
        ...(isRTL ? { left: '24px' } : { right: '24px' }),
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        border: `1px solid ${C.border}`, borderRadius: '999px', padding: '8px 14px',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.maroon} strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M2.5 12h19M12 2.5c2.5 2.7 3.9 6 3.9 9.5s-1.4 6.8-3.9 9.5c-2.5-2.7-3.9-6-3.9-9.5S9.5 5.2 12 2.5z" />
      </svg>
      <button
        type="button"
        onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
        aria-label={lang === 'en' ? 'Switch to Arabic' : 'Switch to English'}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: 'var(--font-serif)', fontSize: '13px', fontWeight: 700, color: C.maroon,
        }}
      >
        <span style={{ display: 'flex' }}>{lang === 'en' ? FLAG_GB : FLAG_EG}</span>
        {lang === 'en' ? 'EN' : 'AR'}
      </button>
    </div>
  );
}

export function MusicToggle({ playing, onToggle, isRTL }) {
  const C = useFullPageTheme();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? 'Pause music' : 'Play music'}
      style={{
        position: 'fixed', bottom: '24px', zIndex: 20,
        ...(isRTL ? { left: '24px' } : { right: '24px' }),
        width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer',
        border: `1px solid ${C.border}`, background: 'rgba(30,20,18,0.85)',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {playing ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z" /><path d="M16.5 12c0-1.77-1-3.29-2.5-4.03v8.06c1.5-.74 2.5-2.26 2.5-4.03z" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z" /><path d="M16.5 12L19 9.5M19 9.5L21.5 7M19 9.5L16.5 7M19 9.5L21.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
      )}
    </button>
  );
}

export function DotNav({ count, active, onSelect, isRTL }) {
  const C = useFullPageTheme();
  return (
    <div
      style={{
        position: 'fixed', top: '50%', transform: 'translateY(-50%)', zIndex: 20,
        ...(isRTL ? { left: '18px' } : { right: '18px' }),
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Go to section ${i + 1}`}
          style={{
            width: active === i ? '10px' : '7px', height: active === i ? '10px' : '7px',
            borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
            background: active === i ? C.maroon : alpha(C.maroon, 0.3),
            transition: 'all 0.25s ease',
          }}
        />
      ))}
    </div>
  );
}

export const ICONS = {
  plate: '🍽️',
  rings: '💍',
  ornament: '🎊',
  watch: '⏰',
  clock: '🕯️',
};

// A gently zig-zagging stem with small leaf pairs at each bend — replaces a
// plain center line down the schedule timeline. Decorative only (not to
// scale), so a little vertical stretch from filling the timeline's actual
// height is an acceptable trade-off for not hand-tracing per-viewport paths.
export function VineLine({ itemCount, color }) {
  const C = useFullPageTheme();
  const c = color || C.gold;
  const bends = Math.max(1, itemCount);
  const unit = 100;
  let d = 'M 20 0';
  const leaves = [];
  for (let i = 0; i < bends; i++) {
    const y0 = i * unit;
    const y1 = y0 + unit;
    const dir = i % 2 === 0 ? 1 : -1;
    const midY = y0 + unit / 2;
    const midX = 20 + dir * 11;
    d += ` Q ${midX} ${midY} 20 ${y1}`;
    leaves.push({ x: midX, y: midY, dir });
  }
  return (
    <svg
      viewBox={`0 0 40 ${bends * unit}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ position: 'absolute', left: '50%', top: 0, height: '100%', width: '40px', transform: 'translateX(-50%)' }}
    >
      <path d={d} stroke={c} strokeWidth="1.6" fill="none" opacity="0.5" vectorEffect="non-scaling-stroke" />
      {leaves.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.dir * 25})`}>
          <ellipse cx={p.dir * 5} cy="0" rx="6" ry="2.6" fill={c} opacity="0.5" />
          <ellipse cx={p.dir * 10} cy="1.5" rx="4.4" ry="2" fill={c} opacity="0.35" />
        </g>
      ))}
    </svg>
  );
}

export function MapEmbed({ lat, lng, address, height = '300px' }) {
  const C = useFullPageTheme();
  const hasCoords = lat != null && lng != null;
  const query = hasCoords ? `${lat},${lng}` : encodeURIComponent(address || '');
  const src = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    ? `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${query}&zoom=14`
    : `https://maps.google.com/maps?q=${query}&t=&z=14&ie=UTF8&iwloc=&output=embed`;
  return (
    <div style={{ width: '100%', height, borderRadius: '16px', overflow: 'hidden', border: `1px solid ${C.border}` }}>
      <iframe
        title={address || 'Venue map'}
        width="100%" height="100%" style={{ border: 0 }}
        loading="lazy" referrerPolicy="no-referrer-when-downgrade"
        src={src}
      />
    </div>
  );
}

export function getDirectionsUrl(lat, lng, address) {
  const destination = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(address || '');
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}
