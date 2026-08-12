require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');
const { mockReq, invoke } = require('./helpers/http');

/**
 * THE PROMO-CODE EVENT ACTUALLY REACHING STRIPE — executed, not read.
 *
 * `smsAddonActivation.test.js` asserts this fix against the SOURCE, because
 * `purchaseSMSCredits` caches its Stripe client in a module-private singleton
 * that cannot be re-doubled between tests in one process. Reading the code
 * proves the branch is written; it does not prove the handler gets through
 * pricing, config and Stripe and returns a checkout URL.
 *
 * Its own file, therefore its own process, therefore exactly one Stripe double
 * and one run — which is all this needs.
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

// Card payments on, so the handler does not short-circuit at stripeEnabled().
process.env.PAYMENTS_STRIPE_ENABLED = 'true';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';

const created = [];
injectModule('stripe', () => ({
  checkout: {
    sessions: {
      create: async (args) => {
        created.push(args);
        return { url: 'https://checkout.stripe.test/c/pay/cs_test_1' };
      },
    },
  },
}));

// The pricing config the handler loads before it computes a charge.
injectModule('../../utils/configCache', {
  getPlatformConfig: async () => ({
    sms_rate_cents_per_credit: 1.1,
    sms_markup_percentage: 172.73,
    sms_pricing_config: null, // → DEFAULT_SMS_PRICING, whose bounds admit 500
  }),
  invalidate: () => {},
});

const { purchaseSMSCredits } = require('../controllers/paymentController');

const EVENT = '11111111-1111-4111-8111-111111111111';

test('an event with NO Stripe customer gets a real checkout URL', async () => {
  // Precisely the promo-code / bank-transfer / admin-comp shape: the event is
  // paid, the organization has an email, and there is no Stripe customer.
  mock.setResolver((s) => {
    if (s.table === 'events' && s.op === 'select') {
      return { data: { org_id: 'org-1', organizations: { stripe_customer_id: null, email: 'organizer@example.com' } } };
    }
    return {};
  });

  const { res, nextErr } = await invoke(
    purchaseSMSCredits,
    mockReq({ params: { eventId: EVENT }, body: { creditCount: 500 }, user: { id: 'owner-1' } }),
  );

  assert.equal(nextErr, null, `handler threw: ${nextErr && nextErr.message}`);
  assert.equal(res.statusCode, 200, `expected a checkout, got ${res.statusCode} ${JSON.stringify(res.body)}`);
  assert.match(res.body.checkoutUrl, /^https:\/\/checkout\.stripe\.test\//);

  // The whole point: Stripe is asked to create the customer from the email.
  const session = created[0];
  assert.equal(session.customer_email, 'organizer@example.com');
  assert.equal(session.customer, undefined, 'customer and customer_email are mutually exclusive in Stripe');

  // And the credits are still attributed by event, not by customer — which is
  // what makes creating the customer at checkout time safe.
  assert.equal(session.metadata.event_id, EVENT);
  assert.equal(session.metadata.type, 'sms_credits');
  assert.equal(session.metadata.credit_count, '500');

  // A real amount was computed rather than NaN slipping into Stripe.
  const amount = session.line_items[0].price_data.unit_amount;
  assert.ok(Number.isInteger(amount) && amount > 0, `unit_amount must be a positive integer, got ${amount}`);
});
