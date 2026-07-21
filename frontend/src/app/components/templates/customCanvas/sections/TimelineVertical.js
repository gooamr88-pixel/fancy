'use client';

import React, { useState } from 'react';
import { FadeInUp, StaggerChildren, StaggerItem } from '../../../guest/GuestAnimations';
import { useLiteralTheme } from '../theme';

/* TimelineVertical — the reference's vertical line + dot-icon schedule
   (Welcome Reception / Ceremony / Dinner / Party style), but rendering the
   app's real dynamic schedule data (template_data.ha_days, already
   organizer-editable via DaysEditor.js) instead of 4 hardcoded slots — so it
   supports any number of slots, and any number of days. */
export default function TimelineVertical({ days, isRTL }) {
  const C = useLiteralTheme();
  const [activeDay, setActiveDay] = useState(0);
  const validDays = (days || []).filter((d) => Array.isArray(d.schedule) && d.schedule.length > 0);
  if (validDays.length === 0) return null;
  const day = validDays[Math.min(activeDay, validDays.length - 1)];

  return (
    <div style={{
      minHeight: '70dvh', width: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 8,
      background: C.paper, padding: 'clamp(48px, 10vh, 80px) 24px', boxSizing: 'border-box',
    }}>
      <FadeInUp>
        <h2 style={{ fontFamily: 'var(--font-serif)', color: C.gold, fontSize: 'clamp(26px, 4.5vw, 38px)', margin: '0 0 8px', textAlign: 'center' }}>
          {isRTL ? 'برنامج اليوم' : 'The Schedule'}
        </h2>
      </FadeInUp>

      {validDays.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          {validDays.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveDay(i)}
              style={{
                padding: '8px 20px', borderRadius: 999, border: `1px solid ${C.border}`, cursor: 'pointer',
                fontFamily: 'var(--font-serif)', fontSize: 14,
                background: activeDay === i ? C.gold : 'transparent',
                color: activeDay === i ? C.paper : C.gold, fontWeight: activeDay === i ? 700 : 500,
              }}
            >
              {d.label || (isRTL ? `اليوم ${i + 1}` : `Day ${i + 1}`)}
            </button>
          ))}
        </div>
      )}

      <StaggerChildren staggerDelay={0.12} style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
        <span aria-hidden="true" style={{
          position: 'absolute', left: '50%', top: 8, bottom: 8, width: 1,
          background: C.border, transform: 'translateX(-50%)',
        }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {day.schedule.map((item, i) => (
            <StaggerItem key={i} style={{ position: 'relative', textAlign: 'center' }}>
              <span aria-hidden="true" style={{
                display: 'block', width: 10, height: 10, borderRadius: '50%',
                background: C.gold, margin: '0 auto 10px', boxShadow: `0 0 0 4px ${C.paper}`,
              }} />
              <span style={{ display: 'block', fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 20, color: C.gold }}>
                {item.time}
              </span>
              <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 14, color: C.ink, marginTop: 2 }}>
                {item.label}
              </span>
            </StaggerItem>
          ))}
        </div>
      </StaggerChildren>
    </div>
  );
}
