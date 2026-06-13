'use client';

import React from 'react';
import MobilePreview from '../../../../app/components/templates/MobilePreview';

export default function PhoneSimulator({ template, theme }) {
  return (
    <div style={{
      position: 'sticky', top: 100,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 16,
    }}>
      {/* ─── iPhone Frame ─── */}
      <div style={{
        width: '100%', maxWidth: 310,
        background: '#1A1A1A',
        borderRadius: 44, padding: 10,
        boxShadow: `
          0 0 0 1px rgba(255,255,255,0.08),
          0 20px 60px rgba(0,0,0,0.5),
          0 8px 24px rgba(0,0,0,0.3),
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
          <MobilePreview template={template} theme={theme} />
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
        alignItems: 'center', gap: 6,
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
            fontWeight: 600, color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.03em',
          }}>Live Interactive Preview</span>
        </div>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 11,
          color: 'rgba(255,255,255,0.35)',
        }}>Tap the envelope to interact</span>
      </div>

      <style jsx>{`
        @keyframes ps-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
