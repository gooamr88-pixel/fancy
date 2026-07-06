'use client';

import React from 'react';
import { CountdownDigit } from '../../../guest/GuestAnimations';
import { HERITAGE_ARCH_COLORS as C } from '../defaultContent';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';

export default function CountdownSection({ timeLeft, isRTL }) {
  const units = [
    { key: 'days', value: timeLeft.days, label: isRTL ? 'أيام' : 'Days' },
    { key: 'hours', value: timeLeft.hours, label: isRTL ? 'ساعات' : 'Hours' },
    { key: 'minutes', value: timeLeft.minutes, label: isRTL ? 'دقائق' : 'Minutes' },
    { key: 'seconds', value: timeLeft.seconds, label: isRTL ? 'ثواني' : 'Seconds' },
  ];

  return (
    <SectionShell background={C.paper}>
      <SectionHeading subtitle={isRTL ? 'لا يمكننا الانتظار حتى هذه اللحظة!' : "We can't wait until this moment!"} isRTL={isRTL}>
        {isRTL ? 'العد التنازلي' : 'Countdown'}
      </SectionHeading>

      <div style={{ display: 'flex', gap: 'clamp(12px, 3vw, 28px)', flexWrap: 'wrap', justifyContent: 'center', marginTop: '24px' }}>
        {units.map((u) => (
          <div key={u.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <CountdownDigit value={u.value ?? 0} label="" color={C.maroon} bgColor="rgba(255,255,255,0.55)" />
            <span style={{ fontSize: '12px', letterSpacing: '0.12em', fontWeight: 700, color: C.maroon, textTransform: 'uppercase' }}>{u.label}</span>
          </div>
        ))}
      </div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
