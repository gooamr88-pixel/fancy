require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

// Spy on the email path so we can assert WHEN a receipt is dispatched.
let emailCalls = [];
injectModule('../../utils/notificationService', {
  sendEmailViaBrevo: async (...args) => { emailCalls.push(args); return true; },
  sendConfirmationEmail: async () => true,
  sendInvitationEmail: async () => ({ sent: true }),
  sendQRTicketEmail: async () => true,
});

// paymentController requires stripe at load.
injectModule('stripe', () => ({
  checkout: { sessions: { create: async () => ({ id: 'cs', url: 'u' }), retrieve: async () => ({}) } },
  customers: { create: async () => ({ id: 'cus' }) },
  refunds: { create: async () => ({ id: 're' }) },
}));

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { manualCashApproval, initiateManualPayment } = require('../controllers/paymentController');
const configCache = require('../utils/configCache');

t.beforeEach(() => { mock.reset(); emailCalls = []; configCache.invalidate(); });

const admin = { id: 'admin-1' };

// ─────────────────────────────────────────────────────────────────────────────
// manualCashApproval
// ─────────────────────────────────────────────────────────────────────────────

test('manualCashApproval requires eventId and amountCents (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(manualCashApproval, mockReq({ body: { eventId: 'evt-1' }, user: admin }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
});

test('manualCashApproval rejects a negative / non-integer / non-numeric amountCents (400)', async () => {
  mock.setResolver(() => ({}));
  for (const amountCents of [-100, 12.5, 'abc']) {
    const { res } = await invoke(manualCashApproval, mockReq({ body: { eventId: 'evt-1', amountCents }, user: admin }));
    assert.equal(res.statusCode, 400, `amountCents=${amountCents} should be rejected`);
    assert.equal(res.body.error, 'VALIDATION_ERROR');
  }
});

test('manualCashApproval completes an existing pending cash payment and activates the event', async () => {
  let eventUpdate = null;
  mock.setResolver(({ table, op, payload, filters }) => {
    if (table === 'event_payments' && op === 'select') {
      // The pending-payment lookup (status=pending).
      return { data: [{ id: 'pay-1', amount_cents: 5000, stripe_checkout_session_id: 'cs_x' }] };
    }
    if (table === 'event_payments' && op === 'update') {
      return { data: { id: 'pay-1', reference_number: 'CASH-ABC123', stripe_checkout_session_id: 'cs_x' } };
    }
    if (table === 'events' && op === 'update') { eventUpdate = payload; return { data: null }; }
    if (table === 'events' && op === 'select') {
      return { data: { title: 'Spring Gala', organizations: { email: 'org@example.com', name: 'Org Co' } } };
    }
    return {};
  });

  const { res } = await invoke(manualCashApproval, mockReq({ body: { eventId: 'evt-1', amountCents: 7900 }, user: admin }));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.paymentId, 'pay-1');
  // Event flips to paid + active.
  assert.equal(eventUpdate.is_paid, true);
  assert.equal(eventUpdate.status, 'active');
  // A receipt email is dispatched to the organisation.
  assert.equal(emailCalls.length, 1);
  assert.equal(emailCalls[0][0], 'org@example.com');
  assert.match(emailCalls[0][1], /Payment Approved/i);
});

test('manualCashApproval falls back to the approve_event_cash RPC when no pending row exists', async () => {
  let rpcCalled = false;
  mock.setResolver((s) => {
    if (s.table === 'event_payments' && s.op === 'select') return { data: [] }; // none pending
    if (s.op === 'rpc' && s.fn === 'approve_event_cash') { rpcCalled = true; return { data: { success: true, payment_id: 'pay-RPC' } }; }
    if (s.table === 'events' && s.op === 'select') return { data: { title: 'Wedding', organizations: { email: 'o@x.com', name: 'O' } } };
    return {};
  });

  const { res } = await invoke(manualCashApproval, mockReq({ body: { eventId: 'evt-2', amountCents: 14900 }, user: admin }));
  assert.equal(res.statusCode, 200);
  assert.equal(rpcCalled, true);
  assert.equal(res.body.paymentId, 'pay-RPC');
});

test('manualCashApproval surfaces an RPC failure as 400', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_payments' && s.op === 'select') return { data: [] };
    if (s.op === 'rpc' && s.fn === 'approve_event_cash') return { data: { success: false, error: 'ALREADY_PAID', message: 'Event already paid.' } };
    return {};
  });
  const { res } = await invoke(manualCashApproval, mockReq({ body: { eventId: 'evt-2', amountCents: 100 }, user: admin }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'ALREADY_PAID');
});

test('manualCashApproval still succeeds (200) when the org has no email — just skips the receipt', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'event_payments' && op === 'select') return { data: [{ id: 'pay-1', amount_cents: 5000 }] };
    if (table === 'event_payments' && op === 'update') return { data: { id: 'pay-1', reference_number: 'CASH-NOEMAIL' } };
    if (table === 'events' && op === 'update') return { data: null };
    if (table === 'events' && op === 'select') return { data: { title: 'W', organizations: { email: null, name: 'O' } } };
    return {};
  });
  const { res } = await invoke(manualCashApproval, mockReq({ body: { eventId: 'evt-1', amountCents: 7900 }, user: admin }));
  assert.equal(res.statusCode, 200);
  assert.equal(emailCalls.length, 0); // no email address => no receipt, but approval still completes
});

// ─────────────────────────────────────────────────────────────────────────────
// initiateManualPayment — pre-inserts the pending record the admin later approves
// ─────────────────────────────────────────────────────────────────────────────

test('initiateManualPayment requires a tierName (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(initiateManualPayment, mockReq({ params: { eventId: 'evt-1' }, body: {}, user: admin }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
});

test('initiateManualPayment returns the existing pending record instead of creating a duplicate', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'event_payments' && op === 'select') return { data: [{ id: 'pay-existing', reference_number: 'CASH-OLD', amount_cents: 7900 }] };
    if (table === 'super_admin_config') return { data: { pricing_tiers: [{ name: 'Essential', price_cents: 7900 }] } };
    return {};
  });
  const { res } = await invoke(initiateManualPayment, mockReq({
    params: { eventId: 'evt-1' }, body: { tierName: 'Essential' }, user: admin,
  }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.referenceNumber, 'CASH-OLD');
  // No new insert when a pending record already exists.
  assert.equal(mock.calls.some(c => c.table === 'event_payments' && c.op === 'insert'), false);
});

test('initiateManualPayment creates a pending record with a CASH- reference for a valid tier', async () => {
  let inserted = null;
  mock.setResolver(({ table, op, payload }) => {
    if (table === 'event_payments' && op === 'select') return { data: [] }; // none pending
    if (table === 'super_admin_config') return { data: { pricing_tiers: [{ name: 'Premium', price_cents: 14900, max_guests: 300 }] } };
    if (table === 'event_payments' && op === 'insert') { inserted = payload; return { data: { id: 'pay-new', reference_number: payload.reference_number } }; }
    return {};
  });
  const { res } = await invoke(initiateManualPayment, mockReq({
    params: { eventId: 'evt-1' }, body: { tierName: 'premium' }, user: admin, // case-insensitive tier match
  }));
  assert.equal(res.statusCode, 200);
  assert.equal(inserted.amount_cents, 14900);
  assert.equal(inserted.status, 'pending');
  assert.equal(inserted.payment_method, 'cash_manual');
  assert.match(inserted.reference_number, /^CASH-[A-Z0-9]{6}$/);
});

test('initiateManualPayment rejects an unknown tier (400)', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'event_payments') return { data: [] };
    if (table === 'super_admin_config') return { data: { pricing_tiers: [{ name: 'Essential', price_cents: 7900 }] } };
    return {};
  });
  const { res } = await invoke(initiateManualPayment, mockReq({
    params: { eventId: 'evt-1' }, body: { tierName: 'Diamond' }, user: admin,
  }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'INVALID_TIER');
});
