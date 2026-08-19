/**
 * WHAT AN ORGANIZER IS ALLOWED TO SEE OF THE PLATFORM CONFIG.
 *
 * `/payments/pricing-config` was mounted on `getPricingConfig` — the ADMIN
 * handler, which does `select('*')` on super_admin_config — behind nothing but
 * `requireAuth`. So every authenticated organizer was served the whole row:
 * our per-segment carrier cost, our gross margin, the platform commission, the
 * referral reward budget, and a super admin's user id. No organizer screen
 * ever read any of it; it was along for the ride.
 *
 * A leak like this is invisible: the pages render identically either way, so
 * nothing catches it except a test that names the fields that must never be
 * served. The failure mode this guards is a NEW private column being added to
 * the config table and silently published by a `select('*')`.
 */
require('./helpers/env');

const { describe, it } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const backendDir = path.resolve(__dirname, '..');

/** The full config row, including everything that must stay private. */
const FULL_CONFIG = {
  id: '00000000-0000-0000-0000-000000000000',
  pricing_tiers: [
    { key: 'essential', name: 'Essential', price_cents: 9900, max_guests: 100, features: ['rsvp_basic'] },
    { name: 'Bespoke', price_cents: 0, max_guests: 0, is_custom: true, features: [] },
  ],
  manual_payment_methods: [
    { id: 'm1', label: 'Bank transfer', details: 'IBAN 123', is_active: true },
    { id: 'm2', label: 'Retired account', details: 'IBAN 999', is_active: false },
  ],
  // ── none of the following may ever reach an organizer ──
  sms_rate_cents_per_credit: 1.1,
  sms_markup_percentage: 172.73,
  platform_commission_pct: 15,
  referral_reward_cents: 2500,
  referral_program_enabled: true,
  updated_by: '11111111-1111-4111-8111-111111111111',
  updated_at: '2026-08-18T00:00:00Z',
  sms_pricing_config: null,
  landing_stats: [],
};

function injectAbsolute(absFile, exportsObj) {
  const resolved = require.resolve(absFile);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsObj };
}

injectAbsolute(path.join(backendDir, 'config', 'supabase.js'), {
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: FULL_CONFIG, error: null }) }) }) }) },
});
injectAbsolute(path.join(backendDir, 'utils', 'configCache.js'), {
  getPlatformConfig: async () => FULL_CONFIG,
  invalidate: () => {},
  CONFIG_ID: '00000000-0000-0000-0000-000000000000',
  TTL_MS: 30000,
});
injectAbsolute(path.join(backendDir, 'utils', 'notificationService.js'), { sendEmailViaBrevo: async () => true });

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

let payload;
t.before(async () => {
  const res = makeRes();
  await ctrl.getOrganizerPricing({}, res, next);
  payload = res.body;
});

/** Every string that appears anywhere in the response, at any depth. */
function flatten(value, out = []) {
  if (value === null || value === undefined) return out;
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) { out.push(k); flatten(v, out); }
  } else {
    out.push(String(value));
  }
  return out;
}

describe('the organizer pricing endpoint', () => {
  it('serves the plans, with their keys', () => {
    assert.equal(payload.success, true);
    assert.equal(payload.config.pricing_tiers.length, 2);
    assert.equal(payload.config.pricing_tiers[0].key, 'essential');
    // The unkeyed one is keyed on the way out, so checkout always has an
    // identity to send back.
    assert.ok(payload.config.pricing_tiers[1].key, 'a tier went out without a key');
  });

  it('offers only the payment methods that are switched on', () => {
    const labels = payload.config.manual_payment_methods.map((m) => m.label);
    assert.deepEqual(labels, ['Bank transfer']);
    const everything = flatten(payload).join(' ');
    assert.equal(everything.includes('IBAN 999'), false, 'a disabled method\'s bank details were served');
  });

  it('publishes the LIST PRICE and never the cost or the margin', () => {
    // 1.1c cost at a 172.73% markup is a 3.0c list price. The client needs
    // exactly that one number; it used to be handed both private ones and
    // multiply them itself.
    assert.ok(Math.abs(payload.config.sms_list_price_cents_per_segment - 3.0) < 0.001,
      `expected ~3.0, got ${payload.config.sms_list_price_cents_per_segment}`);

    const keys = flatten(payload);
    ['sms_rate_cents_per_credit', 'sms_markup_percentage', 'platform_commission_pct',
     'referral_reward_cents', 'referral_program_enabled', 'updated_by'].forEach((forbidden) => {
      assert.equal(keys.includes(forbidden), false, `${forbidden} is being served to organizers`);
    });
  });

  it('does not leak the private VALUES either, under any name', () => {
    const values = flatten(payload).join(' ');
    assert.equal(values.includes('172.73'), false, 'the gross margin is in the payload');
    assert.equal(values.includes('11111111-1111-4111-8111-111111111111'), false, 'an admin user id is in the payload');
  });

  it('withholds the anti-abuse ramp-up thresholds', () => {
    // Publishing the exact thresholds tells an abuser how to stay under them.
    assert.equal('limits' in payload.smsPricing, false);
    assert.ok(payload.smsPricing.volume_discounts, 'but the quoting model is still there');
    assert.ok(payload.smsPricing.estimator);
  });

  it('is a whitelist, so a new private column is private by default', () => {
    // The guarantee is structural: `config` is built field by field rather
    // than spread from the row, so adding a column cannot publish it.
    const src = require('fs').readFileSync(
      path.join(backendDir, 'controllers', 'paymentController.js'), 'utf8');
    const fn = src.slice(src.indexOf('const getOrganizerPricing'));
    const body = fn.slice(0, fn.indexOf('\n};'));
    assert.equal(/\.\.\.config\b/.test(body), false, 'the config row is being spread into the response');
    assert.equal(/config,\s*$/m.test(body), false, 'the whole config row is being returned');
    assert.deepEqual(Object.keys(payload.config).sort(),
      ['manual_payment_methods', 'pricing_tiers', 'sms_list_price_cents_per_segment']);
  });
});

describe('the admin handler is untouched', () => {
  it('still exists separately, for the permission-gated route', () => {
    assert.equal(typeof ctrl.getPricingConfig, 'function');
    assert.notEqual(ctrl.getPricingConfig, ctrl.getOrganizerPricing);
  });

  it('the organizer route is not wired to it', () => {
    const routes = require('fs').readFileSync(path.join(backendDir, 'routes', 'paymentRoutes.js'), 'utf8');
    assert.match(routes, /router\.get\('\/pricing-config', requireAuth, getOrganizerPricing\)/);
  });
});
