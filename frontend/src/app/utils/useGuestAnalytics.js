'use client';

import { useCallback, useRef, useEffect } from 'react';

/* ═══════════════════════════════════════════════════════════════
   FANCY RSVP — Guest Analytics Hook
   Tracks guest engagement events (page views, RSVP funnel, actions)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Generates or retrieves a persistent session ID for this browser tab.
 */
function getSessionId() {
  if (typeof window === 'undefined') return null;
  let sessionId = sessionStorage.getItem('fancy_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    sessionStorage.setItem('fancy_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Custom hook for tracking guest engagement analytics.
 *
 * @param {string} slug - The event slug
 * @returns {{ trackEvent: (eventType: string, metadata?: object) => void }}
 *
 * Usage:
 *   const { trackEvent } = useGuestAnalytics(slug);
 *   trackEvent('page_view');
 *   trackEvent('rsvp_started');
 *   trackEvent('calendar_added', { provider: 'google' });
 */
export function useGuestAnalytics(slug) {
  const sentEventsRef = useRef(new Set());
  const sessionId = typeof window !== 'undefined' ? getSessionId() : null;

  const trackEvent = useCallback((eventType, metadata = {}) => {
    if (!slug || slug === 'demo-wedding' || slug === 'demo') return;
    if (typeof window === 'undefined') return;

    // Deduplicate page_view (only send once per session)
    if (eventType === 'page_view') {
      const key = `${slug}:${eventType}`;
      if (sentEventsRef.current.has(key)) return;
      sentEventsRef.current.add(key);
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    const body = {
      eventType,
      sessionId,
      metadata,
      referrer: document.referrer || null,
    };

    // Fire-and-forget — never let analytics block the guest experience
    try {
      if (navigator.sendBeacon) {
        // Use sendBeacon for reliability (works even on page unload)
        const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
        navigator.sendBeacon(`${apiUrl}/public/events/${slug}/analytics`, blob);
      } else {
        fetch(`${apiUrl}/public/events/${slug}/analytics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          keepalive: true,
        }).catch(() => {}); // Silently ignore errors
      }
    } catch {
      // Never throw from analytics
    }
  }, [slug, sessionId]);

  return { trackEvent, sessionId };
}

/**
 * Track RSVP form funnel steps automatically.
 * Call this when the RSVP step changes.
 */
export function useRsvpFunnelTracking(slug, step) {
  const { trackEvent } = useGuestAnalytics(slug);
  const trackedStepsRef = useRef(new Set());

  useEffect(() => {
    if (!step || trackedStepsRef.current.has(step)) return;
    trackedStepsRef.current.add(step);

    const stepMap = {
      1: 'rsvp_step_1',
      2: 'rsvp_step_2',
      3: 'rsvp_step_3',
      35: 'rsvp_step_3', // maybe flow
      36: 'rsvp_step_3', // decline flow
      4: 'rsvp_step_4',
      5: 'rsvp_completed',
    };

    const eventType = stepMap[step];
    if (eventType) {
      trackEvent(eventType, { step });
    }
  }, [step, trackEvent]);
}

/**
 * Track page abandonment (when guest leaves without completing RSVP).
 * Uses beforeunload to fire a beacon.
 */
export function useAbandonmentTracking(slug, currentStep, isCompleted) {
  const { trackEvent } = useGuestAnalytics(slug);

  useEffect(() => {
    if (isCompleted || !currentStep || currentStep < 2) return;

    const handleUnload = () => {
      trackEvent('rsvp_abandoned', { lastStep: currentStep });
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [slug, currentStep, isCompleted, trackEvent]);
}
