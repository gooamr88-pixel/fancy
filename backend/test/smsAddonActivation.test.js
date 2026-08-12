require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');
const { mockReq, invoke } = require('./helpers/http');

/**
 * TWO WAYS AN EVENT ENDED UP UNABLE TO USE SMS, BOTH REPORTED BY THE OPERATOR.
 *
 * They look unrelated and share one shape: the platform has several ways to pay
 * for an event, and the SMS subsystem only ever recognised one of them.
 *
 *   1. AN EVENT PAID BY PROMO CODE COULD NOT BUY MESSAGES. `purchaseSMSCredits`
 *      hard-required `organizations.stripe_customer_id`, which is written in
 *      exactly one place — the card checkout. A promo redemption sets is_paid +
 *      manual_override and never touches Stripe, so the organizer was told to
 *      "complete your first event payment" for an event that was already paid.
 *      Bank-transfer and admin-comp events were in the same permanent state.
 *
 *   2. A COMPLIMENTARY GRANT DID NOT SWITCH TEXTING ON. `grantSmsCredits` filled
 *      `sms_credit_wallets` and stopped, but every send gate reads
 *      `events.sms_addon_purchased_at`. Funded wallet, add-on still off, nothing
 *      could send — and the admin got a success message.
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const EVENT = '11111111-1111-4111-8111-111111111111';
const ADMIN = '33333333-3333-4333-8333-333333333333';

t.beforeEach(() => mock.reset());

/* ─── 1. Buying credits without a Stripe customer ──────────────────────────
 *
 * Asserted against the SOURCE rather than by driving the handler.
 *
 * `purchaseSMSCredits` caches its Stripe client in a module-private singleton
 * with no reset, so a second test in the same process can never install a fresh
 * double — and reaching the Stripe call at all means standing up the platform
 * config cache and the whole pricing model first. Both are worth mocking for a
 * test about PRICING; neither tells us anything about the one line that was
 * wrong here, which is how the customer is identified.
 *
 * So this reads the shipped code, the way the repo's other cross-layer contract
 * tests do. A regex is crude, but it fails loudly if somebody restores the hard
 * requirement — and that is the whole risk being guarded.
 */
const fs = require('fs');
const path = require('path');
const paymentSrc = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'paymentController.js'), 'utf8',
);
const purchaseFn = paymentSrc.slice(paymentSrc.indexOf('const purchaseSMSCredits'));
/**
 * The function's own body, bounded at the next top-level declaration.
 *
 * A fixed character window was the first attempt and it silently cut the body
 * in half — `customer_email` sits 4,130 characters in, so a 4,000-char slice
 * asserted against code it could not see and reported the fix as missing.
 * Bounding on the next `\nconst ` measures the real thing.
 */
const NEXT_DECL = purchaseFn.indexOf('\nconst ', 10);
const purchaseBody = purchaseFn.slice(0, NEXT_DECL > 0 ? NEXT_DECL : 8000);

/**
 * Comments removed, for the "this is gone" assertions only.
 *
 * The docblock explaining the fix necessarily QUOTES the message it removed —
 * "Please complete your first event payment…" — so a negative match against the
 * raw source fails on the documentation rather than on the code. Exactly the
 * trap a CSS comment sprang earlier in this codebase, in a different language.
 *
 * Positive assertions run against the raw body: matching a real declaration is
 * unambiguous, and stripping comments there would only add a way to be wrong.
 */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const purchaseCode = stripComments(purchaseBody);

test('a missing Stripe customer no longer refuses the sale', () => {
  // The exact refusal an organizer on a promo code, a bank transfer or an admin
  // comp used to hit — for an event that was already paid for.
  assert.doesNotMatch(purchaseCode, /NO_STRIPE_CUSTOMER/,
    'purchaseSMSCredits must not reject an organization that has no Stripe customer');
  assert.doesNotMatch(purchaseCode, /complete your first event payment/i,
    'that message told already-paid organizers to pay again');
});

test('checkout falls back to customer_email, and never sends both', () => {
  // Stripe treats `customer` and `customer_email` as mutually exclusive, so the
  // fallback has to be a spread rather than two always-present keys.
  assert.match(purchaseBody,
    /\.\.\.\(customerId \? \{ customer: customerId \} : \{ customer_email: customerEmail \}\)/);
});

test('the email is actually selected from the organization', () => {
  // Without this the fallback silently sends `customer_email: undefined`, and
  // Stripe creates a session nobody can be receipted for.
  assert.match(purchaseBody, /organizations\(stripe_customer_id, email\)/);
});

test('having no billing contact at all is still refused, with its own code', () => {
  assert.match(purchaseBody, /NO_BILLING_CONTACT/);
});

test('fulfillment keys on the event id, which is why the fallback is safe', () => {
  // The load-bearing fact behind this change: credits are attributed from
  // session metadata, not from the Stripe customer, so creating the customer
  // at checkout time cannot misroute them.
  const fulfillSrc = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'paymentFulfillment.js'), 'utf8',
  );
  assert.match(fulfillSrc, /const \{ event_id, type \} = session\.metadata/);
  assert.match(purchaseBody, /metadata: \{[\s\S]{0,200}event_id: eventId/);
});

test('fulfillment records the customer Stripe created, so it happens once', () => {
  /**
   * The follow-on cost of the customer_email fallback, and why it is closed.
   *
   * Stripe creates a NEW customer for every `customer_email` session. Nothing
   * wrote that id back, so an organization with no card on file would collect a
   * fresh duplicate customer on every top-up, keep a null column forever, and
   * never be able to reuse a payment method. Silent, cumulative, and invisible
   * in any test that only checks the credits landed.
   *
   * Guarded on the column still being null so a genuine card customer is never
   * overwritten by a later session.
   */
  const fulfillSrc = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'paymentFulfillment.js'), 'utf8',
  );
  assert.match(fulfillSrc, /async function rememberStripeCustomer/);
  assert.match(fulfillSrc, /\.is\('stripe_customer_id', null\)/,
    'must not overwrite an organization that already has a card customer');
  assert.match(fulfillSrc, /if \(session\.customer\) \{[\s\S]{0,300}rememberStripeCustomer/,
    'the sms_credits branch has to actually call it');
});

/* ─── 2. The complimentary grant ───────────────────────────────────────── */

test('granting credits also switches the add-on on', async () => {
  const updates = [];
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'increment_sms_credits') return { data: null };
    if (s.table === 'events' && s.op === 'update') { updates.push(s); return { data: [{ id: EVENT }] }; }
    return {};
  });

  const { grantSmsCredits } = require('../controllers/adminController');
  const { res } = await invoke(
    grantSmsCredits,
    mockReq({ params: { eventId: EVENT }, body: { credits: 500 }, user: { id: ADMIN } }),
  );

  assert.equal(res.statusCode, 200);
  assert.equal(updates.length, 1, 'the grant must activate the add-on, not just fund the wallet');
  assert.ok(updates[0].payload.sms_addon_purchased_at, 'sms_addon_purchased_at is what every send gate reads');
});

test('an event that already bought the add-on keeps its original purchase date', async () => {
  // The timestamp is also what the new-account send-rate ramp measures from
  // (campaignController.resolveSendLimit) — overwriting it would silently
  // re-throttle an established event back to its first-day limit.
  const updates = [];
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'increment_sms_credits') return { data: null };
    if (s.table === 'events' && s.op === 'update') { updates.push(s); return { data: [] }; }
    return {};
  });

  const { grantSmsCredits } = require('../controllers/adminController');
  await invoke(
    grantSmsCredits,
    mockReq({ params: { eventId: EVENT }, body: { credits: 100 }, user: { id: ADMIN } }),
  );

  const filters = updates[0].filters;
  assert.deepEqual(filters.is, [['sms_addon_purchased_at', null]],
    'the update must be guarded on the column still being null');
});

test('a grant that funds the wallet but cannot activate reports it, loudly', async () => {
  // The credits are already in; failing silently would recreate the exact bug —
  // an admin told it worked and an organizer who still cannot send.
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'increment_sms_credits') return { data: null };
    if (s.table === 'events' && s.op === 'update') return { error: { message: 'column missing' } };
    return {};
  });

  const { grantSmsCredits } = require('../controllers/adminController');
  const { res } = await invoke(
    grantSmsCredits,
    mockReq({ params: { eventId: EVENT }, body: { credits: 500 }, user: { id: ADMIN } }),
  );

  /**
   * The status has to be one the ADMIN CLIENT treats as a failure.
   *
   * This asserted 207 first — tidy REST semantics for a partial success, and
   * useless here: `utils/apiClient.apiFetch` throws only on `!response.ok`, and
   * 207 is a 2xx. The admin page would have resolved and shown
   * "Granted N SMS credits — Success" over a grant that did not activate, which
   * is the exact bug this endpoint change removes. Pin the status, because the
   * next person to "correct" it to 207 breaks the alerting silently.
   */
  assert.ok(res.statusCode >= 400, `status must be a failure to the client, got ${res.statusCode}`);
  assert.equal(res.body.error, 'ADDON_NOT_ACTIVATED');
  assert.match(res.body.message, /still cannot send/i);
});
