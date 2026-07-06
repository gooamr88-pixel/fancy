'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from '../../../utils/toast';

/**
 * useIdempotentRsvpSubmit — the SINGLE submit path for every RSVP surface.
 *
 * Guarantees:
 *  • Double-submit proof: an in-flight ref rejects re-entry even before React
 *    re-renders the disabled button (covers rapid double-clicks / Enter spam).
 *  • Server-side duplicate protection: the backend's response-state lock
 *    (DUPLICATE_RSVP once a party has answered) plus its email/phone
 *    uniqueness constraints are what actually prevent a response from being
 *    recorded twice — there is no client-generated request key the backend
 *    checks, so none is sent.
 *  • Reconciliation: if the network drops the RESPONSE (write may have landed), we
 *    re-read the guest record before declaring failure, and treat a recorded
 *    response as success — no false errors, no duplicate retries.
 *  • Unified error mapping: DUPLICATE_RSVP / ALREADY_RESPONDED → lock; EVENT_CLOSED
 *    and GUEST_LIMIT_REACHED → professional toast; everything else → toast + retry.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/** Did a (possibly lost) submit actually record a response for this party? Never throws. */
async function didResponseLand(partyId) {
  if (!partyId) return null;
  try {
    const res = await fetch(`${API_URL}/public/rsvp/guest/${partyId}`);
    if (!res.ok) return null;
    const d = await res.json().catch(() => ({}));
    const g = d?.data?.guest;
    return g && ['yes', 'no', 'maybe'].includes(g.response) ? g : null;
  } catch { return null; }
}

export function useIdempotentRsvpSubmit({ onSuccess, onLocked, messages = {} } = {}) {
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const submit = useCallback(async ({ url, body, reconcileId }) => {
    // Hard re-entry guard — independent of the disabled-button render cycle.
    if (inFlight.current) return { ok: false, reason: 'IN_FLIGHT' };
    inFlight.current = true;
    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error === 'DUPLICATE_RSVP' || data.error === 'ALREADY_RESPONDED') {
          onLocked?.(data);
          return { ok: false, reason: 'LOCKED', data };
        }
        if (data.error === 'EVENT_CLOSED') {
          toast.error(messages.closed || 'This event is no longer accepting RSVPs.');
          return { ok: false, reason: 'EVENT_CLOSED', data };
        }
        if (data.error === 'GUEST_LIMIT_REACHED') {
          toast.error(messages.full || 'This event has reached its guest limit. Please contact the host.');
          return { ok: false, reason: 'GUEST_LIMIT_REACHED', data };
        }
        // A 4xx here means the server rejected the payload outright (e.g. a
        // required custom question, a too-large party) — nothing was written,
        // so there's no point reconciling. Show the server's actual reason
        // instead of falling through to the generic network-failure toast.
        if (res.status >= 400 && res.status < 500) {
          toast.error(data.message || messages.failed || 'We couldn’t save your RSVP. Please check the form and try again.');
          return { ok: false, reason: data.error || 'VALIDATION_ERROR', data };
        }
        throw new Error(data.message || 'Failed to submit RSVP.');
      }

      const payload = data.data || {};
      onSuccess?.(payload);
      return { ok: true, data: payload };
    } catch (err) {
      // Possible lost-response: reconcile before declaring failure.
      const landed = await didResponseLand(reconcileId);
      if (landed) {
        onSuccess?.({ reconciled: true, partyId: reconcileId, guest: landed, response: landed.response });
        return { ok: true, reconciled: true, data: { partyId: reconcileId, response: landed.response, qrToken: landed.qrToken || null } };
      }
      toast.error(messages.failed || 'We couldn’t save your RSVP. Please check your connection and try again.');
      return { ok: false, reason: 'NETWORK', error: err };
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }, [onSuccess, onLocked, messages.closed, messages.full, messages.failed]);

  return { submit, submitting };
}
