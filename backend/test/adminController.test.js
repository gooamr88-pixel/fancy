require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

// adminController -> stripeRefundService -> require('stripe') at load.
injectModule('stripe', () => ({ refunds: { create: async () => ({ id: 're_x' }) } }));

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { grantSmsCredits, updateEventAdmin, declineManualPayment, setUserRole } = require('../controllers/adminController');

t.beforeEach(() => mock.reset());

const admin = { id: 'admin-1' };

// ── grantSmsCredits ──

test('grant-sms rejects out-of-range credit amounts (400)', async () => {
  mock.setResolver(() => ({}));
  for (const credits of [0, -5, 50001]) {
    const { res } = await invoke(grantSmsCredits, mockReq({ params: { eventId: 'evt-1' }, body: { credits }, user: admin }));
    assert.equal(res.statusCode, 400, `credits=${credits}`);
  }
});

test('grant-sms ensures a wallet then increments via the atomic RPC (200)', async () => {
  let rpc = null;
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'increment_sms_credits') { rpc = s.params; return { data: null }; }
    return {};
  });
  const { res } = await invoke(grantSmsCredits, mockReq({ params: { eventId: 'evt-1' }, body: { credits: 250 }, user: admin }));
  assert.equal(res.statusCode, 200);
  assert.equal(rpc.p_event_id, 'evt-1');
  assert.equal(rpc.p_credit_amount, 250);
  assert.ok(mock.calls.some(c => c.table === 'sms_credit_wallets' && c.op === 'upsert'));
});

// ── updateEventAdmin ──

test('updateEventAdmin rejects an invalid status (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(updateEventAdmin, mockReq({ params: { eventId: 'evt-1' }, body: { status: 'nonsense' }, user: admin }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'INVALID_STATUS');
});

test('updateEventAdmin sets manual_override when an admin force-marks an event paid', async () => {
  let payload = null;
  mock.setResolver(({ table, op, payload: p }) => {
    if (table === 'events' && op === 'update') { payload = p; return { data: { id: 'evt-1', title: 'X', status: 'active', is_paid: true } }; }
    return {};
  });
  const { res } = await invoke(updateEventAdmin, mockReq({ params: { eventId: 'evt-1' }, body: { isPaid: true }, user: admin }));
  assert.equal(res.statusCode, 200);
  assert.equal(payload.is_paid, true);
  assert.equal(payload.manual_override, true); // audit trail that this was an admin override
});

test('updateEventAdmin requires at least one field (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(updateEventAdmin, mockReq({ params: { eventId: 'evt-1' }, body: {}, user: admin }));
  assert.equal(res.statusCode, 400);
});

// ── declineManualPayment ──

test('declineManualPayment 404s when the payment is missing', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'event_payments') return { data: null, error: { message: 'no rows' } };
    return {};
  });
  const { res } = await invoke(declineManualPayment, mockReq({ params: { paymentId: 'p1' }, body: {}, user: admin }));
  assert.equal(res.statusCode, 404);
});

test('declineManualPayment refuses to decline a non-pending payment (400)', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'event_payments') return { data: { id: 'p1', event_id: 'evt-1', status: 'completed', amount_cents: 7900, payment_method: 'cash_manual' } };
    return {};
  });
  const { res } = await invoke(declineManualPayment, mockReq({ params: { paymentId: 'p1' }, body: {}, user: admin }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'NOT_PENDING');
});

test('declineManualPayment marks a pending payment failed (money never arrived)', async () => {
  let payload = null;
  mock.setResolver(({ table, op, payload: p }) => {
    if (table === 'event_payments' && op === 'select') return { data: { id: 'p1', event_id: 'evt-1', status: 'pending', amount_cents: 7900, payment_method: 'cash_manual' } };
    if (table === 'event_payments' && op === 'update') { payload = p; return { data: null }; }
    return {};
  });
  const { res } = await invoke(declineManualPayment, mockReq({ params: { paymentId: 'p1' }, body: { reason: 'no transfer received' }, user: admin }));
  assert.equal(res.statusCode, 200);
  assert.equal(payload.status, 'failed'); // not 'refunded' — nothing was collected
});

// ── setUserRole self-demotion guard ──

test('setUserRole forbids a super admin from demoting themselves (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(setUserRole, mockReq({ body: { userId: 'admin-1', role: 'organizer' }, user: admin }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'SELF_DEMOTION_FORBIDDEN');
});

test('setUserRole rejects an invalid role (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(setUserRole, mockReq({ body: { userId: 'u2', role: 'wizard' }, user: admin }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'INVALID_ROLE');
});
