'use client';

import React from 'react';
import { FadeInUp, StaggerChildren, StaggerItem } from '../../../components/guest/GuestAnimations';
import { AttendanceCard } from '../../../components/guest/GuestUI';
import { S } from '../styles';
import { RsvpSectionHeading, RsvpDivider } from '../components';

/** Step 2 — attending or declining. "Yes" is the hero answer (large,
    theme-colored); "No" is a real but quieter option underneath. (A "maybe"
    option was intentionally removed platform-wide — guests give a definite
    yes/no so hosts get an accurate headcount.) */
export default function StepAttendance({ t, isRTL, guestName, attending, onSelect, onBack, themeColor = '#10b981' }) {
  const attendingQuestion = guestName.trim()
    ? t.attending_q.replace('{name}', guestName)
    : (isRTL ? 'هل ستشرفنا بحضورك؟' : 'Will you be attending?');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <FadeInUp y={15}>
        <RsvpSectionHeading kicker={isRTL ? 'ردّكم' : 'YOUR RESPONSE'} themeColor={themeColor} isRTL={isRTL} align="center">
          {attendingQuestion}
        </RsvpSectionHeading>
      </FadeInUp>

      <StaggerChildren staggerDelay={0.1} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <StaggerItem>
          <AttendanceCard type="yes" variant="primary" accentColor={themeColor} selected={attending} onClick={onSelect} isRTL={isRTL} />
        </StaggerItem>
        <StaggerItem>
          <AttendanceCard type="no" variant="compact" selected={attending} onClick={onSelect} isRTL={isRTL} />
        </StaggerItem>
      </StaggerChildren>

      {onBack && (
        <>
          <RsvpDivider themeColor={themeColor} />
          <div style={{ paddingTop: '4px' }}>
            <button onClick={onBack} style={S.backBtn}>{isRTL ? '← السابق' : '← Back'}</button>
          </div>
        </>
      )}
    </div>
  );
}
