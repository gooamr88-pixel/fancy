require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');

/**
 * PER-EVENT USAGE BOOKKEEPING IS BATCHED.
 *
 * Three things follow every delivered message: the wallet's "last used" stamp,
 * the organization's lifetime delivered counter, and the low-balance check.
 *
 * Written inline, each costs a query — four extra round trips per message. On a
 * 20,000-recipient campaign that is 80,000 queries to maintain a timestamp
 * rendered as "2 hours ago", a counter gating a cap that steps at 200 and 1,000,
 * and a threshold check that fires once per depletion. None of the three needs
 * per-message accuracy, so sends accumulate and flush per event.
 *
 * These tests pin the property that makes it safe: batching may lose precision on
 * a crash, but it must never lose COUNT — an under-counted delivery total would
 * hold a legitimate organizer at a lower sending cap than they have earned.
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const smsDispatch = require('../services/smsDispatch');
const { __flushUsageForTests: flushUsage } = smsDispatch;

const EVENT_A = '11111111-1111-4111-8111-111111111111';
const EVENT_B = '22222222-2222-4222-8222-222222222222';
const ORG = '33333333-3333-4333-8333-333333333333';
const PHONE = '+15551234567';

t.beforeEach(() => mock.reset());

/**
 * Drive N successful sends through the real dispatch path and report how many
 * times each side-effect actually hit the database.
 */
async function sendMany(count, eventId = EVENT_A) {
  const counters = { walletUpdates: 0, incrementCalls: 0, incrementTotal: 0, eventLookups: 0, ledgerUpdates: 0 };

  mock.setResolver((s) => {
    if (s.op === 'rpc' && /deduct_sms_credit/.test(s.fn)) {
      return { data: { success: true, wallet_id: 'w1', ledger_id: 'l1' } };
    }
    if (s.op === 'rpc' && s.fn === 'increment_sms_delivered') {
      counters.incrementCalls++;
      counters.incrementTotal += Number(s.params?.p_count) || 0;
      return {};
    }
    if (s.table === 'sms_credit_ledger' && s.op === 'update') { counters.ledgerUpdates++; return {}; }
    if (s.table === 'sms_credit_wallets' && s.op === 'update') { counters.walletUpdates++; return {}; }
    if (s.table === 'sms_credit_wallets') {
      // Comfortably above the low threshold, so no alert email is attempted.
      return { data: { id: 'w1', credits_purchased: 10000, credits_used: 1, credits_remaining: 9999 } };
    }
    if (s.table === 'events') { counters.eventLookups++; return { data: { org_id: ORG } }; }
    return {};
  });

  const consented = new Set([PHONE]);
  const twilio = { messages: { create: async () => ({ sid: 'SM_x' }) } };

  for (let i = 0; i < count; i++) {
    await smsDispatch.__sendRecipientForTests({
      eventId, phone: PHONE, body: 'hi', segments: 1,
      idemKey: `k-${eventId}-${i}`, twilio, fromNumber: '+15550000000',
      optedOut: new Set(), consented,
    });
  }
  return counters;
}

test('the ledger stamp still happens once PER MESSAGE', async () => {
  const c = await sendMany(20);

  // This is the one write that cannot be batched: the Twilio SID has to land on
  // that specific ledger row, and the carrier cost with it.
  assert.equal(c.ledgerUpdates, 20);
});

test('wallet and counter writes do NOT scale with message count', async () => {
  const c = await sendMany(50);

  // Nothing has flushed yet — the timer has not fired.
  assert.equal(c.walletUpdates, 0, '50 messages must not mean 50 wallet writes');
  assert.equal(c.incrementCalls, 0, 'nor 50 counter round trips');

  await flushUsage();

  assert.equal(c.walletUpdates, 1, 'one write for the whole batch');
  assert.equal(c.incrementCalls, 1, 'one counter call for the whole batch');
});

test('the delivered COUNT survives batching exactly', async () => {
  const c = await sendMany(37);
  await flushUsage();

  assert.equal(c.incrementTotal, 37,
    'under-counting would hold an organizer at a lower sending cap than they have earned');
});

test('each event is flushed separately', async () => {
  const a = await sendMany(5, EVENT_A);
  await flushUsage();
  const b = await sendMany(3, EVENT_B);
  await flushUsage();

  assert.equal(a.incrementTotal, 5);
  assert.equal(b.incrementTotal, 3, 'two events must not have their counts merged');
});

test('a flush with nothing pending is a no-op', async () => {
  mock.reset();
  mock.setResolver(() => ({}));
  await flushUsage();
  assert.equal(mock.calls.length, 0, 'an idle server must not poll the database');
});

test('the org lookup is cached across flushes', async () => {
  const c = await sendMany(10);
  await flushUsage();
  const first = c.eventLookups;

  // Same event again: event → organization never changes, so it must not be
  // re-resolved on every flush of a long-running campaign.
  await sendMany(10);
  await flushUsage();

  assert.equal(c.eventLookups, first, 'the second flush should reuse the cached org id');
});
