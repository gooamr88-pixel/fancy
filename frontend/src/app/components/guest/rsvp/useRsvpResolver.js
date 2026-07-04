'use client';

import { useEffect, useReducer, useRef } from 'react';
import { publicApiFetch } from '../../../utils/publicApi';

/**
 * useRsvpResolver — the SINGLE entry-context resolver for the guest RSVP experience.
 *
 * Replaces the three divergent resolution paths (public link, email token, private
 * SMS `?g=`) with one state machine. Given a normalized entry context it performs
 * exactly ONE resolution pass and returns a normalized phase the orchestrator renders
 * from — so the guest never sees mock/empty data flash before the real event loads.
 *
 * Entry contexts:
 *   { kind: 'token', token }                        → email one-click (signed token)
 *   { kind: 'slug', slug, guestId?, partyId? }      → public link / private SMS (?g=) / invite (?party_id=)
 *
 * Normalized result:
 *   phase: 'resolving' | 'ready' | 'locked' | 'closed' | 'underReview'
 *        | 'paymentRequired' | 'unavailable'
 *   event, guest, allowEdits, intendedResponse, error, refetch()
 */

const RESPONDED = new Set(['yes', 'no', 'maybe']);

const storageKeyFor = (slug) => `fancy_rsvp_${slug}`;

const initialState = {
  phase: 'resolving',
  event: null,
  guest: null,
  allowEdits: false,
  intendedResponse: null,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'RESET':       return { ...initialState };
    case 'RESOLVED':    return { ...state, ...action.payload };
    case 'FORCE_LOCK':  return { ...state, phase: 'locked', guest: { ...state.guest, ...action.guest } };
    case 'UNLOCK_EDIT': return { ...state, phase: 'ready' };
    default:            return state;
  }
}

/** Reads the device-remembered rsvp id for this event (localStorage fallback). */
export function rememberedId(slug) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKeyFor(slug));
    return raw ? (JSON.parse(raw)?.id || null) : null;
  } catch { return null; }
}

export function rememberGuest(slug, id) {
  if (typeof window === 'undefined' || !id) return;
  try { window.localStorage.setItem(storageKeyFor(slug), JSON.stringify({ id })); } catch { /* storage unavailable */ }
}

async function resolveToken(token, signal) {
  let data;
  try {
    data = await publicApiFetch(`/public/rsvp/invite?token=${encodeURIComponent(token)}`, { signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    const e = new Error(err.message || 'This invitation link is invalid or has expired.');
    e.phase = 'unavailable';
    throw e;
  }
  const guest = data.guest || null;
  // Token flow is one-shot: an already-answered guest is locked (they edit via the
  // full form link if the host allows it). Deadline closes an un-answered invite.
  if (guest && RESPONDED.has(guest.response)) {
    return { phase: 'locked', event: data.event, guest, allowEdits: false, intendedResponse: data.intendedResponse || null };
  }
  if (data.deadlinePassed) {
    return { phase: 'closed', event: data.event, guest, allowEdits: false, intendedResponse: data.intendedResponse || null };
  }
  return { phase: 'ready', event: data.event, guest, allowEdits: false, intendedResponse: data.intendedResponse || null };
}

async function resolveSlug({ slug, guestId, partyId }, signal) {
  // Identity priority mirrors the legacy form: explicit invite token (?party_id) →
  // private SMS id (?g) → device-remembered id. Whichever we have is sent as the
  // per-guest unlock token, which the backend validates belongs to this event
  // (unlocks private events AND returns that party's prefill/lock state).
  const unlockId = partyId || guestId || rememberedId(slug);
  const query = unlockId ? `?party_id=${encodeURIComponent(unlockId)}` : '';

  let data;
  try {
    data = await publicApiFetch(`/public/events/${slug}${query}`, { signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (err.status === 402) { const e = new Error('not live'); e.phase = 'paymentRequired'; throw e; }
    if (err.status === 403 && err.code === 'EVENT_UNDER_REVIEW') { const e = new Error('review'); e.phase = 'underReview'; throw e; }
    if (err.status === 403 && err.code === 'EVENT_CLOSED') { const e = new Error('closed'); e.phase = 'closed'; throw e; }
    const e = new Error('This event could not be found.'); e.phase = 'unavailable'; throw e;
  }

  const event = data.event;
  const guest = data.guestRsvp || null;
  const allowEdits = !!event?.allow_guest_edits;

  // An already-answered guest ALWAYS lands on the read-only locked card first; the
  // orchestrator surfaces an "Update my response" action only when allowEdits is true,
  // which calls openEdit() to reveal the prefilled form. The input form is never
  // reachable otherwise (requirement #3 — no duplicate responses).
  if (guest && RESPONDED.has(guest.response)) {
    return { phase: 'locked', event, guest, allowEdits, intendedResponse: null };
  }
  return { phase: 'ready', event, guest, allowEdits, intendedResponse: null };
}

export function useRsvpResolver(context) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Serialize the context so the effect re-runs only when the identity actually changes.
  const key = JSON.stringify(context || {});
  const ctxRef = useRef(context);

  useEffect(() => {
    ctxRef.current = context;
  });

  const run = useRef(0);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const controller = new AbortController();
    const myRun = ++run.current;
    dispatch({ type: 'RESET' });

    (async () => {
      try {
        let result;
        if (ctx.kind === 'token') {
          if (!ctx.token) { const e = new Error('No invitation token was provided. Please use the link from your email.'); e.phase = 'unavailable'; throw e; }
          result = await resolveToken(ctx.token, controller.signal);
        } else {
          result = await resolveSlug(ctx, controller.signal);
        }
        if (myRun === run.current) dispatch({ type: 'RESOLVED', payload: { ...result, error: null } });
      } catch (err) {
        if (err.name === 'AbortError' || myRun !== run.current) return;
        dispatch({ type: 'RESOLVED', payload: { phase: err.phase || 'unavailable', error: err.message } });
      }
    })();

    return () => controller.abort();
  }, [key]);

  return {
    ...state,
    /** Re-run resolution (used after a successful edit-submit or reconciliation). */
    refetch: () => { run.current++; dispatch({ type: 'RESET' });
      const ctx = ctxRef.current;
      (async () => {
        try {
          const result = ctx.kind === 'token'
            ? await resolveToken(ctx.token)
            : await resolveSlug(ctx);
          dispatch({ type: 'RESOLVED', payload: { ...result, error: null } });
        } catch (err) {
          dispatch({ type: 'RESOLVED', payload: { phase: err.phase || 'unavailable', error: err.message } });
        }
      })();
    },
    /** Lock the experience after a fresh submit recorded a response. */
    lock: (guest) => dispatch({ type: 'FORCE_LOCK', guest }),
    /** Reopen the form for a host-permitted edit (RF-2). */
    openEdit: () => dispatch({ type: 'UNLOCK_EDIT' }),
  };
}
