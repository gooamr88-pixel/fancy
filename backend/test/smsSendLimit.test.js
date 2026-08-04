require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

/**
 * ANTI-ABUSE RAMP-UP.
 *
 * Without a cap, the first thing a fraudulent signup can do is buy a bundle and
 * dispatch every message in it in one request. By the time anyone notices, the
 * messages are delivered and the carrier-reputation damage has landed — on the
 * shared toll-free number, and therefore on every legitimate customer at once.
 *
 * The cap is deliberately soft. It bounds a SINGLE send, never the total, so an
 * organizer capped at 50 can still reach 300 guests in six goes. These tests pin
 * both halves of that: that the first blast is stopped, and that a real customer
 * is never permanently blocked.
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { requireSendLimit } = require('../middleware/smsAddonGate');

const EVENT = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';

// The platform config is cached for 30s in-process. That is correct in
// production — an admin's band change simply takes up to half a minute to apply
// — but across tests it means the FIRST config a test scripts is the one every
// later test sees. Dropping it keeps each case honest.
const { invalidate: invalidateConfigCache } = require('../utils/configCache');

t.beforeEach(() => {
  mock.reset();
  invalidateConfigCache();
});

/** Run the middleware with a given lifetime delivered count. */
async function runLimit({ delivered, guestIds, rampUp, user = { id: 'owner-1' } }) {
  mock.setResolver((s) => {
    if (s.table === 'events') return { data: { org_id: ORG } };
    if (s.table === 'organizations') return { data: { sms_delivered_total: delivered } };
    if (s.table === 'super_admin_config') {
      return { data: rampUp ? { sms_pricing_config: { limits: { ramp_up: rampUp } } } : {} };
    }
    return {};
  });

  const req = mockReq({ params: { eventId: EVENT }, user, body: guestIds ? { guestIds } : {} });
  let nextCalled = false;
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  await requireSendLimit(req, res, () => { nextCalled = true; });
  return { nextCalled, res, req };
}

const ids = (n) => Array.from({ length: n }, (_, i) => `guest-${i}`);

test('a brand-new account cannot blast its whole balance in one request', async () => {
  const { nextCalled, res } = await runLimit({ delivered: 0, guestIds: ids(400) });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.error, 'SEND_LIMIT_EXCEEDED');
  assert.equal(res.body.maxPerSend, 50);
});

test('the refusal explains itself, and says the limit is temporary', async () => {
  const { res } = await runLimit({ delivered: 0, guestIds: ids(400) });

  // A bare 429 reads as "the product is broken". The organizer needs to know
  // what to do right now and that this will stop happening.
  assert.match(res.body.message, /50/, 'states the actual cap');
  assert.match(res.body.message, /smaller batches/i, 'says what to do now');
  assert.match(res.body.message, /lifts automatically/i, 'says it is temporary');
});

test('a send within the cap passes untouched', async () => {
  const { nextCalled, res } = await runLimit({ delivered: 0, guestIds: ids(30) });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});

test('the cap lifts as the organization delivers real messages', async () => {
  const mid = await runLimit({ delivered: 500, guestIds: ids(400) });
  assert.equal(mid.nextCalled, true, '400 is within the 500 band earned at 200 delivered');

  const established = await runLimit({ delivered: 5000, guestIds: ids(9000) });
  assert.equal(established.nextCalled, true, 'the top band is unlimited — never a permanent block');
});

test('an audience-based send is not judged here', async () => {
  // An audience ("everyone who hasn't replied") has no knowable size until it is
  // resolved, so the same cap is applied in the controller once the recipient
  // count exists. Guessing here would either block legitimate sends or wave
  // through the exact case the cap exists for.
  const { nextCalled } = await runLimit({ delivered: 0, guestIds: null });
  assert.equal(nextCalled, true);
});

test('a super admin is never capped', async () => {
  const { nextCalled } = await runLimit({
    delivered: 0, guestIds: ids(9999), user: { id: 'admin', isSuperAdmin: true },
  });
  assert.equal(nextCalled, true);
});

test('admin-configured bands take effect', async () => {
  const strict = [{ delivered_min: 0, max_per_send: 5 }, { delivered_min: 10, max_per_send: 0 }];

  const capped = await runLimit({ delivered: 0, guestIds: ids(6), rampUp: strict });
  assert.equal(capped.res.statusCode, 429);
  assert.equal(capped.res.body.maxPerSend, 5);

  invalidateConfigCache();
  const free = await runLimit({ delivered: 10, guestIds: ids(6), rampUp: strict });
  assert.equal(free.nextCalled, true);
});

test('the check FAILS OPEN when the lookup breaks', async () => {
  mock.setResolver(() => { throw new Error('connection reset'); });

  const req = mockReq({ params: { eventId: EVENT }, user: { id: 'owner-1' }, body: { guestIds: ids(999) } });
  let nextCalled = false;
  const res = { status() { return this; }, json() { return this; } };
  await requireSendLimit(req, res, () => { nextCalled = true; });

  // This is abuse friction, not an entitlement check. The add-on gate and the
  // per-guest consent gate have both already run and both fail closed; blocking
  // a paying organizer because a counter lookup blipped costs more than the
  // abuse it would prevent.
  assert.equal(nextCalled, true);
});
