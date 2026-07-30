require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

injectModule('../../utils/realtime', { broadcast: async () => {} });
const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { deleteTable } = require('../controllers/tableController');

const EVENT = '11111111-1111-4111-8111-111111111111';
const GATE = '55555555-5555-4555-8555-555555555555';

t.beforeEach(() => mock.reset());

/**
 * Gate deletion guard (amendment A-17).
 *
 * Discovery finding: `deleteTable` only refused deletion when `seating_assignments`
 * referenced the element. Parties are assigned to TABLES, never to entrance zones,
 * so that guard has NEVER fired for a gate — nothing prevented deleting an entrance
 * with a paired device or recorded arrivals, orphaning the audit trail.
 *
 * These tests pin the new guard, and pin that it does not over-reach: ordinary
 * seating-map editing must stay possible, including on a deployment that has not
 * applied the check-in migration yet.
 */

/** Builds a resolver for deleteTable's three lookups. */
const resolver = ({ assignments = [], devices = [], history = [], fail = null } = {}) => (s) => {
  if (s.table === 'seating_assignments') return { data: assignments };
  if (s.table === 'event_devices') {
    return fail === 'devices' ? { error: { message: 'relation does not exist' } } : { data: devices };
  }
  if (s.table === 'check_ins') {
    return fail === 'check_ins' ? { error: { message: 'relation does not exist' } } : { data: history };
  }
  if (s.table === 'tables' && s.op === 'delete') return { data: [{ id: GATE }] };
  return {};
};

const del = () => invoke(
  deleteTable,
  mockReq({ params: { eventId: EVENT, tableId: GATE }, user: { id: 'organizer-1' } }),
);

// ══════════════════════════════════════════════════════════════════
// The guard fires
// ══════════════════════════════════════════════════════════════════

test('an entrance with a paired device cannot be deleted', async () => {
  mock.setResolver(resolver({ devices: [{ id: 'dev-1', device_label: 'Main entrance' }] }));

  const { res } = await del();
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'GATE_IN_USE');
  // The message must name the remedy: revoke or move the device.
  assert.match(res.body.message, /revoke|move/i);
});

test('an entrance with recorded arrivals cannot be deleted', async () => {
  mock.setResolver(resolver({ history: [{ id: 'ci-1' }] }));

  const { res } = await del();
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'GATE_HAS_HISTORY');
});

test('the two refusals are distinct, because the remedies differ', async () => {
  mock.setResolver(resolver({ devices: [{ id: 'dev-1' }] }));
  const withDevice = (await del()).res.body.error;

  mock.reset();
  mock.setResolver(resolver({ history: [{ id: 'ci-1' }] }));
  const withHistory = (await del()).res.body.error;

  // A paired device can be revoked or moved; recorded arrivals are history and
  // the element simply has to stay. Collapsing these would tell an organizer to
  // do something impossible.
  assert.notEqual(withDevice, withHistory);
});

test('a device blocks deletion even when there is also history', async () => {
  mock.setResolver(resolver({ devices: [{ id: 'dev-1' }], history: [{ id: 'ci-1' }] }));
  const { res } = await del();
  assert.equal(res.statusCode, 409);
  // Device is reported first: it is the actionable one.
  assert.equal(res.body.error, 'GATE_IN_USE');
});

// ══════════════════════════════════════════════════════════════════
// The guard does not over-reach
// ══════════════════════════════════════════════════════════════════

test('an unused entrance deletes normally', async () => {
  const ops = [];
  mock.setResolver((s) => {
    ops.push(`${s.table}:${s.op}`);
    return resolver()(s);
  });

  const { res } = await del();
  assert.equal(res.statusCode, 200);
  assert.ok(ops.includes('tables:delete'), 'the delete must actually happen');
});

test('the pre-existing seating-assignment guard still works', async () => {
  mock.setResolver(resolver({ assignments: [{ id: 'sa-1' }] }));
  const { res } = await del();
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'TABLE_NOT_EMPTY');
});

test('the seating-assignment guard is checked FIRST, before the gate lookups', async () => {
  const touched = [];
  mock.setResolver((s) => {
    touched.push(s.table);
    return resolver({ assignments: [{ id: 'sa-1' }] })(s);
  });

  await del();
  // A seated table is refused without paying for two more queries.
  assert.equal(touched.includes('event_devices'), false);
  assert.equal(touched.includes('check_ins'), false);
});

// ══════════════════════════════════════════════════════════════════
// Degradation — the check-in tables may not exist yet
// ══════════════════════════════════════════════════════════════════

test('deletion still works when event_devices is missing (migration not applied)', async () => {
  // A deployment that has not run 20260814000000 must not lose the ability to
  // edit its seating map. The guard fails OPEN by design.
  mock.setResolver(resolver({ fail: 'devices' }));
  const { res } = await del();
  assert.equal(res.statusCode, 200);
});

test('deletion still works when the check_ins gate column is missing', async () => {
  mock.setResolver(resolver({ fail: 'check_ins' }));
  const { res } = await del();
  assert.equal(res.statusCode, 200);
});
