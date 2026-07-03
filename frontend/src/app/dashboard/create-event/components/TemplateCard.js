'use client';

import React, { useState } from 'react';
import InvitationCard from '../../../components/templates/InvitationCard';

/* ═══════════════════════════════════════════════════════════════
   TemplateCard — compact gallery card for the template-picker grid.

   Renders the REAL InvitationCard art (tinted to the active preset)
   instead of a bespoke hand-animated hero per template key — every
   curated template, however many exist, gets an accurate on-brand
   preview automatically, with nothing to maintain when new ones
   are added.
   ═══════════════════════════════════════════════════════════════ */
export default function TemplateCard({ template, isSelected, onSelect, index, activePresetIndex, onPresetSelect }) {
  const [hovered, setHovered] = useState(false);
  const preset = template.presets[activePresetIndex || 0];
  const isCustom = template.key === 'custom';

  return (
    <div
      onClick={() => onSelect(template.key)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="tc-card"
      style={{
        position: 'relative', cursor: 'pointer',
        borderRadius: 18, overflow: 'hidden',
        background: '#FFFFFF',
        border: isSelected ? '2px solid #B8944F' : hovered ? '1.5px solid rgba(184,148,79,0.4)' : '1px solid rgba(184,148,79,0.14)',
        boxShadow: isSelected
          ? '0 16px 36px rgba(184,148,79,0.18), 0 6px 20px rgba(0,0,0,0.06)'
          : hovered ? '0 14px 34px rgba(0,0,0,0.10)' : '0 3px 14px rgba(0,0,0,0.04)',
        transform: hovered && !isSelected ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'border-color 0.3s, box-shadow 0.35s, transform 0.35s cubic-bezier(0.16,1,0.3,1)',
        animation: `tc-entrance 0.4s cubic-bezier(0.16,1,0.3,1) ${Math.min(index, 12) * 0.045}s both`,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Selected check badge */}
      {isSelected && (
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 10,
          width: 22, height: 22, borderRadius: '50%', background: '#B8944F',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(184,148,79,0.4)', animation: 'tc-pop 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
        </div>
      )}

      {/* Hero — the real card art on a soft wash of the preset's own background */}
      <div className="tc-hero" style={{ background: `linear-gradient(155deg, ${preset?.background || '#FAF8F5'} 0%, #FFFFFF 130%)` }}>
        {isCustom ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 24 }}>✨</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {['#8B7355', '#D4C5A9', '#475569', '#A0845C'].map(c => (
                <span key={c} style={{ width: 11, height: 11, borderRadius: 4, background: c, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="tc-card-art">
            <InvitationCard template={{ pattern: template.pattern }} theme={preset} />
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 14.5, fontWeight: 600, color: '#191B1E', margin: 0, lineHeight: 1.15 }}>{template.label}</h3>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: '#B8944F', background: 'rgba(184,148,79,0.1)', border: '1px solid rgba(184,148,79,0.2)',
            borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap',
          }}>{template.tier}</span>
        </div>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: 10.5, color: '#77736A', margin: 0, lineHeight: 1.4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{template.tagline}</p>

        <div style={{ marginTop: 'auto', paddingTop: 6 }}>
          {!isCustom ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {template.presets.map((p, pi) => (
                <div
                  key={pi}
                  onClick={(e) => { e.stopPropagation(); onSelect(template.key); onPresetSelect(template.key, pi); }}
                  title={p.name}
                  style={{
                    width: 14, height: 14, borderRadius: '50%', background: p.primary, cursor: 'pointer',
                    border: pi === (activePresetIndex || 0) ? '2px solid #B8944F' : '2px solid rgba(184,148,79,0.15)',
                    boxShadow: pi === (activePresetIndex || 0) ? '0 0 0 2px rgba(184,148,79,0.25)' : 'none',
                    transition: 'all 0.25s ease', transform: pi === (activePresetIndex || 0) ? 'scale(1.15)' : 'scale(1)',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          ) : (
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: '#B8944F', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              Open the visual builder
            </span>
          )}
        </div>
      </div>

      <style jsx>{`
        .tc-hero {
          height: 170px; display: flex; align-items: center; justify-content: center;
          position: relative; overflow: hidden;
        }
        .tc-card-art {
          width: 112px; aspect-ratio: 210 / 290; border-radius: 10px; overflow: hidden;
          box-shadow: 0 10px 26px -10px rgba(0,0,0,0.35);
          transition: transform 0.35s cubic-bezier(0.16,1,0.3,1);
        }
        .tc-card:hover .tc-card-art { transform: translateY(-2px) scale(1.03); }

        @keyframes tc-entrance { from { opacity: 0; transform: translateY(18px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes tc-pop { from { transform: scale(0); } to { transform: scale(1); } }

        @media (prefers-reduced-motion: reduce) {
          .tc-card { animation: none !important; }
          .tc-card-art { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
