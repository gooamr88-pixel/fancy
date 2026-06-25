'use client';

// One-click email RSVP — now a THIN delegate to the unified <RsvpExperience> engine.
//
// Reached from the Accept / Decline / Maybe buttons in the invitation email (each
// carries a signed ?token=). All resolution, the already-responded lock, the
// deadline-closed state, idempotent submit and error handling live in the engine;
// this route only supplies the entry context and the quick-confirm input surface.
// (Previously ~700 lines of bespoke state machine — now consolidated.)

import React, { useEffect, useState } from 'react';
import RsvpExperience from '../components/guest/rsvp/RsvpExperience';
import QuickConfirm from '../components/guest/rsvp/QuickConfirm';

export default function RsvpConfirmPage() {
  // Read the signed token on the client. Until it's read we render nothing (a single
  // frame); the engine then takes over and shows its own skeleton — no mock flash.
  const [context, setContext] = useState(null);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    setContext({ kind: 'token', token });
  }, []);

  if (!context) return null;

  return (
    <RsvpExperience context={context} lang="en">
      {(api) => <QuickConfirm {...api} />}
    </RsvpExperience>
  );
}
