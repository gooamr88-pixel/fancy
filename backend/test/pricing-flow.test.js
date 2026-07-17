/**
 * End-to-end test for the unified pricing flow, exercising the REAL controller
 * functions (getPublicPricing, createCheckoutSession) with fake Supabase/Stripe
 * modules injected into the require cache. Nothing here reimplements controller
 * logic — it asserts on what the shipped code actually produces.
 *
 * Proves:
 *   1. A super-admin tier's exact features/price flow through the public endpoint.
 *   2. Public output is sanitized (internal fields never leak).
 *   3. Stripe is charged the DB-resolved price_cents — never a client-supplied price.
 */

require('./helpers/env');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const backendDir = path.resolve(__dirname, '..');

// ── The dummy tier under test ($99.50, two custom features) ───────────────────
const DUMMY_TIER = {
  name: 'Test VIP 2026',
  price_cents: 9950,
  max_guests: 1000,
  features: ['seating_map', 'qr_checkin'],
  recommended: true,
  is_custom: false,
  price_label: '',
  cta_label: '',
  description: 'Verification tier',
  internal_secret_cost: 1234, // must NEVER reach the public endpoint
};
// ── A Contact-Sales tier: no fixed price, must never be checkout-able ─────────
const CUSTOM_TIER = {
  name: 'Enterprise+',
  price_cents: 0,
  max_guests: 0,
  features: [],
  recommended: false,
  is_custom: true,
  price_label: 'Custom',
  cta_label: 'Contact Sales',
  description: 'Custom quote tier',
};
const PRICING_TIERS = [DUMMY_TIER, CUSTOM_TIER];

// ── Fake Supabase: canned rows for the exact chains the controller calls ──────
function makeSupabaseMock() {
  const builder = (table) => {
    const b = {
      select: () => b,
      eq: () => b,
      limit: () => b,
      update: () => b,
      insert: () => b,
      single: () => {
        if (table === 'super_admin_config') {
          return Promise.resolve({ data: { pricing_tiers: PRICING_TIERS }, error: null });
        }
        if (table === 'events') {
          return Promise.resolve({
            data: {
              org_id: 'org_1',
              organizations: { stripe_customer_id: 'cus_TEST_123', email: 'organizer@example.com', name: 'Verifier Org' },
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
    };
    return b;
  };
  return { from: (table) => builder(table) };
}

// ── Fake Stripe: capture the payload handed to checkout.sessions.create ────────
const stripeCapture = {};
function fakeStripeFactory(key) {
  stripeCapture.secretKeyUsed = key;
  return {
    customers: { create: async () => ({ id: 'cus_NEW_unused' }) },
    checkout: {
      sessions: {
        create: async (payload) => {
          stripeCapture.payload = payload;
          return { id: 'cs_test_123', url: 'https://stripe.test/checkout/cs_test_123' };
        },
      },
    },
  };
}

// ── Inject mocks BEFORE loading the controller ────────────────────────────────
function injectAbsolute(absFile, exportsObj) {
  const resolved = require.resolve(absFile);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsObj };
}
function injectPackage(name, exportsObj) {
  const resolved = require.resolve(name, { paths: [backendDir] });
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsObj };
}

process.env.STRIPE_SECRET_KEY = 'sk_test_PROOF_FROM_ENV';
process.env.FRONTEND_URL = 'https://app.fancyrsvp.test';

injectAbsolute(path.join(backendDir, 'config', 'supabase.js'), { supabase: makeSupabaseMock() });
injectAbsolute(path.join(backendDir, 'utils', 'configCache.js'), {
  getPlatformConfig: async () => ({ pricing_tiers: PRICING_TIERS }),
  invalidate: () => {},
  CONFIG_ID: '00000000-0000-0000-0000-000000000000',
  TTL_MS: 30000,
});
injectAbsolute(path.join(backendDir, 'utils', 'notificationService.js'), { sendEmailViaBrevo: async () => true });
injectPackage('stripe', fakeStripeFactory);

const ctrl = require(path.join(backendDir, 'controllers', 'paymentController.js'));

// ── Minimal Express res double ────────────────────────────────────────────────
function makeRes() {
  return {
    statusCode: 200, body: undefined, headers: {},
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    set(k, v) { this.headers[k] = v; return this; },
  };
}
const next = (err) => { throw err; };

// Shared results, populated once before the assertions.
let publicTier;
let publicHeaders;
let checkoutBody;
let customCheckoutBody;
let customCheckoutStatus;

before(async () => {
  // STEP 2 — public endpoint
  const res = makeRes();
  await ctrl.getPublicPricing({}, res, next);
  publicTier = (res.body.tiers || []).find((t) => t.name === 'Test VIP 2026');
  publicHeaders = res.headers;

  // STEP 3 & 4 — select tier at event creation, checkout. Client body LIES about price.
  const req = {
    params: { eventId: 'evt_1' },
    body: { tierName: 'Test VIP 2026', price_cents: 1, unit_amount: 1, amount: 1 },
    headers: { origin: 'https://app.fancyrsvp.test' }
  };
  const res2 = makeRes();
  await ctrl.createCheckoutSession(req, res2, next);
  checkoutBody = res2.body;

  // STEP 5 — attempting to check out an is_custom ("Contact Sales") tier
  // directly must be rejected, never silently activated or charged.
  const req3 = {
    params: { eventId: 'evt_1' },
    body: { tierName: 'Enterprise+' },
    headers: { origin: 'https://app.fancyrsvp.test' }
  };
  const res3 = makeRes();
  await ctrl.createCheckoutSession(req3, res3, next);
  customCheckoutBody = res3.body;
  customCheckoutStatus = res3.statusCode;
});

// ── Public endpoint: features + price sync ────────────────────────────────────
test('public endpoint returns the tier with exact price_cents', () => {
  assert.ok(publicTier, 'tier "Test VIP 2026" should be present');
  assert.equal(publicTier.price_cents, 9950);
});

test('public endpoint returns the exact custom features in order', () => {
  // getPublicPricing now converts feature keys to human-readable labels via the registry
  assert.deepEqual(publicTier.features, ['Seating chart designer', 'QR code check-in']);
});

test('public endpoint preserves the recommended flag', () => {
  assert.equal(publicTier.recommended, true);
});

test('public endpoint sanitizes internal fields (no leak)', () => {
  assert.equal(publicTier.internal_secret_cost, undefined);
});

test('public endpoint sets a CDN cache header', () => {
  assert.match(publicHeaders['Cache-Control'] || '', /max-age=60/);
});

// ── Checkout: server-authoritative price ──────────────────────────────────────
test('Stripe client is constructed from the env secret key', () => {
  assert.equal(stripeCapture.secretKeyUsed, 'sk_test_PROOF_FROM_ENV');
});

test('Stripe unit_amount is exactly 9950, pulled from the DB tier', () => {
  const unitAmount = stripeCapture.payload.line_items[0].price_data.unit_amount;
  assert.equal(unitAmount, 9950);
  assert.equal(unitAmount, DUMMY_TIER.price_cents);
});

test('Stripe charge IGNORES the client-supplied price', () => {
  const unitAmount = stripeCapture.payload.line_items[0].price_data.unit_amount;
  assert.notEqual(unitAmount, 1); // the body claimed price_cents/unit_amount = 1
});

test('Stripe metadata carries the resolved tier name', () => {
  assert.equal(stripeCapture.payload.metadata.tier_name, 'Test VIP 2026');
});

test('checkout returns a session URL to the client', () => {
  assert.equal(checkoutBody.success, true);
  assert.match(checkoutBody.checkoutUrl || '', /stripe\.test/);
});

// ── Checkout: is_custom ("Contact Sales") tiers are never checkout-able ───────
test('checkout rejects an is_custom tier instead of activating or charging it', () => {
  assert.equal(customCheckoutStatus, 400);
  assert.equal(customCheckoutBody.success, false);
  assert.equal(customCheckoutBody.error, 'CUSTOM_TIER');
});
