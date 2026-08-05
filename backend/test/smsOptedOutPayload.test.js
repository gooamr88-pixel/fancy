require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

/**
 * THE GUEST LIST MUST KNOW WHO REPLIED STOP.
 *
 * Every other reachability signal already rides on the party row — sms_consent,
 * its timestamp, the method. Suppression does not: it lives in the GLOBAL
 * sms_opt_outs table, keyed by phone number rather than by party.
 *
 * So the dashboard could confidently show "can be texted" for someone who had
 * opted out, the organizer would select them, and the send would skip them —
 * with the truth surfacing only in the message log afterwards. That is precisely
 * the confusion the log was built to end, reintroduced one screen earlier.
 *
 * These tests pin that the flag is attached, that it is attached to the RIGHT
 * guests, and that a failure to look it up degrades the list rather than
 * breaking it.
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const EVENT = '11111111-1111-4111-8111-111111111111';

const PARTIES = [
  { id: 'p1', label: 'Opted out', guests: [{ is_primary_contact: true, phone: '+15551110000' }] },
  { id: 'p2', label: 'Fine', guests: [{ is_primary_contact: true, phone: '+15552220000' }] },
  { id: 'p3', label: 'No phone', guests: [{ is_primary_contact: true, phone: null }] },
];

injectModule('../../services/guestService', {
  listParties: async () => ({ parties: JSON.parse(JSON.stringify(PARTIES)), pagination: { page: 1 } }),
  MAX_ADDITIONAL_GUESTS: 100,
  MAX_CUSTOM_ANSWERS: 200,
});

const { getRSVPs } = require('../controllers/rsvpController');

const call = () => invoke(getRSVPs, mockReq({ params: { eventId: EVENT }, query: {}, user: { id: 'owner-1' } }));

t.beforeEach(() => mock.reset());

test('a suppressed number is flagged, and only that one', async () => {
  mock.setResolver((s) => {
    if (s.table === 'sms_opt_outs') return { data: [{ phone: '+15551110000' }] };
    return {};
  });

  const { res } = await call();
  const byId = Object.fromEntries(res.body.data.rsvps.map((r) => [r.id, r]));

  assert.equal(byId.p1.sms_opted_out, true, 'this guest replied STOP');
  assert.equal(byId.p2.sms_opted_out, false, 'this one did not — the flag must not smear across the page');
});

test('a guest with no number is never marked as opted out', async () => {
  mock.setResolver((s) => {
    if (s.table === 'sms_opt_outs') return { data: [] };
    return {};
  });

  const { res } = await call();
  const p3 = res.body.data.rsvps.find((r) => r.id === 'p3');
  assert.equal(p3.sms_opted_out, false,
    '"no number" and "opted out" are different problems with different fixes');
});

test('the lookup is ONE batched query, not one per guest', async () => {
  mock.setResolver((s) => {
    if (s.table === 'sms_opt_outs') return { data: [] };
    return {};
  });

  await call();

  const lookups = mock.calls.filter((c) => c.table === 'sms_opt_outs');
  assert.equal(lookups.length, 1,
    'a query per guest would make the guest list scale linearly in round trips');
});

test('a failed lookup degrades the list instead of breaking it', async () => {
  mock.setResolver((s) => {
    if (s.table === 'sms_opt_outs') throw new Error('connection reset');
    return {};
  });

  const { res } = await call();

  assert.equal(res.statusCode, 200, 'the guest list is the point; STOP status is advisory');
  assert.equal(res.body.data.rsvps.length, 3);
});

test('no numbers on the page means no query at all', async () => {
  injectModule('../../services/guestService', {
    listParties: async () => ({ parties: [{ id: 'p9', label: 'Nobody', guests: [] }], pagination: {} }),
    MAX_ADDITIONAL_GUESTS: 100,
    MAX_CUSTOM_ANSWERS: 200,
  });
  delete require.cache[require.resolve('../controllers/rsvpController')];
  const { getRSVPs: fresh } = require('../controllers/rsvpController');

  mock.setResolver(() => ({}));
  await invoke(fresh, mockReq({ params: { eventId: EVENT }, query: {}, user: { id: 'owner-1' } }));

  assert.equal(mock.calls.filter((c) => c.table === 'sms_opt_outs').length, 0);
});
