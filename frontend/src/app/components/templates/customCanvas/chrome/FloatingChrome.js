'use client';

import React from 'react';
import { CalendarButton } from '../../../guest/GuestUI';
import { useLiteralTheme } from '../theme';

/* FloatingChrome — the reference's two bottom-corner floating circular
   buttons (music play/pause, add-to-calendar), reusing the app's existing
   logic for both: `musicPlaying`/`toggleMusic` are the same props
   EventPageClient already threads through to every other template's
   MusicToggle, and CalendarButton (GuestUI.js) is the app's real ICS +
   Google/Apple/Outlook calendar flow — only the chrome here is new. */
export function FloatingMusicButton({ playing, onToggle, isRTL }) {
  const C = useLiteralTheme();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? 'Pause music' : 'Play music'}
      style={{
        position: 'fixed', bottom: 20, zIndex: 40,
        ...(isRTL ? { left: 20 } : { right: 20 }),
        width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: C.gold, color: C.paper, boxShadow: `0 6px 18px ${C.gold}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {playing ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <polygon points="5,3 19,12 5,21" />
        </svg>
      )}
    </button>
  );
}

export function FloatingCalendarButton({ event, isRTL }) {
  return (
    <CalendarButton
      event={event}
      isRTL={isRTL}
      variant="dark"
      style={{ position: 'fixed', bottom: 20, zIndex: 40, ...(isRTL ? { right: 20 } : { left: 20 }) }}
      buttonStyle={{ borderRadius: 999, boxShadow: '0 6px 18px rgba(0,0,0,0.25)' }}
    />
  );
}
