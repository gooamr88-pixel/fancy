'use client';

import React from 'react';
import { FullPageThemeProvider } from '../../heritageArch/theme';
import RsvpSection from '../../heritageArch/sections/RsvpSection';
import { useLiteralTheme, alpha, darken } from '../theme';

/* RsvpGlassCard — a VISUAL-ONLY wrapper around the real RsvpSection (the
   same guest-cap-enforcing, custom-field-aware, idempotent-submit RSVP flow
   every other template uses). No functional logic lives here — RsvpSection
   already reads every color from useFullPageTheme(), so supplying a
   translucent palette through FullPageThemeProvider is enough to make its
   existing card chrome render as genuine glassmorphism (the reference's
   frosted RSVP card) without touching a single line of RsvpSection.js. */
export default function RsvpGlassCard({ event, slug, guestRsvp, hasResponded, responseStatus, allowGuestEdits, effectiveRsvpId, mealOptions, isRTL, trackEvent }) {
  const C = useLiteralTheme();

  const glassPalette = {
    background: C.glassBg,
    paper: alpha(C.gold, 0.12),
    cream: C.glassBg,
    ink: C.ink,
    maroon: C.gold,
    maroonDeep: darken(C.gold, 0.25),
    gold: C.goldSoft,
    border: C.glassBorder,
  };

  return (
    <div style={{ backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}>
      <FullPageThemeProvider palette={glassPalette}>
        <RsvpSection
          event={event}
          slug={slug}
          guestRsvp={guestRsvp}
          hasResponded={hasResponded}
          responseStatus={responseStatus}
          allowGuestEdits={allowGuestEdits}
          effectiveRsvpId={effectiveRsvpId}
          mealOptions={mealOptions}
          isRTL={isRTL}
          trackEvent={trackEvent}
        />
      </FullPageThemeProvider>
    </div>
  );
}
