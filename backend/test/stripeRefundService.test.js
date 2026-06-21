require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');

// ── Stripe mock: require('stripe') returns a factory; calling it yields a client.
const stripeCalls = { refunds: [] };
let stripeRefundsImpl = async (args, opts) => ({ id: 're_mock', ...args, _opts: opts });
const stripeClient = {
  refunds: { create: (args, opts) => { stripeCalls.refunds.push({ args, opts }); return stripeRefundsImpl(args, opts); } },
};
injectModule('stripe', () => stripeClient);

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { refundEventPayment } = require('../services/stripeRefundService');

t.beforeEach(() => {
  mock.reset();
  stripeCalls.refunds.length = 0;
  stripeRefundsImpl = async (args) => ({ id: 're_mock', ...args });
});

test('a completed card payment issues a real Stripe refund and marks it refunded', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'event_payments' && op === 'update') return { data: null };
    if (table === 'events' && op === 'update') return { data: null };
    return {};
  });

  const result = await refundEventPayment(
    { id: 'pay-1', event_id: 'evt-1', status: 'completed', amount_cents: 7900, payment_method: 'stripe', stripe_payment_intent_id: 'pi_1' },
    { actorId: 'admin-1', reason: 'customer request' },
  );

  assert.equal(result.offline, false);
  assert.equal(result.stripeRefundId, 're_mock');
  assert.equal(result.amountCents, 7900);
  assert.equal(stripeCalls.refunds.length, 1);
  // Full refund reverts the event.
  const evtUpdate = mock.calls.find(c => c.table === 'events' && c.op === 'update');
  assert.equal(evtUpdate.payload.is_paid, false);
  assert.equal(evtUpdate.payload.status, 'paused');
});

test('the Stripe idempotency key is keyed on payment id + amount (dedupes double-clicks)', async () => {
  mock.setResolver(({ table }) => (table ? { data: null } : {}));
  await refundEventPayment(
    { id: 'pay-9', event_id: 'evt-1', status: 'completed', amount_cents: 5000, payment_method: 'stripe', stripe_payment_intent_id: 'pi_9' },
    { actorId: 'admin-1' },
  );
  assert.equal(stripeCalls.refunds[0].opts.idempotencyKey, 'refund_pay-9_5000');
});

test('a partial refund keeps the payment completed and does NOT revert the event', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'event_payments' && op === 'update') return { data: null };
    if (table === 'events' && op === 'update') return { data: null };
    return {};
  });

  const result = await refundEventPayment(
    { id: 'pay-2', event_id: 'evt-2', status: 'completed', amount_cents: 10000, payment_method: 'stripe', stripe_payment_intent_id: 'pi_2' },
    { actorId: 'admin-1', amountCents: 4000 },
  );

  assert.equal(result.amountCents, 4000);
  assert.equal(stripeCalls.refunds[0].args.amount, 4000);
  const payUpdate = mock.calls.find(c => c.table === 'event_payments' && c.op === 'update');
  assert.equal(payUpdate.payload.status, 'completed'); // partial stays completed
  assert.equal(mock.calls.some(c => c.table === 'events' && c.op === 'update'), false);
});

test('an offline (cash_manual) payment performs the book-keeping refund with no Stripe call', async () => {
  mock.setResolver(({ table }) => (table ? { data: null } : {}));
  const result = await refundEventPayment(
    { id: 'pay-3', event_id: 'evt-3', status: 'completed', amount_cents: 7900, payment_method: 'cash_manual', stripe_payment_intent_id: null },
    { actorId: 'admin-1' },
  );
  assert.equal(result.offline, true);
  assert.equal(result.stripeRefundId, null);
  assert.equal(stripeCalls.refunds.length, 0);
});

test('refunding a non-completed payment is rejected with NOT_REFUNDABLE', async () => {
  mock.setResolver(() => ({}));
  await assert.rejects(
    () => refundEventPayment({ id: 'pay-4', status: 'pending', amount_cents: 100, payment_method: 'stripe' }, { actorId: 'a' }),
    (err) => err.code === 'NOT_REFUNDABLE',
  );
  assert.equal(stripeCalls.refunds.length, 0);
});
