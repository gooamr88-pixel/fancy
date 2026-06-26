'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import MobilePreview from '../../../../app/components/templates/MobilePreview';

/* Logical device size — increased for better content visibility.
   The frame is always rendered at this exact pixel size and then
   uniformly scaled to fit its column — so the preview content
   never reflows or re-wraps; it only scales. */
const BASE_W = 320;
const BASE_H = 650;

/* ═══ Fit-to-width scale hook (ResizeObserver, SSR-safe) ═══ */
function useFitScale(baseWidth, maxScale = 1) {
  const ref = useRef(null);
  const [scale, setScale] = useState(maxScale);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(maxScale, w / baseWidth));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseWidth, maxScale]);
  return [ref, scale];
}

/* ═══ RSVP flow simulator stepper ═══ */
const FLOW_STEPS = [
  { key: 'received', label: 'Receive' },
  { key: 'envelope', label: 'Open' },
  { key: 'opened', label: 'Details' },
  { key: 'attending', label: 'Attending' },
  { key: 'declined', label: 'Decline' },
];

function FlowStepper({ step, onSelect, compact }) {
  return (
    <div
      className="ps-stepper"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.7)',
        border: '1px solid rgba(184,148,79,0.18)',
        borderRadius: 999, padding: 4,
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        overflowX: compact ? 'auto' : 'visible',
        scrollbarWidth: 'none', maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      {FLOW_STEPS.map((s, i) => {
        const active = s.key === step;
        return (
          <button
            key={s.key}
            onClick={() => onSelect(s.key)}
            style={{
              flex: '0 0 auto',
              display: 'flex', alignItems: 'center', gap: 5,
              padding: compact ? '6px 9px' : '6px 11px',
              borderRadius: 999, border: 'none', cursor: 'pointer',
              background: active ? 'linear-gradient(135deg,#B8944F,#a6833f)' : 'transparent',
              color: active ? '#fff' : '#77736A',
              fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 700,
              letterSpacing: '0.02em',
              boxShadow: active ? '0 2px 8px rgba(184,148,79,0.35)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
              WebkitTapHighlightColor: 'transparent', whiteSpace: 'nowrap',
            }}
          >
            <span style={{
              width: 15, height: 15, borderRadius: '50%',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: active ? 'rgba(255,255,255,0.25)' : 'rgba(184,148,79,0.12)',
              color: active ? '#fff' : '#B8944F', fontSize: 8.5, fontWeight: 800,
            }}>{i + 1}</span>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export default function PhoneSimulator({ template, theme, guestName, onGuestNameChange, config, isMobile = false }) {
  // The journey starts at the closed envelope. A fresh template layout resets
  // it because Stage1 remounts this component via `key={templateType}`.
  const [step, setStep] = useState('opened');
  const [wrapRef, scale] = useFitScale(BASE_W, 1);

  const handleSelect = useCallback((key) => setStep(key), []);

  /* Derive accent for ambient glow */
  const accentColor = theme?.primary || template?.accent || '#B8944F';

  /* The phone frame, rendered at fixed logical size then scaled */
  const frame = (
    <div style={{ width: BASE_W * scale, height: BASE_H * scale }}>
      <div style={{ width: BASE_W, height: BASE_H, transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        <div style={{
          width: BASE_W, height: BASE_H,
          background: '#111111', borderRadius: 46, padding: 8,
          boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 25px 70px rgba(0,0,0,0.25), 0 10px 30px rgba(0,0,0,0.15), 0 0 60px ${accentColor}08`,
          position: 'relative', boxSizing: 'border-box',
        }}>
          {/* Dynamic Island */}
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            width: 100, height: 28, borderRadius: 16, background: '#000', zIndex: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: 'inset 0 0 2px rgba(255,255,255,0.05)',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a1a2e', border: '1.5px solid #2a2a3e' }} />
            <div style={{ width: 32, height: 3, borderRadius: 2, background: '#1a1a2e' }} />
          </div>

          {/* Glass reflection overlay */}
          <div style={{
            position: 'absolute', inset: 10, borderRadius: 38, zIndex: 55,
            pointerEvents: 'none', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(160deg, rgba(255,255,255,0.08) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.03) 100%)',
              mixBlendMode: 'overlay',
            }} />
          </div>

          {/* Screen */}
          <div style={{
            width: '100%', height: '100%', borderRadius: 38, overflow: 'hidden',
            border: '0.5px solid rgba(255,255,255,0.05)',
            background: '#000', position: 'relative', display: 'flex', flexDirection: 'column',
          }}>
            <MobilePreview
              template={template}
              theme={theme}
              guestName={guestName}
              config={config}
              isBare={true}
              step={step}
              onStepChange={setStep}
            />
          </div>

          {/* Home indicator */}
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            width: 96, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', zIndex: 60,
          }} />
        </div>
      </div>
    </div>
  );

  /* ═══ MOBILE: immersive ═══ */
  if (isMobile) {
    return (
      <div className="ce-phone" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 10 }}>
        <div ref={wrapRef} style={{ width: '100%', maxWidth: 320, display: 'flex', justifyContent: 'center' }}>
          {frame}
        </div>
        <FlowStepper step={step} onSelect={handleSelect} compact />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B9B6D', animation: 'ps-blink 2s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: '#77736A', letterSpacing: '0.04em' }}>Walk through the full guest journey</span>
        </div>
        <style jsx>{`@keyframes ps-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  /* ═══ DESKTOP: sticky panel ═══ */
  return (
    <div className="ce-phone-container">
      <div ref={wrapRef} style={{ width: '100%', maxWidth: BASE_W, display: 'flex', justifyContent: 'center' }}>
        {frame}
      </div>

      {/* Label */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3B9B6D', animation: 'ps-blink 2s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: '#191B1E', letterSpacing: '0.03em' }}>Live Guest Journey</span>
        </div>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: '#77736A' }}>Step through what your guests will experience</span>
      </div>

      {/* RSVP flow stepper */}
      <FlowStepper step={step} onSelect={handleSelect} />

      {/* Guest name control */}
      <div style={{
        width: '100%', maxWidth: BASE_W, background: 'rgba(255,255,255,0.8)',
        border: '1px solid rgba(184,148,79,0.15)', borderRadius: 16, padding: '12px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: 6, boxSizing: 'border-box',
      }}>
        <label style={{ fontSize: 9, fontWeight: 700, color: '#77736A', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-sans)' }}>Customize Guest Name (Simulator Only)</label>
        <input
          type="text"
          value={guestName || ''}
          onChange={e => onGuestNameChange(e.target.value)}
          placeholder="e.g. Sarah & John"
          style={{
            width: '100%', boxSizing: 'border-box', background: '#FFFFFF', border: '1px solid #E8E2D6',
            borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#191B1E', outline: 'none', fontFamily: 'var(--font-sans)',
            transition: 'border-color 0.25s, box-shadow 0.25s',
          }}
          onFocus={e => { e.target.style.borderColor = '#B8944F'; e.target.style.boxShadow = '0 0 0 3px rgba(184,148,79,0.08)'; }}
          onBlur={e => { e.target.style.borderColor = '#E8E2D6'; e.target.style.boxShadow = 'none'; }}
        />
      </div>

      <style jsx>{`
        .ce-phone-container {
          position: sticky; top: 32px;
          display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%;
        }
        @keyframes ps-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
