import { useEffect, useRef } from 'react';

/**
 * Keeps the organizer dashboard's RSVP data fresh.
 *
 * NOTE: This previously subscribed to Supabase `postgres_changes` on the `rsvps`
 * table using the public anon key. That only worked because RLS exposed all RSVPs
 * of active events to the `public` role — the exact misconfiguration that leaked
 * guest PII (see migration 20260615400000_rls_pii_lockdown.sql). Now that the anon
 * role has no table access, we poll the authenticated backend instead.
 *
 * The hook signals the consumer the same way the old "non-INSERT" branch did: it
 * invokes the callback with a non-INSERT payload, which the dashboard handles by
 * calling its own `loadDashboardData()` refetch (through the service-role API).
 */
const POLL_INTERVAL_MS = 20000;

export function useRealtimeRSVPs(eventId, onRefresh) {
  const callbackRef = useRef(onRefresh);

  // Sync callback reference on every render
  useEffect(() => {
    callbackRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!eventId) return;

    let cancelled = false;

    // Pause polling when the tab is hidden to avoid needless load; refresh once on
    // return so the organizer immediately sees anything that arrived while away.
    const tick = () => {
      if (cancelled || document.hidden) return;
      if (callbackRef.current) {
        callbackRef.current({ eventType: 'REFRESH', eventId });
      }
    };

    const interval = setInterval(tick, POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [eventId]);
}
