'use client';

import React from 'react';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';

export default function DressCodeSection({ dressCode, isRTL }) {
  const C = useFullPageTheme();
  const label = dressCode || (isRTL ? 'شبه رسمي' : 'Semi-Formal');

  return (
    <SectionShell background={C.paper}>
      <SectionHeading isRTL={isRTL}>{isRTL ? 'قواعد اللباس' : 'Dress Code'}</SectionHeading>

      <div style={{
        width: '100%', maxWidth: '640px', background: C.cream, borderRadius: '20px',
        border: `1px solid ${C.border}`, padding: '28px 24px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '8px',
      }}>
        {/* The chosen dress code, front and centre */}
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: C.maroon, margin: 0, textAlign: 'center' }}>
          {label}
        </h3>
      </div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
