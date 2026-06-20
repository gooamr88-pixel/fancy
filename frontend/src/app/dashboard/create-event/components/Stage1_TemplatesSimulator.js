'use client';

import React, { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import TemplateCard from './TemplateCard';
import PhoneSimulator from './PhoneSimulator';
import CustomBuilder from './CustomBuilder';

/* ═══ Media-query hook (SSR-safe, no setState-in-effect) ═══ */
const MOBILE_QUERY = '(max-width: 768px)';
function subscribeMobile(callback) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}
function getMobileSnapshot() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;
}
function useIsMobile() {
  return useSyncExternalStore(subscribeMobile, getMobileSnapshot, () => false);
}

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

/* Deterministic pseudo-random so SSR and client markup match exactly (no hydration mismatch, no effect) */
function pseudoRandom(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
const SHIMMER_PARTICLES = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  size: 4 + pseudoRandom(i + 1) * 6,
  left: `${pseudoRandom(i + 2) * 100}%`,
  delay: `${pseudoRandom(i + 3) * 12}s`,
  duration: `${14 + pseudoRandom(i + 4) * 8}s`,
  opacity: 0.15 + pseudoRandom(i + 5) * 0.2,
}));

/* ═══ Floating Champagne Shimmers ═══ */
function FloatingParticles() {
  const particles = SHIMMER_PARTICLES;

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

/* ═══ Mobile Template Chip (horizontal carousel item) ═══ */
function MobileTemplateChip({ template, isSelected, onSelect, preset }) {
  return (
    <button
      onClick={() => onSelect(template.key)}
      style={{
        flex: '0 0 auto',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px 10px 10px',
        borderRadius: 16,
        border: isSelected ? '2px solid #B8944F' : '1.5px solid rgba(184,148,79,0.15)',
        background: isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        boxShadow: isSelected
          ? '0 4px 20px rgba(184,148,79,0.15), 0 2px 8px rgba(0,0,0,0.04)'
          : '0 2px 8px rgba(0,0,0,0.03)',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
        WebkitTapHighlightColor: 'transparent',
        minWidth: 0,
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary || preset.primary}88)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20,
      }}>
        {template.icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
        <span style={{
          fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 600,
          color: isSelected ? '#191B1E' : '#555',
          whiteSpace: 'nowrap',
        }}>{template.label}</span>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 10,
          color: '#99958D', whiteSpace: 'nowrap',
        }}>{template.presets.length} color{template.presets.length > 1 ? 's' : ''}</span>
      </div>
      {isSelected && (
        <div style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          background: '#B8944F', marginLeft: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7"/>
          </svg>
        </div>
      )}
    </button>
  );
}

/* ═══ Mobile Preset Selector Row ═══ */
function MobilePresetRow({ template, activePresetIndex, onPresetSelect }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: '8px 0',
    }}>
      {template.presets.map((p, pi) => (
        <button
          key={pi}
          onClick={() => onPresetSelect(template.key, pi)}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: p.primary, cursor: 'pointer', border: 'none',
            outline: pi === activePresetIndex ? '2.5px solid #B8944F' : '2px solid rgba(255,255,255,0.5)',
            outlineOffset: 2,
            boxShadow: pi === activePresetIndex
              ? '0 0 0 4px rgba(184,148,79,0.2), 0 2px 8px rgba(0,0,0,0.15)'
              : '0 2px 6px rgba(0,0,0,0.12)',
            transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
            transform: pi === activePresetIndex ? 'scale(1.15)' : 'scale(1)',
            WebkitTapHighlightColor: 'transparent',
          }}
          aria-label={p.name}
        />
      ))}
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 11,
        color: '#77736A', fontWeight: 500,
        marginLeft: 2,
      }}>{template.presets[activePresetIndex]?.name}</span>
    </div>
  );
}

export default function Stage1_TemplatesSimulator({
  templates, templateType, onTemplateSelect,
  selectedPresets, onPresetSelect, activePresetColors,
  customConfig, onCustomConfigChange, onNext,
}) {
  const isCustom = templateType === 'custom';
  const activeTemplate = templates.find(t => t.key === templateType) || templates[0];
  const presetIdx = selectedPresets[templateType] || 0;
  const carouselRef = useRef(null);
  const isMobile = useIsMobile();

  /* Scroll selected chip into view */
  useEffect(() => {
    if (!isMobile || !carouselRef.current) return;
    const idx = templates.findIndex(t => t.key === templateType);
    const chip = carouselRef.current.children[idx];
    if (chip) chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [templateType, isMobile, templates]);

  /* Dynamic guest name state for simulator preview */
  const [guestName, setGuestName] = useState('Sarah & John');

  /* Build props for PhoneSimulator. The Custom template renders the editable
     `custom` pattern driven entirely by the live builder config; the others
     map to a curated preview pattern + the selected preset swatch. */
  const previewMap = TEMPLATE_PREVIEW_MAP[templateType] || TEMPLATE_PREVIEW_MAP.wedding;
  const simulatorTemplate = isCustom
    ? { name: 'Custom', pattern: 'custom', accent: customConfig?.accent || '#8B7355' }
    : { name: previewMap.name, pattern: previewMap.pattern, accent: previewMap.accent };
  const simulatorTheme = isCustom
    ? {
        id: 'custom',
        primary: customConfig?.primary || '#8B7355',
        secondary: customConfig?.secondary || '#D4C5A9',
        accent: customConfig?.accent || customConfig?.primary || '#8B7355',
        liningGradId: 'goldGrad',
      }
    : {
        id: (activePresetColors?.name || 'default').toLowerCase().replace(/\s+/g, '-'),
        primary: activePresetColors?.primary || '#B8944F',
        secondary: activePresetColors?.secondary || '#D7BE80',
        accent: activePresetColors?.accent || activePresetColors?.primary || '#B8944F',
        liningGradId: getLiningGradId(templateType, presetIdx),
      };
  /* config only applies to the Custom template (CTA label, sections, fonts…) */
  const simulatorConfig = isCustom ? customConfig : undefined;

  return (
    <div style={{
      position: 'relative', minHeight: 'calc(100vh - 60px)',
      background: 'linear-gradient(135deg, #FAF8F5 0%, #FCFBF9 50%, #F5F3EF 100%)',
      overflow: 'hidden',
    }} className="s1-root">
      <FloatingParticles />

      {/* Radial champagne glow overlay */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '80%', height: '60%',
        background: 'radial-gradient(ellipse, rgba(184,148,79,0.05) 0%, transparent 60%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto' }} className="s1-inner">
        {/* ═══ HEADER ═══ */}
        <div style={{ textAlign: 'center' }} className="s1-header">
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

          <p className="s1-subtitle" style={{
            fontFamily: 'var(--font-sans)', fontSize: 14,
            color: '#77736A', marginTop: 12,
            maxWidth: 480, margin: '12px auto 0',
            lineHeight: 1.5,
          }}>
            Select a premium invitation template and preview the live experience your guests will see
          </p>
        </div>

        {/* ═══ MOBILE LAYOUT ═══ */}
        {isMobile && (
          <div className="s1-mobile-layout">
            {/* Phone preview — immersive hero */}
            <div className="s1-mobile-preview">
              <PhoneSimulator
                key={templateType}
                template={simulatorTemplate}
                theme={simulatorTheme}
                guestName={guestName}
                onGuestNameChange={setGuestName}
                config={simulatorConfig}
                isMobile={true}
              />
            </div>

            {/* Preset color dots (curated templates only) */}
            {!isCustom && (
              <MobilePresetRow
                template={activeTemplate}
                activePresetIndex={presetIdx}
                onPresetSelect={onPresetSelect}
              />
            )}

            {/* Horizontal template carousel */}
            <div
              ref={carouselRef}
              className="s1-carousel"
              style={{
                display: 'flex', gap: 10,
                overflowX: 'auto', overflowY: 'hidden',
                padding: '4px 20px 8px',
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {templates.map((tpl) => (
                <div key={tpl.key} style={{ scrollSnapAlign: 'center' }}>
                  <MobileTemplateChip
                    template={tpl}
                    isSelected={templateType === tpl.key}
                    onSelect={onTemplateSelect}
                    preset={tpl.presets[selectedPresets[tpl.key] || 0]}
                  />
                </div>
              ))}
            </div>

            {/* Custom builder OR specs pills */}
            {isCustom ? (
              <div style={{ padding: '4px 16px 0' }}>
                <CustomBuilder config={customConfig} onChange={onCustomConfigChange} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 20px 0', justifyContent: 'center' }}>
                {activeTemplate.specs.map((spec, i) => (
                  <span key={i} style={{
                    fontFamily: 'var(--font-sans)', fontSize: 10, color: '#77736A',
                    background: 'rgba(184,148,79,0.04)', border: '1px solid rgba(184,148,79,0.12)',
                    borderRadius: 6, padding: '4px 9px', fontWeight: 500,
                  }}>✦ {spec}</span>
                ))}
              </div>
            )}

            {/* CTA */}
            <div style={{ padding: '0 20px' }}>
              <button
                onClick={onNext}
                data-testid="wizard-next"
                style={{
                  marginTop: 16, width: '100%', height: 54,
                  background: 'linear-gradient(135deg, #B8944F, #a6833f)',
                  color: '#FFFFFF', border: 'none', borderRadius: 16,
                  fontFamily: 'var(--font-sans)', fontSize: 15,
                  fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 20px rgba(184,148,79,0.35)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                Continue
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ═══ DESKTOP SPLIT PANE ═══ */}
        {!isMobile && (
        <div className="s1-split" style={{
          display: 'grid', gridTemplateColumns: '1.2fr 0.8fr',
          gap: 48, alignItems: 'start',
        }}>
          {/* ─── LEFT: Template Gallery (large stacked cards) ─── */}
          <div>
            <div className="s1-grid" style={{
              display: 'grid', gridTemplateColumns: '1fr',
              gap: 14,
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

            {/* Custom builder OR specs/fields for curated templates */}
            {isCustom ? (
              <div style={{ marginTop: 18 }}>
                <CustomBuilder config={customConfig} onChange={onCustomConfigChange} />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20, padding: '0 4px' }}>
                  {activeTemplate.specs.map((spec, i) => (
                    <span key={i} style={{
                      fontFamily: 'var(--font-sans)', fontSize: 11, color: '#77736A',
                      background: 'rgba(184,148,79,0.04)', border: '1px solid rgba(184,148,79,0.12)',
                      borderRadius: 6, padding: '5px 10px', fontWeight: 500,
                    }}>✦ {spec}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, padding: '0 4px' }}>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 10, color: '#77736A', textTransform: 'uppercase',
                    letterSpacing: '0.06em', fontWeight: 600, marginRight: 4, alignSelf: 'center',
                  }}>Includes:</span>
                  {activeTemplate.fields.map((f, i) => (
                    <span key={i} style={{
                      fontFamily: 'var(--font-sans)', fontSize: 10, color: '#191B1E',
                      background: 'rgba(25,27,30,0.04)', border: '1px solid rgba(25,27,30,0.08)',
                      borderRadius: 4, padding: '3px 8px', fontWeight: 600,
                    }}>{f}</span>
                  ))}
                </div>
              </>
            )}

            {/* CTA Button */}
            <button
              onClick={onNext}
              data-testid="wizard-next"
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
              key={templateType}
              template={simulatorTemplate}
              theme={simulatorTheme}
              guestName={guestName}
              onGuestNameChange={setGuestName}
              config={simulatorConfig}
            />
          </div>
        </div>
        )}
      </div>

      <style jsx>{`
        @keyframes s1-float {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) scale(0.4); opacity: 0; }
        }

        /* ── Desktop defaults ── */
        .s1-root { padding: 48px 24px 80px; }
        .s1-header { margin-bottom: 48px; }
        .s1-mobile-layout { display: none; }

        @media (max-width: 1024px) {
          .s1-split { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
        }

        /* ── Mobile: full reimagination ── */
        @media (max-width: 768px) {
          .s1-root { padding: 20px 0 32px !important; }
          .s1-header { margin-bottom: 16px !important; padding: 0 20px; }
          .s1-subtitle { font-size: 12px !important; margin-top: 8px !important; }
          .s1-split { display: none !important; }
          .s1-mobile-layout {
            display: flex !important;
            flex-direction: column;
            gap: 12px;
          }
          .s1-mobile-preview {
            display: flex;
            justify-content: center;
            padding: 0 12px;
          }
          .s1-carousel::-webkit-scrollbar { display: none; }
        }

        @media (max-width: 480px) {
          .s1-header h1 { font-size: clamp(20px, 6vw, 28px) !important; }
          .s1-header h1 span { font-size: inherit !important; }
          .s1-header h1 span:nth-child(2) { font-size: clamp(26px, 7.5vw, 36px) !important; }
        }
      `}</style>
    </div>
  );
}
