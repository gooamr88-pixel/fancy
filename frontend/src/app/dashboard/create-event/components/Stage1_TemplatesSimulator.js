'use client';
 
import React, { useMemo, useState } from 'react';
import TemplateCard from './TemplateCard';
import PhoneSimulator from './PhoneSimulator';
 
/* ═══ Template → MobilePreview pattern mapping ═══ */
const TEMPLATE_PREVIEW_MAP = {
  wedding:    { name: 'Timeless Elegance', pattern: 'serif',   accent: '#B8944F' },
  engagement: { name: 'Grand Affair',     pattern: 'luxury',  accent: '#D4A574' },
  corporate:  { name: 'Urban Edge',       pattern: 'geo',     accent: '#3B82F6' },
  birthday:   { name: 'Garden Party',     pattern: 'floral',  accent: '#E88FAC' },
  gala:       { name: 'Pure & Simple',    pattern: 'minimal', accent: '#C5A059' },
  custom:     { name: 'Woodland Romance', pattern: 'organic', accent: '#8B7355' },
};
 
/* ═══ Envelope lining gradient mapping ═══ */
function getLiningGradId(templateKey, presetIndex) {
  if (templateKey === 'wedding') {
    return ['goldGrad', 'emeraldGrad', 'burgundyGrad'][presetIndex] || 'goldGrad';
  }
  if (templateKey === 'gala') {
    return ['goldGrad', 'burgundyGrad', 'goldGrad'][presetIndex] || 'goldGrad';
  }
  return 'goldGrad';
}
 
/* ═══ Floating Champagne Shimmers ═══ */
function FloatingParticles() {
  const [particles, setParticles] = useState([]);
  React.useEffect(() => {
    setParticles(
      Array.from({ length: 15 }, (_, i) => ({
        id: i,
        size: 4 + Math.random() * 6,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 12}s`,
        duration: `${14 + Math.random() * 8}s`,
        opacity: 0.15 + Math.random() * 0.2,
      }))
    );
  }, []);
 
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      pointerEvents: 'none', zIndex: 0,
    }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          bottom: '-20px',
          left: p.left,
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(184,148,79,${p.opacity}) 0%, rgba(215,190,128,0) 70%)`,
          animation: `s1-float ${p.duration} ${p.delay} linear infinite`,
        }} />
      ))}
    </div>
  );
}
 
export default function Stage1_TemplatesSimulator({
  templates, templateType, onTemplateSelect,
  selectedPresets, onPresetSelect, activePresetColors, onNext,
}) {
  const activeTemplate = templates.find(t => t.key === templateType) || templates[0];
  const presetIdx = selectedPresets[templateType] || 0;
  
  /* Dynamic guest name state for simulator preview */
  const [guestName, setGuestName] = useState('Sarah & John');
 
  /* Build props for PhoneSimulator */
  const previewMap = TEMPLATE_PREVIEW_MAP[templateType] || TEMPLATE_PREVIEW_MAP.wedding;
  const simulatorTemplate = {
    name: previewMap.name,
    pattern: previewMap.pattern,
    accent: previewMap.accent,
  };
  const simulatorTheme = {
    id: (activePresetColors?.name || 'default').toLowerCase().replace(/\s+/g, '-'),
    primary: activePresetColors?.primary || '#B8944F',
    secondary: activePresetColors?.secondary || '#D7BE80',
    accent: activePresetColors?.accent || activePresetColors?.primary || '#B8944F',
    liningGradId: getLiningGradId(templateType, presetIdx),
  };
 
  return (
    <div style={{
      position: 'relative', minHeight: 'calc(100vh - 60px)',
      background: 'linear-gradient(135deg, #FAF8F5 0%, #FCFBF9 50%, #F5F3EF 100%)',
      padding: '48px 24px 80px',
      overflow: 'hidden',
    }}>
      <FloatingParticles />
 
      {/* Radial champagne glow overlay */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '80%', height: '60%',
        background: 'radial-gradient(ellipse, rgba(184,148,79,0.05) 0%, transparent 60%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
 
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto' }}>
        {/* ═══ HEADER ═══ */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(184,148,79,0.06)',
            border: '1px solid rgba(184,148,79,0.15)',
            borderRadius: 20, padding: '5px 14px',
            marginBottom: 16,
          }}>
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 11,
              color: '#B8944F', fontWeight: 600,
              letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>Step 1 of 3</span>
          </div>
 
          <h1 style={{ margin: 0, lineHeight: 1.2 }}>
            <span style={{
              fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px, 4vw, 36px)',
              color: '#191B1E', fontWeight: 600,
            }}>Choose Your </span>
            <span style={{
              fontFamily: 'var(--font-script)',
              fontSize: 'clamp(32px, 5vw, 46px)',
              color: '#B8944F',
            }}>Fancy</span>
            <span style={{
              fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px, 4vw, 36px)',
              color: '#191B1E', fontWeight: 600,
            }}> Template</span>
          </h1>
 
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 14,
            color: '#77736A', marginTop: 12,
            maxWidth: 480, margin: '12px auto 0',
            lineHeight: 1.5,
          }}>
            Select a premium invitation template and preview the live experience your guests will see
          </p>
        </div>
 
        {/* ═══ SPLIT PANE ═══ */}
        <div className="s1-split" style={{
          display: 'grid', gridTemplateColumns: '1.2fr 0.8fr',
          gap: 48, alignItems: 'start',
        }}>
          {/* ─── LEFT: Template Gallery ─── */}
          <div>
            <div className="s1-grid" style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
            }}>
              {templates.map((tpl, i) => (
                <TemplateCard
                  key={tpl.key}
                  template={tpl}
                  isSelected={templateType === tpl.key}
                  onSelect={onTemplateSelect}
                  index={i}
                  activePresetIndex={selectedPresets[tpl.key] || 0}
                  onPresetSelect={onPresetSelect}
                />
              ))}
            </div>
 
            {/* Specs */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8,
              marginTop: 24, padding: '0 4px',
            }}>
              {activeTemplate.specs.map((spec, i) => (
                <span key={i} style={{
                  fontFamily: 'var(--font-sans)', fontSize: 11,
                  color: '#77736A',
                  background: 'rgba(184,148,79,0.04)',
                  border: '1px solid rgba(184,148,79,0.12)',
                  borderRadius: 6, padding: '5px 10px',
                  fontWeight: 500,
                }}>✦ {spec}</span>
              ))}
            </div>
 
            {/* Default Form Fields */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6,
              marginTop: 12, padding: '0 4px',
            }}>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: 10,
                color: '#77736A', textTransform: 'uppercase',
                letterSpacing: '0.06em', fontWeight: 600,
                marginRight: 4, alignSelf: 'center',
              }}>Includes:</span>
              {activeTemplate.fields.map((f, i) => (
                <span key={i} style={{
                  fontFamily: 'var(--font-sans)', fontSize: 10,
                  color: '#191B1E',
                  background: 'rgba(25,27,30,0.04)',
                  border: '1px solid rgba(25,27,30,0.08)',
                  borderRadius: 4, padding: '3px 8px',
                  fontWeight: 600,
                }}>{f}</span>
              ))}
            </div>
 
            {/* CTA Button */}
            <button
              onClick={onNext}
              style={{
                marginTop: 32, width: '100%', height: 52,
                background: 'linear-gradient(135deg, #B8944F, #a6833f)',
                color: '#FFFFFF', border: 'none', borderRadius: 14,
                fontFamily: 'var(--font-sans)', fontSize: 14,
                fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
                transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                boxShadow: '0 4px 16px rgba(184,148,79,0.3)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(184,148,79,0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(184,148,79,0.3)';
              }}
            >
              Continue to Configuration
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
 
          {/* ─── RIGHT: Phone Simulator ─── */}
          <div className="s1-phone">
            <PhoneSimulator
              key={`${templateType}-${presetIdx}`}
              template={simulatorTemplate}
              theme={simulatorTheme}
              guestName={guestName}
              onGuestNameChange={setGuestName}
            />
          </div>
        </div>
      </div>
 
      <style jsx>{`
        @keyframes s1-float {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) scale(0.4); opacity: 0; }
        }
        @media (max-width: 1024px) {
          .s1-split { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
        }
        @media (max-width: 768px) {
          .s1-split { grid-template-columns: 1fr !important; }
          .s1-phone { order: -1; display: flex; justify-content: center; width: 100%; margin-bottom: 12px; }
          .s1-phone > :global(div) { position: static !important; }
          .s1-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .s1-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
