'use client';

// Public RSVP route — now a THIN delegate to the unified <RsvpExperience> engine.
//
// All cross-cutting concerns (entry-context resolution for public / private-SMS ?g= /
// invite ?rsvp_id=, the zero-flash loading skeleton, the DigitalEnvelope intro, the
// bulletproof already-responded lock, every terminal status, and the single idempotent
// submit) live in the engine. This route only supplies the entry context and the
// multi-step input surface (<FullRsvpForm>). The ~2,000-line bespoke state machine that
// used to live here was extracted verbatim into FullRsvpForm.js.

import React, { Suspense, use } from 'react';
import { useSearchParams } from 'next/navigation';
import RsvpExperience from '../../components/guest/rsvp/RsvpExperience';
import FullRsvpForm from './FullRsvpForm';

function RsvpRoute({ slug }) {
  const sp = useSearchParams();
  const context = {
    kind: 'slug',
    slug,
    guestId: sp.get('g'),       // private SMS link
    rsvpId: sp.get('rsvp_id'),  // per-guest invitation token
  };
  const lang = sp.get('lang') === 'ar' ? 'ar' : 'en';

  return (
    <RsvpExperience context={context} lang={lang} envelope>
      {(api) => <FullRsvpForm {...api} />}
    </RsvpExperience>
  );
}

export default function RsvpFormPage({ params }) {
  const { slug } = use(params);
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid #E8E2D6', borderTop: '3px solid #B8944F', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    }>
      <RsvpRoute slug={slug} />
    </Suspense>
  );
}
