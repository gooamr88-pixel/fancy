require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { injectModule } = require('./helpers/inject');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEXT MESSAGING IS SOLD WITH A PLAN, AND STILL BILLED PER MESSAGE.
 *
 * Two independent questions decide whether an event may text, and the whole
 * point of this file is that they stay independent:
 *
 *   1. MAY this plan text?   `sms_campaigns` on the tier, set by a super admin
 *                            in Admin -> Config -> Subscription Tiers.
 *   2. HAS this event paid?  events.sms_addon_purchased_at.
 *
 * Collapsing them is the failure this feature has already had twice, in both
 * directions: tier-only meant a customer on the right plan could have no
 * allowance; purchase-only meant texting could not be sold with a plan at all
 * and there was nothing for an admin to switch.
 *
 * The three outcomes must stay DISTINCT, because the fix differs:
 *   403 FEATURE_NOT_AVAILABLE → upgrade the plan
 *   402 SMS_ADDON_REQUIRED    → buy messages
 *   next()                    → send
 * A 402 shown to somebody whose plan forbids texting sends them to a checkout
 * that will refuse them.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const REPO = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

/* ── The registry entry ──────────────────────────────────────────────────── */

const { getFeatureByKey, FEATURE_NOTES, FREE_TIER_FEATURES } = require('../config/featureRegistry');

test('sms_campaigns is a real, admin-togglable feature again', () => {
  const feat = getFeatureByKey('sms_campaigns');
  assert.ok(feat, 'the key must exist — tiers already reference it');
  // `builtIn: false` DISABLES the admin toggle and stamps "Not built yet" on it;
  // `supersededBy` hides the bullet from every plan card. Either one silently
  // undoes this whole feature while every other layer keeps working.
  assert.notEqual(feat.builtIn, false, 'builtIn:false disables the admin toggle');
  assert.equal(feat.supersededBy, undefined, 'supersededBy hides it from plan cards');
});

test('texting is never free — it cannot be a free-tier default', () => {
  assert.ok(!FREE_TIER_FEATURES.has('sms_campaigns'),
    'a free event granting SMS would let an unpaid account text strangers');
});

test('the "charged separately" caption travels with the feature', () => {
  // The organizer chooses a plan BECAUSE it lists texting. If the card does not
  // also say messages cost extra, they find out at the moment they try to send.
  assert.ok(FEATURE_NOTES.sms_campaigns, 'sms_campaigns must carry a meteredNote');
  assert.match(FEATURE_NOTES.sms_campaigns, /separately/i);
});

/* ── The gate ────────────────────────────────────────────────────────────── */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

/** Platform config with one tier that carries SMS and one that does not. */
const CONFIG = {
  pricing_tiers: [
    { name: 'Starter', features: ['rsvp_basic'] },
    { name: 'Professional', features: ['rsvp_basic', 'sms_campaigns'] },
    { name: 'Enterprise', features: ['sms_campaigns'] },
    { name: 'Custom', is_custom: true, features: ['sms_campaigns'] },
  ],
};
injectModule('../../utils/configCache', { getPlatformConfig: async () => CONFIG });

const { requireSmsAddon } = require('../middleware/smsAddonGate');

const runGate = async (event, user = { id: 'u1' }) => {
  mock.setResolver((s) => (s.table === 'events' ? { data: event } : {}));
  let passed = false;
  const req = mockReq({ params: { eventId: 'evt-1' }, user });
  const { res } = await invoke(
    (rq, rs, nx) => requireSmsAddon(rq, rs, () => { passed = true; nx && nx(); }),
    req,
  );
  return { passed, status: res.statusCode, body: res.body };
};

const EVENT = (over) => ({
  id: 'evt-1', is_paid: true, manual_override: false, status: 'active',
  tier_name: 'Starter', sms_addon_purchased_at: null, sms_settings: {},
  ...over,
});

test('a plan without texting is refused with an UPGRADE answer, not a purchase one', async () => {
  const r = await runGate(EVENT({ tier_name: 'Starter' }));
  assert.equal(r.passed, false);
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'FEATURE_NOT_AVAILABLE');
  assert.equal(r.body.upgrade_action, 'upgrade_plan');
  // Naming the plan matters: "your plan does not include this" is actionable,
  // "not available" is not.
  assert.match(r.body.message, /Starter/);
});

test('a plan WITH texting that has not bought messages gets the purchase answer', async () => {
  const r = await runGate(EVENT({ tier_name: 'Professional' }));
  assert.equal(r.passed, false);
  assert.equal(r.status, 402);
  assert.equal(r.body.error, 'SMS_ADDON_REQUIRED');
  assert.equal(r.body.upgrade_action, 'purchase_sms_addon');
});

test('a plan with texting AND a purchase sends', async () => {
  const r = await runGate(EVENT({ tier_name: 'Professional', sms_addon_purchased_at: '2026-08-01T00:00:00Z' }));
  assert.equal(r.passed, true);
});

test('GRANDFATHERED: credits already bought survive losing the plan feature', async () => {
  /**
   * The rule that protects a paid balance. An admin re-organising which plans
   * carry texting must not be able to strand an organizer's purchased messages
   * mid-event — money changed hands for those.
   */
  const r = await runGate(EVENT({ tier_name: 'Starter', sms_addon_purchased_at: '2026-08-01T00:00:00Z' }));
  assert.equal(r.passed, true, 'an event that paid for messages keeps sending');
});

test('a comped event (manual_override) is never locked out', async () => {
  // Support comps an event to make it behave like a paid one; silently excluding
  // texting would make the comp a different product from the thing it imitates.
  const r = await runGate(EVENT({ tier_name: 'Starter', is_paid: false, manual_override: true }));
  assert.equal(r.passed, true);
});

test('a deleted or renamed tier grants nothing, rather than everything', async () => {
  // Matches featureGate's safe fallback. The opposite default turns a typo in
  // the admin config into free SMS for everybody on that tier.
  const r = await runGate(EVENT({ tier_name: 'ThisTierWasDeleted' }));
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'FEATURE_NOT_AVAILABLE');
});

test('an event with no tier at all is refused', async () => {
  const r = await runGate(EVENT({ tier_name: null }));
  assert.equal(r.status, 403);
});

test('super admins bypass, as they do on every other gate', async () => {
  const r = await runGate(EVENT({ tier_name: 'Starter' }), { id: 'admin', isSuperAdmin: true });
  assert.equal(r.passed, true);
});

/* ── The shape the dashboard reads ───────────────────────────────────────── */

test('the settings endpoint answers plan access, so the client never re-derives it', () => {
  const src = read('backend/controllers/campaignController.js');
  assert.match(src, /tierGrantsSms/, 'it must call the same helper the gate uses');
  assert.match(src, /const access = planIncludesSms \? 'granted'/, 'it must compute an access verdict');
  // `\s*$` with the `m` flag, never `\n`: this repo is checked out with CRLF on
  // Windows, where a bare `\n` in a pattern silently never matches.
  assert.match(src, /^\s+access,\s*$/m, 'and return it in the payload');
  assert.match(src, /plansWithSms/, 'and name the plans that do carry texting');

  // The read has to carry the columns that verdict is computed from. A missing
  // column reads as undefined rather than throwing, which would lock texting for
  // the entire platform without a single error.
  //
  // Those columns now come from selectEventWithTier (which also survives the
  // tier-identity migration not being applied), so the guarantee is checked
  // through it rather than against a literal column list here.
  const fn = src.slice(src.indexOf('const getSmsSettings'));
  const read_ = fn.slice(0, fn.indexOf('if (error || !event)'));
  assert.match(read_, /selectEventWithTier\(/, 'the tier columns must come from the shared selector');
  assert.match(read_, /manual_override/, 'grandfathering reads this one directly');

  const { TIER_COLUMNS } = require('../utils/tierResolver');
  assert.match(TIER_COLUMNS, /tier_name/);
  assert.match(TIER_COLUMNS, /tier_key/, 'identity, not just the display name');
  assert.match(TIER_COLUMNS, /tier_features/, 'the snapshot the verdict falls back to');
});

test('the gate and the settings endpoint share one definition of "plan includes SMS"', () => {
  const gate = read('backend/middleware/smsAddonGate.js');
  assert.match(gate, /async function tierGrantsSms/);
  assert.match(gate, /module\.exports = \{[^}]*tierGrantsSms/s,
    'it must be exported — the settings endpoint imports it rather than copying it');
  const controller = read('backend/controllers/campaignController.js');
  assert.match(controller, /require\('\.\.\/middleware\/smsAddonGate'\)/);
});

/* ── The client surfaces ─────────────────────────────────────────────────── */

const FE = 'frontend/src/app/dashboard';

test('the locked state is one component, used by every SMS touchpoint', () => {
  const lock = read(`${FE}/components/PlanLock.js`);
  assert.match(lock, /export default function PlanLock/);
  assert.match(lock, /export function PlanLockBadge/);

  // The page, and the per-guest send menu.
  assert.match(read(`${FE}/campaigns/page.js`), /PlanLock/);
  assert.match(read(`${FE}/components/GuestSendMenu.js`), /PlanLockBadge/);
});

test('the send menu keeps "buy messages" and "upgrade plan" apart', () => {
  const src = read(`${FE}/components/GuestSendMenu.js`);
  assert.match(src, /const upgradeInstead/);
  assert.match(src, /const buyInstead/);
  // Routing a plan-locked organizer to checkout is the specific bug this splits.
  assert.match(src, /if \(upgradeInstead\) \{ onUpgradePlan/);
});

test('the BULK bar makes the same distinction as the per-guest menu', () => {
  /**
   * Found by auditing rather than by a failing screen. The per-guest menu split
   * "buy messages" from "upgrade plan"; the bulk action bar did not, so an
   * organizer who selected twenty guests was offered "Add texting" and routed to
   * a checkout their plan forbids — the same bug, one component over.
   *
   * Two surfaces answering one question differently is the drift this whole file
   * exists to stop, so the bulk bar is pinned too.
   */
  const src = read(`${FE}/components/RSVPsTab.js`);
  assert.match(src, /smsPlanLocked/, 'the bulk bar must know about plan-level locking');
  assert.match(src, /if \(smsPlanLocked\) return onUpgradePlan/,
    'a plan-locked bulk send must route to plans, never to the SMS checkout');
  assert.match(src, /PlanLockBadge/, 'and carry the same badge as every other locked surface');
});

test('the sidebar marks the locked destination from the server verdict', () => {
  const src = read(`${FE}/components/DashboardNav.js`);
  assert.match(src, /campaigns\/settings/,
    'the nav must ASK for access, not infer it from tier_features');
  assert.match(src, /data\?\.access === 'locked'/);

  // Comments stripped first. The doc comment on that effect deliberately QUOTES
  // the anti-pattern it is warning against, and an assertion that reads prose
  // fails on the explanation of the rule rather than on a breach of it.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /tier_features/,
    'deriving access client-side is how the sidebar and the page come to disagree');
});

test('the campaigns page checks the plan BEFORE offering a purchase', () => {
  const src = read(`${FE}/campaigns/page.js`);
  const lockIdx = src.indexOf('planLocked ?');
  const buyIdx = src.indexOf('!active ?');
  assert.ok(lockIdx !== -1 && buyIdx !== -1);
  assert.ok(lockIdx < buyIdx,
    'a plan-locked event must see the upgrade panel, not an offer to buy messages it cannot use');
});

test('a missing access field reads as allowed, so an old API never hides paid texting', () => {
  // Version skew must fail toward the customer: the real gate still fails closed
  // server-side, so the worst case is a 402 they can act on — strictly better
  // than falsely telling a paying organizer to upgrade.
  assert.match(read(`${FE}/page.js`), /data\.access \|\| 'granted'/);
  assert.match(read(`${FE}/campaigns/page.js`), /data\?\.access === 'locked'/);
});

test('an SMS allowance cannot be BOUGHT on a plan that lacks texting', () => {
  /**
   * The loophole this closes. The send gate grandfathers any event with a
   * purchase on file — so if checkout will sell an allowance to anyone, an
   * organizer buys the cheapest plan plus messages in one session and is
   * permanently exempt from the tier restriction. The plan gate would be worth
   * exactly the price of the add-on.
   *
   * Asserted on both paid paths: card checkout and manual transfer. A guard on
   * one of two doors is the exact shape of the bypass smsAddonGate.test.js was
   * written for.
   */
  const src = read('backend/controllers/paymentController.js');
  assert.match(src, /function assertTierAllowsSmsAddon/);
  assert.match(src, /error: 'SMS_NOT_IN_TIER'/);
  const calls = src.match(/assertTierAllowsSmsAddon\(tier, smsAddonSegments\)/g) || [];
  assert.equal(calls.length, 2,
    'both createCheckoutSession and initiateManualPayment must run the guard');
});

test('the plan cards print the "charged separately" caption', () => {
  const src = read(`${FE}/create-event/components/StagePayment.js`);
  assert.match(src, /featureNotes\[f\]/, 'the tier bullet must render the note when there is one');
  assert.match(read('backend/controllers/paymentController.js'), /featureNotes: FEATURE_NOTES/);
});
