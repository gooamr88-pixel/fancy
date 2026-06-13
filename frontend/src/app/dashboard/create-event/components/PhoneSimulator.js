'use client';
 
import React from 'react';
import MobilePreview from '../../../../app/components/templates/MobilePreview';
 
export default function PhoneSimulator({ template, theme, guestName, onGuestNameChange }) {
  return (
    <div className="ce-phone-container">
      {/* ─── iPhone Frame ─── */}
      <div style={{
        width: '100%', maxWidth: 310,
        background: '#1A1A1A',
        borderRadius: 44, padding: 10,
        boxShadow: `
          0 0 0 1px rgba(255,255,255,0.08),
          0 20px 60px rgba(0,0,0,0.15),
          0 8px 24px rgba(0,0,0,0.1),
          inset 0 1px 0 rgba(255,255,255,0.05)
        `,
        position: 'relative',
      }}>
        {/* Notch */}
        <div style={{
          position: 'absolute', top: 10, left: '50%',
          transform: 'translateX(-50%)',
          width: 100, height: 28, borderRadius: 14,
          background: '#0A0A0A',
          zIndex: 20,
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 6,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#1a1a2e',
            border: '1.5px solid #2a2a3e',
          }} />
          <div style={{
            width: 32, height: 3, borderRadius: 2,
            background: '#1a1a2e',
          }} />
        </div>
 
        {/* Screen */}
        <div style={{
          borderRadius: 34, overflow: 'hidden',
          background: '#000',
          aspectRatio: '9 / 18.5',
          position: 'relative',
        }}>
          <MobilePreview template={template} theme={theme} guestName={guestName} isBare={true} />
        </div>
 
        {/* Home Indicator */}
        <div style={{
          position: 'absolute', bottom: 8,
          left: '50%', transform: 'translateX(-50%)',
          width: 96, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.15)',
        }} />
      </div>
 
      {/* ─── Label ─── */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 4,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#3B9B6D',
            animation: 'ps-blink 2s ease-in-out infinite',
          }} />
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 12,
            fontWeight: 600, color: '#191B1E',
            letterSpacing: '0.03em',
          }}>Live Interactive Preview</span>
        </div>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 11,
          color: '#77736A',
        }}>Tap the envelope to interact</span>
      </div>
 
      {/* ─── Control Panel ─── */}
      <div style={{
        width: '100%', maxWidth: 310,
        background: 'rgba(255,255,255,0.8)',
        border: '1px solid rgba(184,148,79,0.15)',
        borderRadius: 16, padding: '12px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        display: 'flex', flexDirection: 'column', gap: 6,
        boxSizing: 'border-box',
      }}>
        <label style={{
          fontSize: 9, fontWeight: 700,
          color: '#77736A', textTransform: 'uppercase',
          letterSpacing: '0.08em', fontFamily: 'var(--font-sans)',
        }}>Customize Guest Name (Simulator Only)</label>
        <input 
          type="text" 
          value={guestName || ""} 
          onChange={e => onGuestNameChange(e.target.value)}
          placeholder="e.g. Sarah & John"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#FFFFFF', border: '1px solid #E8E2D6',
            borderRadius: 8, padding: '8px 12px',
            fontSize: 12, color: '#191B1E',
            outline: 'none', fontFamily: 'var(--font-sans)',
            transition: 'border-color 0.25s, box-shadow 0.25s',
          }}
          onFocus={e => { e.target.style.borderColor = '#B8944F'; e.target.style.boxShadow = '0 0 0 3px rgba(184,148,79,0.08)'; }}
          onBlur={e => { e.target.style.borderColor = '#E8E2D6'; e.target.style.boxShadow = 'none'; }}
        />
      </div>
 
      <style jsx>{`
        .ce-phone-container {
          position: sticky;
          top: 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          width: 100%;
        }
        @keyframes ps-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @media (max-width: 768px) {
          .ce-phone-container {
            position: relative !important;
            top: 0 !important;
            margin-bottom: 24px;
          }
        }
        @media (max-width: 480px) {
          .ce-phone-container {
            transform: scale(0.88);
            transform-origin: top center;
            margin-bottom: -40px;
          }
        }
      `}</style>
    </div>
  );
}
