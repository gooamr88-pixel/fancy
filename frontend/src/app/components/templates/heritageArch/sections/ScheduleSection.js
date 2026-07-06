'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HERITAGE_ARCH_COLORS as C } from '../defaultContent';
import { SectionShell, SectionHeading, DayTabs, ScrollToRsvpHint, ICONS, VineLine } from '../shared';

export default function ScheduleSection({ schedule, isRTL }) {
  const [day, setDay] = useState('day1');
  const items = (schedule && schedule[day]) || [];

  return (
    <SectionShell>
      <SectionHeading isRTL={isRTL}>
        {isRTL ? 'ماذا خططنا لكم' : 'What we have planned for you'}
      </SectionHeading>

      <DayTabs value={day} onChange={setDay} isRTL={isRTL} />

      <div style={{ position: 'relative', width: '100%', maxWidth: '520px' }}>
        <VineLine itemCount={items.length} color={C.gold} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '48px', padding: '12px 0' }}>
          {items.map((item, i) => (
            <motion.div
              key={`${day}-${i}`}
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
                fontSize: '18px', flexShrink: 0, zIndex: 1,
              }}>
                {ICONS[item.icon] || '✦'}
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
