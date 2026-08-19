/**
 * RENAMING A PLAN MUST NOT CHANGE WHAT AN UPGRADE COSTS.
 *
 * An upgrade is charged the DIFFERENCE between the new plan and the one
 * already paid for. That "already paid for" used to be resolved by matching
 * `events.tier_name` against the display names in the pricing config, so the
 * moment an admin renamed a plan the lookup missed, `previousTier` came back
 * null, `isUpgrade` went false — and the organizer was charged the new plan's
 * FULL price on top of what they had already paid. The same null also disabled
 * the "not an upgrade" guard, so a CHEAPER plan could be sold at full price.
 *
 * These drive the real createCheckoutSession and assert on the amount handed
 * to Stripe.
 */

require('./helpers/env');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const backendDir = path.resolve(__dirname, '..');

const ESSENTIAL = { key: 'essential', name: 'Essential', price_cents: 9900, max_guests: 100, features: ['rsvp_basic'], is_custom: false };
const SIGNATURE = { key: 'signature', name: 'Signature', price_cents: 24900, max_guests: 300, features: ['rsvp_basic', 'seating_map'], is_custom: false };

// The admin has renamed Essential. Its KEY is untouched — that is the point.
const RENAMED_ESSENTIAL = { ...ESSENTIAL, name: 'Essential (Legacy 2026)' };
let PRICING_TIERS = [RENAMED_ESSENTIAL, SIGNATURE];

/** The event under test: bought Essential back when it was still called that. */
let EVENT_ROW = {
  org_id: 'org_1',
  is_paid: true,
  tier_key: 'essential',
  tier_name: 'Essential',
  tier_price_cents: 9900,
  organizations: { stripe_customer_id: 'cus_1', email: 'o@example.com', name: 'Org' },
};

function makeSupabaseMock() {
  const builder = (table) => {
    const b = {
      select: () => b, eq: () => b, neq: () => b, or: () => b, ilike: () => b, is: () => b,
      limit: () => b, update: () => b, insert: () => b, order: () => b,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => {
        if (table === 'super_admin_config') return Promise.resolve({ data: { pricing_tiers: PRICING_TIERS }, error: null });
        if (table === 'events') return Promise.resolve({ data: EVENT_ROW, error: null });
        return Promise.resolve({ data: null, error: null });
      },
      then: (resolve) => resolve({ data: [], error: null, count: 0 }),
    };
    return b;
  };
  return { from: (table) => builder(table) };
}

const stripeCapture = {};
function fakeStripeFactory() {
  return {
    customers: { create: async () => ({ id: 'cus_NEW' }) },
    checkout: {
      sessions: {
        create: async (payload) => {
          stripeCapture.payload = payload;
          return { id: 'cs_1', url: 'https://stripe.test/cs_1' };
        },
      },
    },
  };
}

function injectAbsolute(absFile, exportsObj) {
  const resolved = require.resolve(absFile);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsObj };
}
function injectPackage(name, exportsObj) {
  const resolved = require.resolve(name, { paths: [backendDir] });
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsObj };
}

process.env.STRIPE_SECRET_KEY = 'sk_test_x';
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

function makeRes() {
  return {
    statusCode: 200, body: undefined, headers: {},
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    set(k, v) { this.headers[k] = v; return this; },
  };
}
const next = (err) => { throw err; };

async function checkout(body) {
  const res = makeRes();
  stripeCapture.payload = undefined;
  await ctrl.createCheckoutSession(
    { params: { eventId: 'evt_1' }, body, headers: { origin: 'https://app.fancyrsvp.test' } },
    res, next,
  );
  return res;
}

let upgradeAfterRename;

before(async () => {
  upgradeAfterRename = await checkout({ tierKey: 'signature' });
});

test('an upgrade after a rename charges only the difference', () => {
  assert.ok(stripeCapture.payload, `no Stripe session was created: ${JSON.stringify(upgradeAfterRename.body)}`);
  const amount = stripeCapture.payload.line_items[0].price_data.unit_amount;
  // 24900 - 9900. Before the fix this was 24900: the full price, again.
  assert.equal(amount, 15000, 'the customer was charged the full price of the new plan after their old one was renamed');
});

test('the session is marked as an upgrade and credits the right amount', () => {
  const md = stripeCapture.payload.metadata;
  assert.equal(md.is_upgrade, '1');
  assert.equal(md.previous_amount_cents, '9900');
  assert.equal(md.previous_tier_key, 'essential');
  assert.equal(md.tier_key, 'signature', 'the plan identity must travel to fulfillment');
});

test('a plan renamed mid-checkout still resolves from the key the client sent', async () => {
  // The browser rendered the pricing page, the admin renamed the plan, the
  // organizer then pressed Pay. Sending the name alone used to 400 with
  // "Pricing tier 'Signature' not found".
  PRICING_TIERS = [RENAMED_ESSENTIAL, { ...SIGNATURE, name: 'Signature 2027' }];
  const res = await checkout({ tierKey: 'signature', tierName: 'Signature' });
  assert.notEqual(res.statusCode, 400, `checkout was rejected: ${JSON.stringify(res.body)}`);
  assert.ok(stripeCapture.payload, 'no session created for a renamed-mid-checkout plan');
  PRICING_TIERS = [RENAMED_ESSENTIAL, SIGNATURE];
});

test('a legacy client sending only the name still checks out', async () => {
  const res = await checkout({ tierName: 'Signature' });
  assert.notEqual(res.statusCode, 400, `legacy checkout was rejected: ${JSON.stringify(res.body)}`);
  assert.equal(stripeCapture.payload.line_items[0].price_data.unit_amount, 15000);
});

test('a DELETED previous plan credits the price snapshotted at purchase', async () => {
  // A key cannot resolve what no longer exists. Falling through to "not an
  // upgrade" would bill the full price a second time.
  PRICING_TIERS = [SIGNATURE];
  const res = await checkout({ tierKey: 'signature' });
  assert.notEqual(res.statusCode, 409, `checkout refused: ${JSON.stringify(res.body)}`);
  assert.equal(stripeCapture.payload.line_items[0].price_data.unit_amount, 15000,
    'the credit for a deleted plan must come from events.tier_price_cents');
  PRICING_TIERS = [RENAMED_ESSENTIAL, SIGNATURE];
});

test('refuses rather than double-charging when nothing identifies the paid plan', async () => {
  // Paid, plan gone, and no price was ever snapshotted (a pre-migration row).
  const saved = EVENT_ROW;
  EVENT_ROW = { ...EVENT_ROW, tier_key: 'vanished', tier_name: 'Vanished', tier_price_cents: null };
  PRICING_TIERS = [SIGNATURE];

  const res = await checkout({ tierKey: 'signature' });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'PLAN_UNRESOLVABLE');

  EVENT_ROW = saved;
  PRICING_TIERS = [RENAMED_ESSENTIAL, SIGNATURE];
});

test('still refuses a downgrade dressed up as an upgrade', async () => {
  // With previousTier null this guard used to be skipped entirely, so a
  // cheaper plan could be sold at full price as an "upgrade".
  const res = await checkout({ tierKey: 'essential' });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'NOT_AN_UPGRADE');
});
