import { describe, test, expect } from 'vitest';

import { describeTicketError } from '../src/app/ticket/[token]/page';
import { PublicApiError } from '../src/app/utils/publicApi';

/**
 * WHAT A BROKEN TICKET TELLS THE GUEST.
 *
 * The page had one sentence for every failure — "Could not load your ticket.
 * Please try again later." — and it was wrong for three of the four causes.
 *
 * A ticket token is signed and long-lived, so it outlives the rows it points at.
 * The party can be deleted (clearing and re-importing a guest list mints new party
 * IDs and orphans every ticket already texted out), and the event can be
 * unpublished. Those links will never work. Telling a guest at the door to wait
 * sends them to wait for something that is not coming.
 *
 * So the property these tests actually defend is not the wording — it is
 * `retryable`: it must be true only when waiting can change the outcome.
 */

const fail = (code) => new PublicApiError('boom', { status: 404, code });

/** Every cause the backend can return for GET /public/ticket/:token. */
const PERMANENT = ['INVALID_TICKET', 'GUEST_NOT_FOUND', 'EVENT_INACTIVE', 'EVENT_NOT_FOUND'];

describe('describeTicketError', () => {
  /* ── The regression: wrong advice on permanent failures ─────────────────── */

  test.each(PERMANENT)('%s is not retryable — waiting cannot fix it', (code) => {
    expect(describeTicketError(fail(code), false).retryable).toBe(false);
  });

  test.each(PERMANENT)('%s never tells the guest to try again later', (code) => {
    const { title, hint } = describeTicketError(fail(code), false);
    expect(`${title} ${hint}`.toLowerCase()).not.toContain('try again');
  });

  test('a deleted party is explained as a list change, and points at the host', () => {
    const { title, hint, retryable } = describeTicketError(fail('GUEST_NOT_FOUND'), false);

    // The guest did nothing wrong and their ticket was not tampered with; the
    // list moved underneath them. Blaming the ticket here sends them looking in
    // the wrong place.
    expect(title).toMatch(/guest list/i);
    expect(hint).toMatch(/resend|host/i);
    expect(retryable).toBe(false);
  });

  test('the four causes do not share a message', () => {
    const titles = PERMANENT.map((c) => describeTicketError(fail(c), false).title);
    expect(new Set(titles).size).toBe(PERMANENT.length);
  });

  /* ── Transient faults keep the retry ────────────────────────────────────── */

  test('a network fault IS retryable — this is the one case where waiting helps', () => {
    const err = new PublicApiError('Network error', { status: 0, code: 'NETWORK_ERROR' });
    expect(describeTicketError(err, false).retryable).toBe(true);
  });

  test('an unrecognised code falls back to retryable rather than to a dead end', () => {
    // An unknown code is more likely a new server fault than a permanently dead
    // link, and offering a retry is the recoverable way to be wrong.
    expect(describeTicketError(fail('SOMETHING_NEW'), false).retryable).toBe(true);
    expect(describeTicketError(new Error('thrown by something else'), false).retryable).toBe(true);
  });

  /* ── Arabic is a real translation, not a passthrough ────────────────────── */

  test.each([...PERMANENT, 'NETWORK_ERROR'])('%s is translated for RTL guests', (code) => {
    const ar = describeTicketError(fail(code), true);
    const en = describeTicketError(fail(code), false);

    expect(ar.title).toMatch(/[؀-ۿ]/);
    expect(ar.hint).toMatch(/[؀-ۿ]/);
    expect(ar.title).not.toBe(en.title);
    // Whether to show the retry button is a fact about the failure, not about
    // the language — these must not drift apart.
    expect(ar.retryable).toBe(en.retryable);
  });
});
