require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

// ── Stripe mock ──
let retrieveImpl = async () => ({});
const createCalls = [];
const stripeClient = {
  checkout: {
    sessions: {
      retrieve: (id) => retrieveImpl(id),
      create: async (args) => { createCalls.push(args); return { id: 'cs_new', url: 'https://stripe.test/cs_new' }; },
    },
  },
  customers: { create: async () => ({ id: 'cus_new' }) },
};
injectModule('stripe', () => stripeClient);

// Avoid real email dispatch in manualCashApproval etc.
injectModule('../../utils/notificationService', {
  sendEmailViaBrevo: async () => true,
  sendConfirmationEmail: async () => true,
  sendInvitationEmail: async () => ({ sent: true }),
  sendQRTicketEmail: async () => true,
});

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { verifyCheckoutSession, createCheckoutSession, purchaseSMSCredits } = require('../controllers/paymentController');
const configCache = require('../utils/configCache');

t.beforeEach(() => { mock.reset(); createCalls.length = 0; retrieveImpl = async () => ({}); configCache.invalidate(); });

// ─────────────────────────────────────────────────────────────────────────────
// verifyCheckoutSession
// ─────────────────────────────────────────────────────────────────────────────

test('verify rejects a malformed session_id (400) before calling Stripe', async () => {
  const { res } = await invoke(verifyCheckoutSession, mockReq({ query: { session_id: 'not-a-session' }, user: { id: 'u1' } }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
});

test('verify returns 403 when the caller does not own the session\'s event (IDOR guard)', async () => {
  retrieveImpl = async () => ({ id: 'cs_abc', payment_status: 'paid', metadata: { event_id: 'evt-1', type: 'event_fee' } });
  mock.setResolver(({ table }) => {
    if (table === 'events') return { data: { organizations: { owner_user_id: 'owner-OTHER' } } };
    return {};
  });

  const { res } = await invoke(verifyCheckoutSession, mockReq({ query: { session_id: 'cs_abc' }, user: { id: 'attacker' } }));
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'FORBIDDEN');
});

test('verify rejects a non-admin when the session has NO event_id (hardening fix)', async () => {
  // A session with no event_id metadata cannot be ownership-checked. A non-admin
  // must be rejected outright rather than slipping past the guard.
  retrieveImpl = async () => ({ id: 'cs_noevt', payment_status: 'paid', metadata: { type: 'event_fee' } });
  mock.setResolver(() => ({}));
  const { res } = await invoke(verifyCheckoutSession, mockReq({ query: { session_id: 'cs_noevt' }, user: { id: 'organizer-1' } }));
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'FORBIDDEN');
  // Crucially, fulfillment must NOT have run (no event_payments writes).
  assert.equal(mock.calls.some(c => c.table === 'event_payments'), false);
});

test('verify still lets a super admin handle an event-less session', async () => {
  retrieveImpl = async () => ({ id: 'cs_noevt', payment_status: 'paid', metadata: { type: 'event_fee' } });
  mock.setResolver(() => ({})); // fulfill no-ops on missing event_id metadata
  const { res } = await invoke(verifyCheckoutSession, mockReq({ query: { session_id: 'cs_noevt' }, user: { id: 'admin', isSuperAdmin: true } }));
  assert.equal(res.statusCode, 200);
});

test('verify returns paid:false for an unpaid session without fulfilling', async () => {
  retrieveImpl = async () => ({ id: 'cs_abc', payment_status: 'unpaid', metadata: { event_id: 'evt-1', type: 'event_fee' } });
  mock.setResolver(({ table }) => {
    if (table === 'events') return { data: { organizations: { owner_user_id: 'owner-1' } } };
    return {};
  });

  const { res } = await invoke(verifyCheckoutSession, mockReq({ query: { session_id: 'cs_abc' }, user: { id: 'owner-1' } }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.paid, false);
  assert.equal(mock.calls.some(c => c.table === 'event_payments' && c.op === 'insert'), false);
});

test('verify fulfills a paid, owned session (idempotent fulfillment runs)', async () => {
  retrieveImpl = async () => ({ id: 'cs_abc', payment_status: 'paid', amount_total: 7900, currency: 'usd', metadata: { event_id: 'evt-1', type: 'event_fee' } });
  mock.setResolver(({ table, op }) => {
    if (table === 'events' && op === 'select') return { data: { organizations: { owner_user_id: 'owner-1' } } };
    if (table === 'event_payments' && op === 'select') return { data: [] };
    if (table === 'events' && op === 'update') return { data: null };
    if (table === 'event_payments' && op === 'insert') return { data: null };
    return {};
  });

  const { res } = await invoke(verifyCheckoutSession, mockReq({ query: { session_id: 'cs_abc' }, user: { id: 'owner-1' } }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.paid, true);
  assert.equal(res.body.type, 'event_fee');
});

test('super admin can verify any session (ownership check bypassed)', async () => {
  retrieveImpl = async () => ({ id: 'cs_abc', payment_status: 'paid', amount_total: 7900, currency: 'usd', metadata: { event_id: 'evt-1', type: 'event_fee' } });
  mock.setResolver(({ table, op }) => {
    if (table === 'event_payments' && op === 'select') return { data: [{ id: 'pay-1' }] }; // already processed
    return {};
  });

  const { res } = await invoke(verifyCheckoutSession, mockReq({ query: { session_id: 'cs_abc' }, user: { id: 'admin', isSuperAdmin: true } }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.alreadyProcessed, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// createCheckoutSession — IDOR-safety: keys off the PATH eventId, not the body
// ─────────────────────────────────────────────────────────────────────────────

test('createCheckout puts the PATH eventId in Stripe metadata, ignoring a spoofed body eventId', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'super_admin_config') return { data: { pricing_tiers: [{ name: 'Essential', price_cents: 7900, max_guests: 100 }] } };
    if (table === 'events') return { data: { org_id: 'org-1', organizations: { stripe_customer_id: 'cus_1', email: 'o@x.com', name: 'Org' } } };
    return {};
  });

  const req = mockReq({ params: { eventId: 'evt-OWNED' }, body: { eventId: 'evt-VICTIM', tierName: 'Essential' }, user: { id: 'owner-1' } });
  const { res } = await invoke(createCheckoutSession, req);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.checkoutUrl);
  assert.equal(createCalls[0].metadata.event_id, 'evt-OWNED');
  assert.equal(createCalls[0].metadata.tier_name, 'Essential');
});

test('createCheckout rejects an unknown pricing tier (400)', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'super_admin_config') return { data: { pricing_tiers: [{ name: 'Essential', price_cents: 7900 }] } };
    return {};
  });
  const req = mockReq({ params: { eventId: 'evt-1' }, body: { tierName: 'Platinum' }, user: { id: 'owner-1' } });
  const { res } = await invoke(createCheckoutSession, req);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'INVALID_TIER');
});

// ─────────────────────────────────────────────────────────────────────────────
// purchaseSMSCredits — input bounds
// ─────────────────────────────────────────────────────────────────────────────

test('purchaseSMSCredits enforces the 50–50000 credit bounds', async () => {
  mock.setResolver(() => ({}));
  for (const creditCount of [49, 50001]) {
    const { res } = await invoke(purchaseSMSCredits, mockReq({ params: { eventId: 'evt-1' }, body: { creditCount }, user: { id: 'owner-1' } }));
    assert.equal(res.statusCode, 400, `creditCount=${creditCount} should be rejected`);
    assert.equal(res.body.error, 'VALIDATION_ERROR');
  }
});

test('purchaseSMSCredits rejects a non-numeric / non-integer creditCount (400, no NaN→Stripe 500)', async () => {
  mock.setResolver(() => ({}));
  for (const creditCount of ['abc', 100.5, null]) {
    const { res } = await invoke(purchaseSMSCredits, mockReq({ params: { eventId: 'evt-1' }, body: { creditCount }, user: { id: 'owner-1' } }));
    assert.equal(res.statusCode, 400, `creditCount=${creditCount} should be rejected`);
    assert.equal(res.body.error, 'VALIDATION_ERROR');
  }
  // No Stripe checkout session is ever created for an invalid amount.
  assert.equal(createCalls.length, 0);
});

test('purchaseSMSCredits requires an existing Stripe customer (first event must be paid)', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'super_admin_config') return { data: { sms_rate_cents_per_credit: 8, sms_markup_percentage: 40 } };
    if (table === 'events') return { data: { org_id: 'org-1', organizations: { stripe_customer_id: null } } };
    return {};
  });
  const { res } = await invoke(purchaseSMSCredits, mockReq({ params: { eventId: 'evt-1' }, body: { creditCount: 500 }, user: { id: 'owner-1' } }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'NO_STRIPE_CUSTOMER');
});
