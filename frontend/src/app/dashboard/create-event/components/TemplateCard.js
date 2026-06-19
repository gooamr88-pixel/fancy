'use client';

import React, { useState } from 'react';

/* ═══════════════════════════════════════════════════════════════
   TemplateCard — large, premium "choose a theme" card.

   Three bespoke visual treatments keyed off template.key:
     • engagement → soft romantic gradient, animated rings + particles
     • wedding    → dark cinematic glassmorphism with a gold shimmer sweep
     • custom     → light design-canvas with palette swatches & sliders
   ═══════════════════════════════════════════════════════════════ */

/* ─── The themed hero visual (left side of the card) ─── */
function HeroVisual({ tplKey, preset }) {
  if (tplKey === 'wedding') {
    return (
      <div className="tc-hero" style={{ background: 'linear-gradient(140deg,#0B0F19 0%,#161d2b 55%,#0d121f 100%)' }}>
        <div className="tc-shimmer" />
        {/* Gold corner brackets */}
        <span className="tc-bracket" style={{ top: 10, left: 10, borderTop: '1px solid #D7BE80', borderLeft: '1px solid #D7BE80' }} />
        <span className="tc-bracket" style={{ bottom: 10, right: 10, borderBottom: '1px solid #D7BE80', borderRight: '1px solid #D7BE80' }} />
        <div className="tc-glass" style={{ borderColor: 'rgba(215,190,128,0.4)' }}>
          <span style={{ fontSize: 26 }}>💍</span>
        </div>
      </div>
    );
  }
  if (tplKey === 'custom') {
    return (
      <div className="tc-hero" style={{ background: '#FAF8F5', backgroundImage: 'linear-gradient(rgba(139,115,85,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(139,115,85,0.06) 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 22 }}>✨</div>
          {/* palette swatches */}
          <div style={{ display: 'flex', gap: 5 }}>
            {['#8B7355', '#D4C5A9', '#475569', '#A0845C'].map(c => (
              <span key={c} style={{ width: 12, height: 12, borderRadius: 4, background: c, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
            ))}
          </div>
          {/* slider lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 54 }}>
            {[0.7, 0.45].map((w, i) => (
              <div key={i} style={{ height: 3, borderRadius: 2, background: 'rgba(139,115,85,0.15)', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${w * 100}%`, borderRadius: 2, background: '#8B7355' }} />
                <div style={{ position: 'absolute', left: `${w * 100}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 7, height: 7, borderRadius: '50%', background: '#fff', border: '1.5px solid #8B7355' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  // engagement (default)
  return (
    <div className="tc-hero" style={{ background: `linear-gradient(140deg, #FFF6EE 0%, #FCEBDF 60%, #F8DECB 100%)` }}>
      {/* floating particles */}
      {[0, 1, 2, 3, 4].map(i => <span key={i} className={`tc-particle tc-p${i}`} />)}
      {/* animated interlocking rings */}
      <svg width="74" height="50" viewBox="0 0 74 50" fill="none" style={{ position: 'relative', zIndex: 2 }}>
        <circle className="tc-ring tc-ring-a" cx="28" cy="25" r="15" stroke={preset?.primary || '#D4A574'} strokeWidth="2.5" />
        <circle className="tc-ring tc-ring-b" cx="46" cy="25" r="15" stroke={preset?.secondary || '#C5A059'} strokeWidth="2.5" />
        <circle cx="46" cy="11" r="2.4" fill={preset?.primary || '#D4A574'} className="tc-sparkle" />
      </svg>
    </div>
  );
}

export default function TemplateCard({ template, isSelected, onSelect, index, activePresetIndex, onPresetSelect }) {
  const [hovered, setHovered] = useState(false);
  const preset = template.presets[activePresetIndex || 0];

  return (
    <div
      onClick={() => onSelect(template.key)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="tc-card"
      style={{
        position: 'relative', cursor: 'pointer',
        borderRadius: 20, overflow: 'hidden',
        background: isSelected ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: isSelected ? '2px solid #B8944F' : hovered ? '1.5px solid rgba(184,148,79,0.4)' : '1px solid rgba(184,148,79,0.14)',
        boxShadow: isSelected
          ? '0 18px 40px rgba(184,148,79,0.16), 0 8px 32px rgba(0,0,0,0.06)'
          : hovered ? '0 16px 44px rgba(0,0,0,0.10)' : '0 4px 20px rgba(0,0,0,0.03)',
        transform: hovered && !isSelected ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'border-color 0.3s, box-shadow 0.35s, transform 0.35s cubic-bezier(0.16,1,0.3,1)',
        animation: `tc-entrance 0.5s cubic-bezier(0.16,1,0.3,1) ${index * 0.09}s both`,
        display: 'flex', alignItems: 'stretch',
      }}
    >
      {/* Selected check badge */}
      {isSelected && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          width: 24, height: 24, borderRadius: '50%', background: '#B8944F',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(184,148,79,0.4)', animation: 'tc-pop 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
        </div>
      )}

      <HeroVisual tplKey={template.key} preset={preset} />

      {/* Content */}
      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, color: '#191B1E', margin: 0, lineHeight: 1.15 }}>{template.label}</h3>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: '#B8944F', background: 'rgba(184,148,79,0.1)', border: '1px solid rgba(184,148,79,0.2)',
            borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap',
          }}>{template.tier}</span>
        </div>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: 11, color: '#77736A', margin: '2px 0 0', lineHeight: 1.45,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{template.desc}</p>

        {/* Preset dots (real templates only — custom uses the builder) */}
        {template.key !== 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
            {template.presets.map((p, pi) => (
              <div
                key={pi}
                onClick={(e) => { e.stopPropagation(); onSelect(template.key); onPresetSelect(template.key, pi); }}
                title={p.name}
                style={{
                  width: 15, height: 15, borderRadius: '50%', background: p.primary, cursor: 'pointer',
                  border: pi === (activePresetIndex || 0) ? '2px solid #B8944F' : '2px solid rgba(184,148,79,0.15)',
                  boxShadow: pi === (activePresetIndex || 0) ? '0 0 0 2px rgba(184,148,79,0.25)' : 'none',
                  transition: 'all 0.25s ease', transform: pi === (activePresetIndex || 0) ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, color: '#77736A', marginLeft: 2 }}>{preset.name}</span>
          </div>
        )}
        {template.key === 'custom' && (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: '#B8944F', fontWeight: 600, marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            Open the visual builder →
          </span>
        )}
      </div>

      <style jsx>{`
        .tc-card { min-height: 132px; }
        .tc-hero {
          width: 124px; flex-shrink: 0; position: relative; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
        }
        .tc-glass {
          width: 52px; height: 52px; border-radius: 14px; border: 1px solid;
          background: rgba(255,255,255,0.08); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; position: relative; z-index: 2;
        }
        .tc-bracket { position: absolute; width: 14px; height: 14px; }
        .tc-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(115deg, transparent 30%, rgba(215,190,128,0.35) 48%, rgba(255,245,210,0.15) 52%, transparent 70%);
          transform: translateX(-120%); animation: tc-sweep 3.4s ease-in-out infinite;
        }
        @keyframes tc-sweep { 0% { transform: translateX(-120%); } 55%,100% { transform: translateX(120%); } }

        .tc-ring { transform-origin: center; }
        .tc-ring-a { animation: tc-tilt 4s ease-in-out infinite; }
        .tc-ring-b { animation: tc-tilt 4s ease-in-out infinite reverse; }
        @keyframes tc-tilt { 0%,100% { transform: rotate(-6deg) translateY(0); } 50% { transform: rotate(6deg) translateY(-1.5px); } }
        .tc-sparkle { animation: tc-twinkle 1.8s ease-in-out infinite; transform-origin: center; }
        @keyframes tc-twinkle { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }

        .tc-particle {
          position: absolute; width: 5px; height: 5px; border-radius: 50%;
          background: radial-gradient(circle, rgba(212,165,116,0.7), rgba(212,165,116,0));
          bottom: -6px; animation: tc-rise linear infinite;
        }
        .tc-p0 { left: 18%; animation-duration: 5s; animation-delay: 0s; }
        .tc-p1 { left: 38%; animation-duration: 6.5s; animation-delay: 1.2s; }
        .tc-p2 { left: 58%; animation-duration: 5.5s; animation-delay: 0.6s; }
        .tc-p3 { left: 74%; animation-duration: 7s; animation-delay: 2s; }
        .tc-p4 { left: 88%; animation-duration: 6s; animation-delay: 0.3s; }
        @keyframes tc-rise { 0% { transform: translateY(0) scale(1); opacity: 0; } 15% { opacity: 1; } 90% { opacity: 0.8; } 100% { transform: translateY(-120px) scale(0.4); opacity: 0; } }

        @keyframes tc-entrance { from { opacity: 0; transform: translateY(26px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes tc-pop { from { transform: scale(0); } to { transform: scale(1); } }

        @media (max-width: 768px) {
          .tc-hero { width: 96px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tc-shimmer, .tc-ring-a, .tc-ring-b, .tc-sparkle, .tc-particle { animation: none !important; }
          .tc-shimmer { display: none; }
        }
      `}</style>
    </div>
  );
}
