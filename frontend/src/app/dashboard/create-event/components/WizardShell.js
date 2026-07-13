'use client';

import React from 'react';
import Link from 'next/link';

const C = {
  gold: '#B8944F', charcoal: '#191B1E',
  border: 'rgba(184,148,79,0.15)',
  lightBg: '#FAF8F5',
};

const DEFAULT_STEP_LABELS = ['Templates', 'Configure', 'Distribute'];

export default function WizardShell({ step, onStepClick, children, labels }) {
  const STEP_LABELS = labels && labels.length ? labels : DEFAULT_STEP_LABELS;
  return (
    <div style={{ minHeight: '100dvh', background: C.lightBg }}>
      {/* ═══ TOP BAR ═══ */}
      <div className="wz-topbar" style={{
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
          <span className="wz-logo" style={{
            fontFamily: 'var(--font-script)', fontSize: 22,
            color: C.gold, letterSpacing: 1,
          }}>Fancy</span>
        </div>

        {/* Center: Step Indicator (desktop). On a phone the five circles + four
            connectors need ~242px and the labels were hidden entirely — so you got
            five anonymous dots crammed against the logo, overflowing below ~350px
            with no idea which step you were on. Swapped for .wz-mobile-progress. */}
        <div className="wz-steps" style={{
          display: 'flex', alignItems: 'center', gap: 0,
          justifyContent: 'center', flex: '2 1 0', minWidth: 0,
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
                <div className="wz-circle" style={{
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
                <div className="wz-connector" style={{
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

        {/* Center: compact progress (mobile only). Names the step you're actually
            on — which the desktop circle-chain hid on small screens — and can never
            overflow, since it's text + a fluid bar rather than a fixed-width chain. */}
        <div className="wz-mobile-progress" style={{
          display: 'none', flex: '2 1 0', minWidth: 0,
          flexDirection: 'column', justifyContent: 'center', gap: 5,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, fontFamily: 'var(--font-sans)' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#77736A', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              {step + 1}/{STEP_LABELS.length}
            </span>
            <span style={{
              fontSize: 12, fontWeight: 700, color: C.gold, letterSpacing: '0.04em', textTransform: 'uppercase',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
            }}>
              {STEP_LABELS[step]}
            </span>
          </div>
          <div style={{ height: 3, borderRadius: 2, background: '#E8E2D6', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: `linear-gradient(90deg, ${C.gold}, #D7BE80)`,
              width: `${((step + 1) / STEP_LABELS.length) * 100}%`,
              transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
            }} />
          </div>
        </div>

        {/* Right: spacer (desktop only — on mobile the progress bar takes the room) */}
        <div className="wz-spacer" style={{ flex: '1 1 0', minWidth: 0 }} />
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
          /* Drop the fixed-width circle chain entirely and give the room to a
             fluid "3/5 · CONFIGURE" + progress bar, which names the current step
             and cannot overflow at any width. */
          .wz-steps { display: none !important; }
          .wz-spacer { display: none !important; }
          .wz-mobile-progress { display: flex !important; }
          .wz-topbar { padding: 0 14px !important; height: 56px !important; }
          .wz-logo { font-size: 18px !important; }
        }
      `}</style>
    </div>
  );
}
