require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

/**
 * SMS ADD-ON GATE — the single authorization for sending text messages.
 *
 * Two properties are under test, and the second is the one that was actually
 * broken in production:
 *
 *  1. An event that has not bought the add-on cannot send.
 *  2. That answer is the same on BOTH routes that can reach the dispatcher.
 *     /events/:id/campaigns/send-sms was gated; /events/:id/invitations/send was
 *     not — and its `channel: 'sms'` branch forwards straight into the same
 *     campaign controller. Anyone who noticed could send campaigns for free by
 *     switching endpoints. A test that only covers the campaigns route would have
 *     stayed green throughout, so the invitations route is asserted explicitly.
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { requireSmsAddon } = require('../middleware/smsAddonGate');

const EVENT = '11111111-1111-4111-8111-111111111111';

t.beforeEach(() => mock.reset());

/** Run the middleware and capture whether it passed control on. */
async function runGate(eventRow, user = { id: 'owner-1' }) {
  mock.setResolver((s) => {
    if (s.table === 'events') return { data: eventRow };
    return {};
  });

  const req = mockReq({ params: { eventId: EVENT }, user });
  let nextCalled = false;
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  await requireSmsAddon(req, res, () => { nextCalled = true; });
  return { nextCalled, res, req };
}

test('an event that never bought the add-on is refused with 402', async () => {
  const { nextCalled, res } = await runGate({
    id: EVENT, is_paid: true, tier_name: 'Premium', sms_addon_purchased_at: null, manual_override: false,
  });

  assert.equal(nextCalled, false, 'the request must not reach the dispatcher');
  assert.equal(res.statusCode, 402);
  assert.equal(res.body.error, 'SMS_ADDON_REQUIRED');
  assert.equal(res.body.upgrade_action, 'purchase_sms_addon',
    'the client needs to know WHICH purchase unlocks this, not just that it is blocked');
});

test('a paid add-on passes, regardless of pricing tier', async () => {
  // The cheapest possible plan. SMS is sold per event, so the tier is irrelevant —
  // this is the whole point of replacing the tier-based feature gate.
  const { nextCalled, res } = await runGate({
    id: EVENT, is_paid: true, tier_name: 'Basic',
    sms_addon_purchased_at: '2026-08-04T12:00:00.000Z', manual_override: false,
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null, 'a permitted request writes no response of its own');
});

test('a comped event (manual_override) is allowed without a purchase', async () => {
  const { nextCalled } = await runGate({
    id: EVENT, is_paid: false, tier_name: null, sms_addon_purchased_at: null, manual_override: true,
  });

  assert.equal(nextCalled, true,
    'manual_override is how support comps an event; excluding SMS would make comped events behave unlike the paid ones they imitate');
});

test('a super admin bypasses the gate without a database read', async () => {
  mock.setResolver(() => ({}));
  const req = mockReq({ params: { eventId: EVENT }, user: { id: 'admin', isSuperAdmin: true } });
  let nextCalled = false;
  const res = { status() { return this; }, json() { return this; } };

  await requireSmsAddon(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(mock.calls.length, 0, 'the bypass should short-circuit before any query');
});

test('a missing event is a 404, not a silent pass', async () => {
  const { nextCalled, res } = await runGate(null);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, 'EVENT_NOT_FOUND');
});

test('a lookup failure FAILS CLOSED', async () => {
  mock.setResolver(() => { throw new Error('connection reset'); });

  const req = mockReq({ params: { eventId: EVENT }, user: { id: 'owner-1' } });
  let nextCalled = false;
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  await requireSmsAddon(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false,
    'an unverifiable entitlement must not permit sending — the alternative is billing someone whose right to send we could not confirm');
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'SMS_ADDON_CHECK_FAILED');
});

/* ── Both doors, one answer ─────────────────────────────────────────────── */

test('BOTH the campaigns and invitations routes mount the same gate', () => {
  // Asserted structurally rather than through HTTP: the bug was never in the
  // gate's logic, it was that one of the two routes did not use it.
  const campaignSrc = require('fs').readFileSync(
    require.resolve('../routes/campaignRoutes'), 'utf8');
  const invitationSrc = require('fs').readFileSync(
    require.resolve('../routes/invitationRoutes'), 'utf8');

  assert.match(campaignSrc, /requireSmsAddon/,
    'campaigns/send-sms must be gated');
  assert.match(invitationSrc, /requireSmsAddon/,
    'invitations/send must gate its sms channel — it forwards into the same dispatcher');
  assert.doesNotMatch(campaignSrc, /requireFeature\(\s*['"]sms_campaigns['"]\s*\)/,
    'the tier-based gate is replaced, not layered — SMS is sold per event on any plan');
});

test('the invitations gate applies to the sms channel ONLY', () => {
  const src = require('fs').readFileSync(require.resolve('../routes/invitationRoutes'), 'utf8');
  // Either polarity is correct — the gate now early-returns on the negative
  // (`!== 'sms'`) rather than branching on the positive, because it applies TWO
  // middlewares in sequence rather than one.
  assert.match(src, /channel\s*(===|!==)\s*'sms'/,
    'email and qr invitations must stay reachable without the SMS add-on');

  // The ramp-up must be here too. This is now the ONLY bulk SMS door in the
  // platform: the campaign route that used to carry the cap is gone, so missing
  // it here would silently stop capping how many messages a brand-new account
  // can fire in one request.
  assert.match(src, /requireSendLimit/,
    'the anti-abuse ramp-up must guard the sms channel, not just the add-on gate');
});
