require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');

/**
 * LOW-BALANCE ALERTS — fire once, but never lose one to a failed send.
 *
 * Two failure modes pull in opposite directions, and the alert has to survive
 * both:
 *
 *   • Send-then-stamp mails the customer on EVERY message once they cross the
 *     threshold — hundreds of identical emails during a campaign.
 *   • Stamp-then-send fixes that, but a single delivery failure then silences the
 *     warning permanently. The entire value of this alert is that it arrives
 *     while the organizer can still top up; one that never arrives is worse than
 *     none, because the system believes it warned them.
 *
 * The resolution is claim → send → RELEASE ON FAILURE, backed by a second,
 * independent guard: emailService.dispatch dedupes on (kind, ref) through a
 * UNIQUE index, so a retry can never deliver an alert the customer already got.
 * Each mechanism covers the other's failure mode.
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

// Scripted per test so delivery can be made to succeed, fail, or report a
// duplicate without touching the network.
let dispatchResult = { sent: true, skipped: false };
let dispatchThrows = false;
const dispatchCalls = [];
injectModule('../../services/emailService', {
  dispatch: async (payload) => {
    dispatchCalls.push(payload);
    if (dispatchThrows) throw new Error('smtp unavailable');
    return dispatchResult;
  },
});

const smsDispatch = require('../services/smsDispatch');
const { __flushUsageForTests: flushUsage } = smsDispatch;

const EVENT = '11111111-1111-4111-8111-111111111111';
const PHONE = '+15551234567';

/** Wallet writes that set or clear the alert stamps. */
function alertStampWrites() {
  return mock.calls.filter((c) =>
    c.table === 'sms_credit_wallets' && c.op === 'update' && c.payload &&
    ('low_balance_notified_at' in c.payload || 'empty_notified_at' in c.payload));
}

/**
 * Drive one successful send on a wallet that is already below the threshold,
 * then flush so the alert path runs.
 */
async function sendOnLowBalance({ alreadyNotified = false } = {}) {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && /deduct_sms_credit/.test(s.fn)) {
      return { data: { success: true, wallet_id: 'w1', ledger_id: 'l1' } };
    }
    if (s.table === 'sms_credit_wallets' && s.op === 'update') {
      // The claim: succeeds unless the stamp is already set.
      const claiming = s.payload && s.payload.low_balance_notified_at;
      return { data: (claiming && alreadyNotified) ? [] : [{ id: 'w1' }] };
    }
    if (s.table === 'sms_credit_wallets') {
      return { data: {
        id: 'w1', credits_purchased: 1000, credits_used: 900, credits_remaining: 100,
        low_balance_notified_at: alreadyNotified ? '2026-08-01T00:00:00Z' : null,
        empty_notified_at: null,
      } };
    }
    if (s.table === 'events') {
      return { data: { org_id: 'org-1', title: 'Spring Gala', organizations: { name: 'Sam', email: 'sam@x.co' } } };
    }
    return {};
  });

  await smsDispatch.__sendRecipientForTests({
    eventId: EVENT, phone: PHONE, body: 'hi', segments: 1,
    idemKey: `k-${Math.random()}`, twilio: { messages: { create: async () => ({ sid: 'SM_x' }) } },
    fromNumber: '+15550000000', optedOut: new Set(), consented: new Set([PHONE]),
  });

  await flushUsage();
  // The alert is fire-and-forget inside the flush; let its microtasks settle.
  await new Promise((r) => setTimeout(r, 20));
}

t.beforeEach(() => {
  mock.reset();
  dispatchCalls.length = 0;
  dispatchResult = { sent: true, skipped: false };
  dispatchThrows = false;
});

test('crossing the threshold sends exactly one alert', async () => {
  await sendOnLowBalance();

  assert.equal(dispatchCalls.length, 1);
  assert.equal(dispatchCalls[0].kind, 'sms_messages_low');
  assert.equal(dispatchCalls[0].ref, `event:${EVENT}`);
});

test('the alert speaks in messages, not credits or percentages of a quota', async () => {
  await sendOnLowBalance();
  const { subject, html } = dispatchCalls[0];

  assert.match(subject, /100 text messages left/);
  for (const jargon of [/credit/i, /allowance/i, /segment/i, /wallet/i]) {
    assert.doesNotMatch(html, jargon, `the alert must not say ${jargon}`);
  }
  // It must also say what happens if they do nothing, or the reader panics.
  assert.match(html, /email/i);
});

test('an already-warned event does not warn again', async () => {
  await sendOnLowBalance({ alreadyNotified: true });
  assert.equal(dispatchCalls.length, 0,
    'the claim is what stops hundreds of identical emails during a campaign');
});

/* ── The fix: a failed alert must not be lost ───────────────────────────── */

test('a THROWN send releases the claim so the next flush retries', async () => {
  dispatchThrows = true;
  await sendOnLowBalance();

  const released = alertStampWrites().some((c) => c.payload.low_balance_notified_at === null);
  assert.equal(released, true,
    'stamp-then-send without a release silences the warning permanently on one bad send');
});

test('an UNDELIVERED send releases the claim too', async () => {
  dispatchResult = { sent: false, skipped: false };
  await sendOnLowBalance();

  const released = alertStampWrites().some((c) => c.payload.low_balance_notified_at === null);
  assert.equal(released, true);
});

test('a DUPLICATE is treated as delivered, not retried', async () => {
  // email_log already holds this alert — it reached the customer earlier.
  dispatchResult = { sent: false, skipped: 'duplicate' };
  await sendOnLowBalance();

  const released = alertStampWrites().some((c) => c.payload.low_balance_notified_at === null);
  assert.equal(released, false,
    'releasing here would re-attempt an alert the customer already received');
});

test('a missing organizer email releases the claim rather than burning it', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && /deduct_sms_credit/.test(s.fn)) {
      return { data: { success: true, wallet_id: 'w1', ledger_id: 'l1' } };
    }
    if (s.table === 'sms_credit_wallets' && s.op === 'update') return { data: [{ id: 'w1' }] };
    if (s.table === 'sms_credit_wallets') {
      return { data: {
        id: 'w1', credits_purchased: 1000, credits_used: 900, credits_remaining: 100,
        low_balance_notified_at: null, empty_notified_at: null,
      } };
    }
    // No address on file.
    if (s.table === 'events') return { data: { org_id: 'org-1', title: 'Gala', organizations: { name: 'Sam', email: null } } };
    return {};
  });

  await smsDispatch.__sendRecipientForTests({
    eventId: EVENT, phone: PHONE, body: 'hi', segments: 1,
    idemKey: `k-${Math.random()}`, twilio: { messages: { create: async () => ({ sid: 'SM_x' }) } },
    fromNumber: '+15550000000', optedOut: new Set(), consented: new Set([PHONE]),
  });
  await flushUsage();
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(dispatchCalls.length, 0, 'nothing to send to');
  const released = alertStampWrites().some((c) => c.payload.low_balance_notified_at === null);
  assert.equal(released, true,
    'an address added later should still get the warning');
});
