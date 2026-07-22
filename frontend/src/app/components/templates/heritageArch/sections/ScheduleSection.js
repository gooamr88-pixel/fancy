'use client';

import React, { useState, useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useFullPageTheme } from '../theme';
import { SectionShell, SectionHeading, DayTabs, ScrollToRsvpHint, ICONS, VineLine } from '../shared';
import Icon from '../../../icons/Icon';

// A small flower badge that turns as the guest scrolls past the timeline —
// its rotation is driven by scroll position through the timeline itself
// (useScroll's target/offset), not a time-based loop, matching the
// reference's scroll-tied rotating decoration.
function ScrollRotatingFlower({ containerRef, color }) {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start 0.85', 'end 0.35'] });
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 300]);

  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: 'absolute', top: '-30px', left: '50%', transform: 'translateX(-50%)',
        width: '34px', height: '34px', rotate: reduce ? 0 : rotate,
      }}
    >
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <ellipse key={deg} cx="17" cy="9" rx="4" ry="7.5" fill={color} opacity="0.6"
            transform={`rotate(${deg} 17 17)`} />
        ))}
        <circle cx="17" cy="17" r="3.2" fill={color} />
      </svg>
    </motion.div>
  );
}

export default function ScheduleSection({ days, isRTL }) {
  const C = useFullPageTheme();
  const [dayIndex, setDayIndex] = useState(0);
  const items = days?.[dayIndex]?.schedule || [];
  const timelineRef = useRef(null);

  return (
    <SectionShell>
      <SectionHeading isRTL={isRTL}>
        {isRTL ? 'ماذا خططنا لكم' : 'What we have planned for you'}
      </SectionHeading>

      <DayTabs days={days} activeIndex={dayIndex} onChange={setDayIndex} isRTL={isRTL} />

      <div ref={timelineRef} style={{ position: 'relative', width: '100%', maxWidth: '520px' }}>
        <ScrollRotatingFlower containerRef={timelineRef} color={C.gold} />
        <VineLine itemCount={items.length} color={C.gold} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '48px', padding: '12px 0' }}>
          {items.map((item, i) => (
            <motion.div
              key={`${dayIndex}-${i}`}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              style={{
                display: 'flex', alignItems: 'center', gap: '18px',
                flexDirection: i % 2 === 0 ? 'row' : 'row-reverse',
              }}
            >
              <div style={{ flex: 1, textAlign: i % 2 === 0 ? (isRTL ? 'left' : 'right') : (isRTL ? 'right' : 'left') }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 700, color: C.maroon }}>{item.time}</div>
                <div style={{ fontSize: '13px', letterSpacing: '0.04em', color: C.ink, opacity: 0.75, marginTop: '2px' }}>{item.label}</div>
              </div>
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%', background: C.cream,
                border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, zIndex: 1,
              }}>
                <Icon name={ICONS[item.icon] || 'sparkle'} size={17} color={C.gold} strokeWidth={1.5} />
              </div>
              <div style={{ flex: 1 }} />
            </motion.div>
          ))}
        </div>
      </div>

      <ScrollToRsvpHint isRTL={isRTL} />
    </SectionShell>
  );
}
