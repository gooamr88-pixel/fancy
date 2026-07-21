'use client';

import React, { useState } from 'react';

/* Guest-experience chrome for the legacy continuous-scroll templates
   (corporate/birthday/gala and any other event.template_type outside
   FULL_PAGE_TEMPLATES) — window-scroll equivalents of the HeritageArch
   family's SnapShell chrome (heritageArch/shared.js), since this page
   scrolls natively on window/document rather than inside a container.
   Takes plain color strings instead of the useFullPageTheme() context
   HeritageArch uses, since this render path keeps its palette in plain
   local variables (customColors/themeColor), not a context provider. */

export function ScrollProgressBar({ progress = 0, color, reduceMotion }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '3px',
        background: `${color}26`, zIndex: 40, pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'relative', height: '100%', width: `${Math.min(100, Math.max(0, progress))}%`,
          background: color,
          transition: reduceMotion ? undefined : 'width 0.15s ease-out',
        }}
      >
        <span
          style={{
            position: 'absolute', top: '50%', right: 0,
            width: '8px', height: '8px', borderRadius: '50%',
            background: color, boxShadow: `0 0 0 3px ${color}30`,
            transform: 'translate(50%, -50%)',
          }}
        />
      </div>
    </div>
  );
}

export function DotNav({ sections, active, onSelect, color, isRTL }) {
  const [hovered, setHovered] = useState(null);
  if (!Array.isArray(sections) || sections.length === 0) return null;
  return (
    <div
      style={{
        position: 'fixed', top: '50%', transform: 'translateY(-50%)', zIndex: 40,
        ...(isRTL ? { left: '18px' } : { right: '18px' }),
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}
    >
      {sections.map((s, i) => (
        <div key={s.id} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => onSelect(s.id)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered((h) => (h === i ? null : h))}
            aria-label={s.label || `Go to section ${i + 1}`}
            aria-current={active === s.id ? 'true' : undefined}
            style={{
              width: active === s.id ? '10px' : '7px', height: active === s.id ? '10px' : '7px',
              borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
              background: active === s.id ? color : `${color}4D`,
              transition: 'all 0.25s ease',
            }}
          />
          {s.label && hovered === i && (
            <span
              role="tooltip"
              style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                ...(isRTL ? { left: 'calc(100% + 10px)' } : { right: 'calc(100% + 10px)' }),
                whiteSpace: 'nowrap', background: '#fff', color,
                fontFamily: 'var(--font-sans)', fontSize: '12px', padding: '5px 12px',
                borderRadius: '4px', boxShadow: '0 3px 10px rgba(0,0,0,0.15)', pointerEvents: 'none',
              }}
            >
              {s.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function FloatingCalendarButton({ event, isRTL, downloadIcs }) {
  if (!event?.event_date) return null;
  return (
    <button
      type="button"
      onClick={downloadIcs}
      aria-label={isRTL ? 'أضف إلى التقويم' : 'Add to calendar'}
      style={{
        // The bottom edge is already owned by the full-width floating RSVP
        // bar, so this sits in the top corner opposite the music toggle
        // (which is always on the right) instead of matching the
        // HeritageArch chrome's bottom placement.
        position: 'fixed', top: isRTL ? '76px' : '24px', left: '24px', zIndex: 30,
        width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer',
        border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        color: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.3s ease',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    </button>
  );
}

// Generic "scroll down" nudge shown once the invitation reveal is dismissed,
// fading out on the guest's first scroll (or after 5s, whichever comes
// first) — matches the reference invitation's ceremony-layer scroll hint,
// which HeritageArch's SnapShell already has an RSVP-focused equivalent of
// (ScrollToRsvpHint) but this continuous-scroll page had nothing like at all.
export function ScrollHint({ visible, isRTL, color }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', bottom: '26px', left: '50%', transform: 'translateX(-50%)', zIndex: 40,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
        color, fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        opacity: visible ? 0.9 : 0, pointerEvents: 'none',
        transition: 'opacity 0.6s ease',
      }}
    >
      <span>{isRTL ? 'مرر للأسفل' : 'Scroll'}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: visible ? 'legacyScrollHintBounce 1.8s ease-in-out infinite' : 'none' }}>
        <path d="M6 9l6 6 6-6" />
      </svg>
      <style>{'@keyframes legacyScrollHintBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }'}</style>
    </div>
  );
}
