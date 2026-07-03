'use client';

import React from 'react';
import { FadeInUp, StaggerChildren, StaggerItem } from '../../../components/guest/GuestAnimations';
import { AttendanceCard } from '../../../components/guest/GuestUI';
import { S } from '../styles';

/** Step 2 — attending / maybe / declining. */
export default function StepAttendance({ t, isRTL, guestName, attending, onSelect, onBack }) {
  const attendingQuestion = guestName.trim()
    ? t.attending_q.replace('{name}', guestName)
    : (isRTL ? 'هل ستشرفنا بحضورك؟' : 'Will you be attending?');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <FadeInUp y={15}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: '#191B1E', textAlign: 'center', lineHeight: 1.4 }}>
          {attendingQuestion}
        </h3>
      </FadeInUp>

      <StaggerChildren
        staggerDelay={0.1}
        className="attendance-cards-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}
      >
        {['yes', 'maybe', 'no'].map(type => (
          <StaggerItem key={type}>
            <AttendanceCard type={type} selected={attending} onClick={onSelect} isRTL={isRTL} />
          </StaggerItem>
        ))}
      </StaggerChildren>

      {onBack && (
        <div style={{ borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
          <button onClick={onBack} style={S.backBtn}>{isRTL ? '← السابق' : '← Back'}</button>
        </div>
      )}
    </div>
  );
}
