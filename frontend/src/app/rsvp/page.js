'use client';

// One-click email RSVP — now a THIN delegate to the unified <RsvpExperience> engine.
//
// Reached from the Accept / Decline / Maybe buttons in the invitation email (each
// carries a signed ?token=). All resolution, the already-responded lock, the
// deadline-closed state, idempotent submit and error handling live in the engine;
// this route only supplies the entry context and the quick-confirm input surface.
// (Previously ~700 lines of bespoke state machine — now consolidated.)

import React from 'react';
import RsvpExperience from '../components/guest/rsvp/RsvpExperience';
import QuickConfirm from '../components/guest/rsvp/QuickConfirm';
import { useIsClient } from '../utils/useIsClient';

export default function RsvpConfirmPage() {
  // The token lives in window.location.search, which doesn't exist during SSR
  // and must match on the client's first (pre-hydration) render to avoid a
  // hydration mismatch — useIsClient's server/client snapshot split gives us
  // exactly that: false during SSR and the first client render (so we render
  // nothing, same as before), true from the next paint on, at which point
  // reading window is safe. No separate effect/state needed.
  const isClient = useIsClient();
  const context = isClient ? { kind: 'token', token: new URLSearchParams(window.location.search).get('token') } : null;

  if (!context) return null;

  return (
    <RsvpExperience context={context} lang="en">
      {(api) => <QuickConfirm {...api} />}
    </RsvpExperience>
  );
}
