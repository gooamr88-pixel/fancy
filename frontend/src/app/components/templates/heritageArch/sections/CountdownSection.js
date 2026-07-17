'use client';

import React from 'react';
import { CountdownDigit } from '../../../guest/GuestAnimations';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading, ScrollToRsvpHint } from '../shared';
import Icon from '../../../icons/Icon';

// A clearly delineated "Event Time" card — start time, and end time when the
// organizer set one — so guests never have to hunt through the date line or
// squint at small print to know when things actually begin and wrap up. The
// date rides along with it (not just the time) so this card alone is always
// enough to know exactly when the event is, without scrolling back to the
// hero — most useful for multi-day events, where the hero deliberately
// doesn't glue one clock time onto a date range.
function EventTimeCard({ dateLine, startTime, endTime, isRTL }) {
  const C = useFullPageTheme();
  if (!startTime && !endTime) return null;
  return (
    <div
      style={{
        marginTop: '32px', display: 'inline-flex', alignItems: 'center', gap: '16px',
        padding: '18px 30px', borderRadius: '18px',
        background: C.cream, border: `1px solid ${C.gold}66`,
        boxShadow: `0 10px 28px ${C.maroon}14`,
      }}
    >
      <div style={{
        width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
        background: `${C.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="clock" size={19} color={C.maroon} strokeWidth={1.6} />
      </div>
      <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: '10.5px', fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: C.gold,
        }}>
          {isRTL ? 'وقت الفعالية' : 'Event Time'}
        </div>
        {dateLine && (
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600,
            letterSpacing: '0.04em', color: C.maroon, opacity: 0.8, marginTop: '3px',
          }}>
            {dateLine}
          </div>
        )}
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(17px, 3vw, 21px)', fontWeight: 700,
          color: C.maroon, marginTop: '2px',
        }}>
          {startTime && endTime
            ? (isRTL ? `${startTime} – ${endTime}` : `${startTime} – ${endTime}`)
            : (isRTL ? `يبدأ الساعة ${startTime || endTime}` : `Starts at ${startTime || endTime}`)}
        </div>
      </div>
    </div>
  );
}

export default function CountdownSection({ timeLeft, isRTL, dateLine, startTime, endTime }) {
  const C = useFullPageTheme();
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

      <EventTimeCard dateLine={dateLine} startTime={startTime} endTime={endTime} isRTL={isRTL} />

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
