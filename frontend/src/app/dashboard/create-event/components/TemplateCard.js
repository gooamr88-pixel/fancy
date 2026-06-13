'use client';

import React, { useState } from 'react';

export default function TemplateCard({ template, isSelected, onSelect, index, activePresetIndex, onPresetSelect }) {
  const [hovered, setHovered] = useState(false);
  const preset = template.presets[activePresetIndex || 0];

  return (
    <div
      onClick={() => onSelect(template.key)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', cursor: 'pointer',
        borderRadius: 18, overflow: 'hidden',
        aspectRatio: '1 / 1.3',
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: isSelected
          ? '2px solid #B8944F'
          : hovered
            ? '1.5px solid rgba(184,148,79,0.4)'
            : '1px solid rgba(255,255,255,0.08)',
        boxShadow: isSelected
          ? '0 0 30px rgba(184,148,79,0.2), 0 8px 32px rgba(0,0,0,0.3)'
          : hovered
            ? '0 12px 40px rgba(0,0,0,0.3)'
            : '0 4px 20px rgba(0,0,0,0.2)',
        transform: hovered && !isSelected ? 'scale(1.03) translateY(-4px)' : 'scale(1)',
        transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        animation: `ce-cardEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.08}s both`,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* ─── Selected Badge ─── */}
      {isSelected && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          width: 26, height: 26, borderRadius: '50%',
          background: '#B8944F',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(184,148,79,0.4)',
          animation: 'ce-scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7"/>
          </svg>
        </div>
      )}

      {/* ─── Gradient Banner (40%) ─── */}
      <div style={{
        height: '40%', minHeight: 90,
        background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary || preset.primary}88)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          {template.icon}
        </div>
      </div>

      {/* ─── Content Area (60%) ─── */}
      <div style={{
        flex: 1, padding: '16px 18px 14px',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
        <div>
          <h3 style={{
            fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 600,
            color: '#FFFFFF', margin: 0, lineHeight: 1.2,
          }}>{template.label}</h3>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 11,
            color: 'rgba(255,255,255,0.5)', margin: '6px 0 0',
            lineHeight: 1.4, display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{template.desc}</p>
        </div>

        {/* ─── Preset Dots ─── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 10,
        }}>
          {template.presets.map((p, pi) => (
            <div
              key={pi}
              onClick={(e) => { e.stopPropagation(); onPresetSelect(template.key, pi); }}
              title={p.name}
              style={{
                width: 16, height: 16, borderRadius: '50%',
                background: p.primary, cursor: 'pointer',
                border: pi === (activePresetIndex || 0)
                  ? '2px solid #B8944F'
                  : '2px solid rgba(255,255,255,0.15)',
                boxShadow: pi === (activePresetIndex || 0)
                  ? '0 0 0 2px rgba(184,148,79,0.3)'
                  : 'none',
                transition: 'all 0.25s ease',
                transform: pi === (activePresetIndex || 0) ? 'scale(1.15)' : 'scale(1)',
              }}
            />
          ))}
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 9,
            color: 'rgba(255,255,255,0.35)', marginLeft: 4,
            letterSpacing: '0.03em',
          }}>{preset.name}</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes ce-cardEntrance {
          from { opacity: 0; transform: translateY(40px) scale(0.94); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ce-scaleIn {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
