'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from '../../../utils/toast';

/**
 * useIdempotentRsvpSubmit — the SINGLE submit path for every RSVP surface.
 *
 * Guarantees:
 *  • Double-submit proof: an in-flight ref rejects re-entry even before React
 *    re-renders the disabled button (covers rapid double-clicks / Enter spam).
 *  • Client idempotency key: a stable key per logical attempt, sent as a header so
 *    a retried/duplicated request is recognizable; pairs with the server's
 *    DUPLICATE_RSVP guard so a recorded response is never double-counted.
 *  • Reconciliation: if the network drops the RESPONSE (write may have landed), we
 *    re-read the guest record before declaring failure, and treat a recorded
 *    response as success — no false errors, no duplicate retries.
 *  • Unified error mapping: DUPLICATE_RSVP / ALREADY_RESPONDED → lock; EVENT_CLOSED
 *    and GUEST_LIMIT_REACHED → professional toast; everything else → toast + retry.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

const newIdempotencyKey = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
  const keyRef = useRef(null);

  const submit = useCallback(async ({ url, body, reconcileId }) => {
    // Hard re-entry guard — independent of the disabled-button render cycle.
    if (inFlight.current) return { ok: false, reason: 'IN_FLIGHT' };
    inFlight.current = true;
    setSubmitting(true);
    // One idempotency key per logical attempt; reused only across transparent retries.
    if (!keyRef.current) keyRef.current = newIdempotencyKey();

    try {
      const res = await fetch(`${API_URL}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': keyRef.current },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error === 'DUPLICATE_RSVP' || data.error === 'ALREADY_RESPONDED') {
          keyRef.current = null;
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
        throw new Error(data.message || 'Failed to submit RSVP.');
      }

      keyRef.current = null;            // success → fresh key for any future edit
      const payload = data.data || {};
      onSuccess?.(payload);
      return { ok: true, data: payload };
    } catch (err) {
      // Possible lost-response: reconcile before declaring failure.
      const landed = await didResponseLand(reconcileId);
      if (landed) {
        keyRef.current = null;
        onSuccess?.({ reconciled: true, partyId: reconcileId, guest: landed, response: landed.response });
        return { ok: true, reconciled: true, data: { partyId: reconcileId, response: landed.response } };
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
