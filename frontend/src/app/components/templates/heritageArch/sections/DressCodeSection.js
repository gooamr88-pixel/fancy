'use client';

import React from 'react';
import { HERITAGE_ARCH_COLORS as C } from '../defaultContent';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';

const DEFAULT_MEN_COLORS = ['#7C8B6F', '#B8926A', '#E8DFC8'];
const DEFAULT_WOMEN_COLORS = ['#8FA37E', '#A98A8A', '#AEC6D4'];

function ManFigure({ color, skin = '#D9B99A' }) {
  return (
    <svg viewBox="0 0 60 170" width="100%" height="100%" aria-hidden="true">
      <circle cx="30" cy="16" r="11" fill={skin} />
      <path d="M14 32 Q30 22 46 32 L49 96 Q30 104 11 96 Z" fill={color} />
      <path d="M27 40 L33 40 L31 92 L29 92 Z" fill="#FFFDF8" opacity="0.9" />
      <path d="M28.5 44 L31.5 44 L30.5 78 L29.5 78 Z" fill="#2A2420" opacity="0.75" />
      <rect x="17" y="96" width="11" height="60" rx="2" fill="#3A342E" />
      <rect x="32" y="96" width="11" height="60" rx="2" fill="#3A342E" />
    </svg>
  );
}

function WomanFigure({ color, skin = '#D9B99A' }) {
  return (
    <svg viewBox="0 0 60 170" width="100%" height="100%" aria-hidden="true">
      <circle cx="30" cy="15" r="10.5" fill={skin} />
      <path d="M18 30 Q30 24 42 30 L34 58 L26 58 Z" fill={color} opacity="0.95" />
      <path d="M20 52 Q30 62 40 52 L54 158 Q30 168 6 158 Z" fill={color} />
      <path d="M22 90 Q30 96 38 90" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" fill="none" />
      <path d="M18 120 Q30 128 42 120" stroke="rgba(0,0,0,0.1)" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export default function DressCodeSection({ dressCode, colors, isRTL }) {
  const menColors = colors?.men?.length ? colors.men : DEFAULT_MEN_COLORS;
  const womenColors = colors?.women?.length ? colors.women : DEFAULT_WOMEN_COLORS;
  const swatchColors = colors?.swatches || [];

  return (
    <SectionShell background={C.paper}>
      <SectionHeading isRTL={isRTL}>{isRTL ? 'قواعد اللباس' : 'Dress Code'}</SectionHeading>

      <div style={{
        width: '100%', maxWidth: '620px', background: C.cream, borderRadius: '20px',
        border: `1px solid ${C.border}`, padding: '32px 24px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '20px',
      }}>
        <div style={{ display: 'flex', gap: '6px', width: '100%', maxWidth: '480px' }}>
          {menColors.map((c, i) => (
            <div key={`m${i}`} style={{ flex: 1, aspectRatio: '60/170' }}><ManFigure color={c} /></div>
          ))}
          {womenColors.map((c, i) => (
            <div key={`w${i}`} style={{ flex: 1, aspectRatio: '60/170' }}><WomanFigure color={c} /></div>
          ))}
        </div>

        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: C.maroon, margin: 0 }}>{dressCode || 'Semi-Formal'}</h3>

        <div style={{ display: 'flex', gap: '48px', borderTop: `1px solid ${C.border}`, paddingTop: '16px', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: C.ink, opacity: 0.6 }}>{isRTL ? 'السيدات' : 'WOMEN'}</span>
            <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-serif)', fontSize: '16px', color: C.maroon }}>{isRTL ? 'فستان كوكتيل' : 'Cocktail dress'}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: C.ink, opacity: 0.6 }}>{isRTL ? 'الرجال' : 'MEN'}</span>
            <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-serif)', fontSize: '16px', color: C.maroon }}>{isRTL ? 'بدلة وربطة عنق' : 'Suit & Tie'}</p>
          </div>
        </div>

        {swatchColors.length > 0 && (
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '12px', letterSpacing: '0.06em', color: C.ink, opacity: 0.7 }}>
              {isRTL ? 'الألوان المقترحة' : 'Suggested colors'}
            </span>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
              {swatchColors.map((c, i) => (
                <span key={i} style={{ width: '26px', height: '26px', borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.08)' }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
