'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../../utils/apiClient';
import { PLATFORM_TIMEZONE } from '../../utils/timezone';

/**
 * ═══════════════════════════════════════════════════════════════
 * THE ORGANIZER'S CLOCK, ESTABLISHED ONCE FOR THE WHOLE DASHBOARD.
 *
 * Event dates carry their own zone on the event row, so anything showing an
 * event reads it from there. This context is for the OTHER half: the real
 * timestamps scattered across the dashboard — when an RSVP arrived, when a
 * guest was checked in, when a referral paid out. Those are not facts about an
 * event, they are facts about this organizer's account, so they belong on this
 * organizer's clock.
 *
 * ── Why a context rather than props ──
 *
 * The components that print these timestamps are leaves. CheckinLive and
 * CheckinConflicts take an `eventId` and fetch their own data; RsvpTrendChart
 * takes an array of numbers. Threading a timezone down to them would mean
 * changing every intermediate component that happens to sit between them and
 * the page — a wide, mechanical diff whose only purpose is transport, and one
 * where a single missed link fails silently by falling back to a plausible
 * wrong answer.
 *
 * The dashboard layout already wraps every /dashboard/* route, which makes it
 * the one place this can be established once and read anywhere.
 *
 * ── Why it fetches rather than being handed down ──
 *
 * The alternative is for every dashboard page to fetch the profile and pass it
 * in, which several already do independently. Doing it here means one request
 * for a value that cannot change during a session — the organizer's zone is
 * frozen at signup and only ever altered deliberately, from a settings screen
 * that reloads.
 *
 * Failure is silent and safe: a profile that will not load leaves the platform
 * default in place, which is what every one of these call sites did before
 * this existed — except unlabelled, and in the viewer's browser zone rather
 * than a named one.
 * ═══════════════════════════════════════════════════════════════
 */

const OrganizerClockContext = createContext(PLATFORM_TIMEZONE);

export function OrganizerClockProvider({ children }) {
  const [timeZone, setTimeZone] = useState(PLATFORM_TIMEZONE);

  useEffect(() => {
    let cancelled = false;
    // Inline async IIFE rather than a .then chain, and guarded by `cancelled`:
    // a bare setState in an effect body is what the set-state-in-effect rule
    // exists to stop, and an unguarded one fires after unmount on a fast route
    // change.
    (async () => {
      try {
        // apiFetch, not a raw fetch. It owns the base URL — including the
        // `/api/v1` suffix normalisation — and sends the auth cookie. A hand
        // rolled `process.env.NEXT_PUBLIC_API_URL || '/api/v1'` was here first
        // and was wrong in local development: the fallback is relative, so with
        // no env var set it resolved against the Next dev server on :3000
        // rather than the API on :5000, and every dashboard silently fell back
        // to the platform timezone.
        const res = await apiFetch('/auth/profile');
        if (!cancelled && res?.profile?.timezone) setTimeZone(res.profile.timezone);
      } catch {
        // Keep the default. An organizer should not lose their dashboard
        // because a timezone lookup failed.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <OrganizerClockContext.Provider value={timeZone}>
      {children}
    </OrganizerClockContext.Provider>
  );
}

/**
 * The organizer's IANA zone. Always a usable value — never null.
 *
 * The only export. Two convenience hooks (useTimestamp / useDate) were written
 * here first and every call site reached for this one instead, pairing it with
 * the shared formatters directly — partly because several of the consumers are
 * React.memo'd rows or module-level helpers, where a hook returning a fresh
 * closure on every render is the wrong shape. They were removed rather than
 * left as an unused second way to do the same thing.
 */
export function useOrganizerTimeZone() {
  return useContext(OrganizerClockContext);
}
