'use client';
 
import React from 'react';
import Link from 'next/link';
 
const C = {
  gold: '#B8944F', charcoal: '#191B1E', 
  border: 'rgba(184,148,79,0.15)',
  lightBg: '#FAF8F5',
};
 
const STEP_LABELS = ['Templates', 'Configure', 'Distribute'];
 
export default function WizardShell({ step, onStepClick, children }) {
  return (
    <div style={{ minHeight: '100vh', background: C.lightBg }}>
      {/* ═══ TOP BAR ═══ */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(250,248,245,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.border}`,
        height: 60, display: 'flex', alignItems: 'center',
        padding: '0 24px',
      }}>
        {/* Left: Back + Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 0', minWidth: 0 }}>
          <Link href="/dashboard" style={{
            color: C.gold, textDecoration: 'none', display: 'flex',
            alignItems: 'center', gap: 6, fontSize: 13,
            fontFamily: 'var(--font-sans)', fontWeight: 600,
            opacity: 0.7, transition: 'opacity 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </Link>
          <span style={{
            fontFamily: 'var(--font-script)', fontSize: 22,
            color: C.gold, letterSpacing: 1,
          }}>Fancy</span>
        </div>
 
        {/* Center: Step Indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          justifyContent: 'center', flex: '2 1 0',
        }}>
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={i}>
              {/* Step Circle */}
              <div
                onClick={() => i < step && onStepClick(i)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 4, cursor: i < step ? 'pointer' : 'default',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)',
                  transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
                  ...(i < step ? {
                    background: C.gold, color: '#fff',
                    boxShadow: '0 2px 8px rgba(184,148,79,0.3)',
                  } : i === step ? {
                    background: 'transparent',
                    border: `2px solid ${C.gold}`, color: C.gold,
                    boxShadow: '0 0 0 4px rgba(184,148,79,0.15)',
                    animation: 'wz-pulse 2s ease-in-out infinite',
                  } : {
                    background: 'transparent',
                    border: '2px solid #D1CFC9', color: '#77736A',
                  }),
                }}>
                  {i < step ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7"/>
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span className="wz-step-label" style={{
                  fontSize: 10, fontFamily: 'var(--font-sans)',
                  fontWeight: i === step ? 700 : 500,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  color: i <= step ? C.gold : '#77736A',
                  transition: 'color 0.3s',
                }}>{label}</span>
              </div>
 
              {/* Connector Line */}
              {i < STEP_LABELS.length - 1 && (
                <div style={{
                  width: 56, height: 2, margin: '0 4px',
                  marginBottom: 18,
                  borderRadius: 1,
                  background: '#E8E2D6',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0,
                    height: '100%', borderRadius: 1,
                    background: `linear-gradient(90deg, ${C.gold}, #D7BE80)`,
                    width: i < step ? '100%' : '0%',
                    transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
                  }} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
 
        {/* Right: spacer */}
        <div style={{ flex: '1 1 0', minWidth: 0 }} />
      </div>
 
      {/* ═══ CONTENT ═══ */}
      <div style={{ position: 'relative' }}>
        {children}
      </div>
 
      <style jsx>{`
        @keyframes wz-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(184,148,79,0.15); }
          50% { box-shadow: 0 0 0 8px rgba(184,148,79,0.08); }
        }
        @media (max-width: 768px) {
          .wz-step-label { display: none !important; }
        }
      `}</style>
    </div>
  );
}
