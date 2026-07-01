require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase, eqVal } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');

// Inject the mock Supabase BEFORE requiring the service under test.
const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { fulfillCheckoutSession, handleChargeRefunded, handleDisputeEvent } =
  require('../services/paymentFulfillment');

const t = require('node:test');
t.beforeEach(() => mock.reset());

// ─────────────────────────────────────────────────────────────────────────────
// fulfillCheckoutSession — event_fee
// ─────────────────────────────────────────────────────────────────────────────

test('event_fee: first delivery marks event pending_review and records the payment', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'event_payments' && op === 'select') return { data: [] };      // no existing
    if (table === 'events' && op === 'update') return { data: { id: 'evt-1' } }; // optimistic lock succeeds
    if (table === 'event_payments' && op === 'insert') return { data: null };
    return {};
  });

  const result = await fulfillCheckoutSession({
    id: 'cs_test_1', payment_intent: 'pi_1', amount_total: 7900, currency: 'usd',
    metadata: { event_id: 'evt-1', type: 'event_fee' },
  });

  assert.equal(result.alreadyProcessed, false);
  assert.equal(result.type, 'event_fee');

  const evtUpdate = mock.calls.find(c => c.table === 'events' && c.op === 'update');
  assert.equal(evtUpdate.payload.is_paid, true);
  // A self-serve card payment must NOT go live on its own — it holds for review.
  assert.equal(evtUpdate.payload.status, 'pending_review');
});

test('event_fee: duplicate session id short-circuits as alreadyProcessed (no insert)', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'event_payments' && op === 'select') return { data: [{ id: 'pay-1' }] };
    return {};
  });

  const result = await fulfillCheckoutSession({
    id: 'cs_test_1', payment_intent: 'pi_1', amount_total: 7900, currency: 'usd',
    metadata: { event_id: 'evt-1', type: 'event_fee' },
  });

  assert.equal(result.alreadyProcessed, true);
  assert.equal(mock.calls.some(c => c.table === 'event_payments' && c.op === 'insert'), false);
  assert.equal(mock.calls.some(c => c.table === 'events' && c.op === 'update'), false);
});

test('event_fee: unique-violation race on insert is treated as alreadyProcessed', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'event_payments' && op === 'select') return { data: [] };
    if (table === 'events' && op === 'update') return { data: null };
    if (table === 'event_payments' && op === 'insert') return { error: { code: '23505', message: 'duplicate key' } };
    return {};
  });

  const result = await fulfillCheckoutSession({
    id: 'cs_test_2', payment_intent: 'pi_2', amount_total: 7900, currency: 'usd',
    metadata: { event_id: 'evt-1', type: 'event_fee' },
  });

  assert.equal(result.alreadyProcessed, true);
  assert.equal(result.type, 'event_fee');
});

// ─────────────────────────────────────────────────────────────────────────────
// fulfillCheckoutSession — sms_credits
// ─────────────────────────────────────────────────────────────────────────────

test('sms_credits: delegates to record_sms_purchase RPC and reports first delivery', async () => {
  let rpcParams = null;
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'record_sms_purchase') {
      rpcParams = s.params;
      return { data: { success: true, already_processed: false } };
    }
    return {};
  });

  const result = await fulfillCheckoutSession({
    id: 'cs_test_3', payment_intent: 'pi_3', amount_total: 5000, currency: 'usd',
    metadata: { event_id: 'evt-9', type: 'sms_credits', credit_count: '500' },
  });

  assert.equal(result.type, 'sms_credits');
  assert.equal(result.alreadyProcessed, false);
  assert.equal(rpcParams.p_event_id, 'evt-9');
  assert.equal(rpcParams.p_credits, 500);
  assert.equal(rpcParams.p_payment_intent, 'pi_3');
});

test('sms_credits: duplicate webhook delivery is reported as alreadyProcessed', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'record_sms_purchase') return { data: { success: true, already_processed: true } };
    return {};
  });

  const result = await fulfillCheckoutSession({
    id: 'cs_test_3', payment_intent: 'pi_3', amount_total: 5000, currency: 'usd',
    metadata: { event_id: 'evt-9', type: 'sms_credits', credit_count: '500' },
  });

  assert.equal(result.alreadyProcessed, true);
});

test('sms_credits: a non-integer credit_count throws (never silently credits zero)', async () => {
  mock.setResolver(() => ({}));
  await assert.rejects(
    fulfillCheckoutSession({
      id: 'cs_x', payment_intent: 'pi_x', amount_total: 1, currency: 'usd',
      metadata: { event_id: 'evt-9', type: 'sms_credits', credit_count: 'abc' },
    }),
    /Invalid credit_count/,
  );
});

test('missing metadata is a safe no-op (never wedges the webhook into retries)', async () => {
  mock.setResolver(() => ({}));
  const result = await fulfillCheckoutSession({ id: 'cs_y', metadata: {} });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, 'missing_metadata');
});

// ─────────────────────────────────────────────────────────────────────────────
// handleChargeRefunded
// ─────────────────────────────────────────────────────────────────────────────

test('charge.refunded on an event fee reverts the event to unpaid/paused', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'event_payments' && op === 'select') return { data: { id: 'pay-1', event_id: 'evt-1', status: 'completed' } };
    if (table === 'event_payments' && op === 'update') return { data: null };
    if (table === 'events' && op === 'update') return { data: null };
    return {};
  });

  const result = await handleChargeRefunded({ payment_intent: 'pi_1' });

  assert.equal(result.type, 'event_fee');
  const evtUpdate = mock.calls.find(c => c.table === 'events' && c.op === 'update');
  assert.equal(evtUpdate.payload.is_paid, false);
  assert.equal(evtUpdate.payload.status, 'paused');
});

test('charge.refunded is idempotent when the payment is already refunded', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'event_payments' && op === 'select') return { data: { id: 'pay-1', event_id: 'evt-1', status: 'refunded' } };
    return {};
  });

  const result = await handleChargeRefunded({ payment_intent: 'pi_1' });
  assert.equal(result.alreadyProcessed, true);
  assert.equal(mock.calls.some(c => c.table === 'events' && c.op === 'update'), false);
});

test('charge.refunded with no payment_intent is skipped', async () => {
  mock.setResolver(() => ({}));
  const result = await handleChargeRefunded({});
  assert.equal(result.skipped, 'missing_payment_intent');
});

// ─────────────────────────────────────────────────────────────────────────────
// handleDisputeEvent
// ─────────────────────────────────────────────────────────────────────────────

test('dispute is upserted on stripe_dispute_id and linked to the payment', async () => {
  let upsertPayload = null;
  mock.setResolver(({ table, op, payload }) => {
    if (table === 'event_payments' && op === 'select') return { data: { id: 'pay-7' } };
    if (table === 'payment_disputes' && op === 'upsert') { upsertPayload = payload; return { data: null }; }
    return {};
  });

  const result = await handleDisputeEvent({
    id: 'dp_1', charge: 'ch_1', payment_intent: 'pi_7', status: 'needs_response',
    amount: 7900, currency: 'usd', reason: 'fraudulent',
  });

  assert.equal(result.disputeId, 'dp_1');
  assert.equal(result.paymentId, 'pay-7');
  assert.equal(upsertPayload.stripe_dispute_id, 'dp_1');
  assert.equal(upsertPayload.payment_id, 'pay-7');
});
