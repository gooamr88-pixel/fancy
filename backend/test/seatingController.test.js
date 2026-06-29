require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

// assignSeat/reassignSeat auto-fire a QR ticket email — stub the service so no
// email work happens and we can assert it was triggered.
let qrEmailCalls = [];
injectModule('../../services/invitationService', {
  sendQrTicketEmail: async (...args) => { qrEmailCalls.push(args); return { sent: true }; },
});

// Realtime broadcasts are fire-and-forget REST calls — stub them out.
injectModule('../../utils/realtime', { broadcast: async () => {} });

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { assignSeat, reassignSeat, unassignSeat, saveSeatingBatch } = require('../controllers/seatingController');

t.beforeEach(() => { mock.reset(); qrEmailCalls = []; });

const seatReq = (body) => mockReq({ params: { eventId: 'evt-1' }, body, user: { id: 'owner-1' } });

// ─────────────────────────────────────────────────────────────────────────────
// assignSeat — the capacity assertion lives in the assign_seat RPC; the controller
// must faithfully translate the RPC's { success, error, message, seats_remaining }
// JSONB shape into HTTP semantics.
// ─────────────────────────────────────────────────────────────────────────────

test('assignSeat requires rsvpId and tableId (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(assignSeat, seatReq({ rsvpId: 'r1' }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
});

test('assignSeat surfaces a DB-level RPC error as 500 DATABASE_ERROR', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'assign_seat') return { error: { message: 'deadlock detected' } };
    return {};
  });
  const { res } = await invoke(assignSeat, seatReq({ rsvpId: 'r1', tableId: 't1' }));
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'DATABASE_ERROR');
});

test('assignSeat maps a CAPACITY_EXCEEDED RPC result to 409 with the table\'s message', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'assign_seat') {
      return { data: { success: false, error: 'CAPACITY_EXCEEDED', message: 'Table 1 has 2 remaining seats, party size is 4.' } };
    }
    return {};
  });
  const { res } = await invoke(assignSeat, seatReq({ rsvpId: 'r1', tableId: 't1' }));
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'CAPACITY_EXCEEDED');
  assert.match(res.body.message, /remaining seats/);
  // A capacity rejection must NOT trigger a QR ticket email.
  assert.equal(qrEmailCalls.length, 0);
});

test('assignSeat maps an UNAUTHORIZED RPC result (RPC-level authz) to 409', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'assign_seat') return { data: { success: false, error: 'UNAUTHORIZED', message: 'Not your event.' } };
    return {};
  });
  const { res } = await invoke(assignSeat, seatReq({ rsvpId: 'r1', tableId: 't1' }));
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'UNAUTHORIZED');
});

test('assignSeat success returns seats_remaining and fires the QR ticket email', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'assign_seat') return { data: { success: true, assignment_id: 'a1', seats_remaining: 6 } };
    return {};
  });
  const { res } = await invoke(assignSeat, seatReq({ rsvpId: 'r1', tableId: 't1' }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.seats_remaining, 6);
  assert.equal(qrEmailCalls.length, 1);
  assert.deepEqual(qrEmailCalls[0], ['evt-1', 'r1']);
});

test('assignSeat forwards the force-override flag to the RPC (deliberate overbooking)', async () => {
  let params = null;
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'assign_seat') { params = s.params; return { data: { success: true, seats_remaining: -1 } }; }
    return {};
  });
  await invoke(assignSeat, seatReq({ rsvpId: 'r1', tableId: 't1', force: true }));
  assert.equal(params.p_force, true);
  assert.equal(params.p_event_id, 'evt-1');
  assert.equal(params.p_party_id, 'r1');
  assert.equal(params.p_table_id, 't1');
});

// ─────────────────────────────────────────────────────────────────────────────
// reassignSeat
// ─────────────────────────────────────────────────────────────────────────────

test('reassignSeat requires rsvpId and newTableId (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(reassignSeat, seatReq({ rsvpId: 'r1' }));
  assert.equal(res.statusCode, 400);
});

test('reassignSeat success returns from/to table + remaining capacity', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'reassign_seat') {
      return { data: { success: true, from_table: 'Table 1', to_table: 'Table 2', seats_remaining_new_table: 3 } };
    }
    return {};
  });
  const { res } = await invoke(reassignSeat, seatReq({ rsvpId: 'r1', newTableId: 't2' }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.to_table, 'Table 2');
  assert.equal(res.body.data.seats_remaining_new_table, 3);
});

test('reassignSeat maps CAPACITY_EXCEEDED on the destination table to 409', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'reassign_seat') return { data: { success: false, error: 'CAPACITY_EXCEEDED', message: 'full' } };
    return {};
  });
  const { res } = await invoke(reassignSeat, seatReq({ rsvpId: 'r1', newTableId: 't2' }));
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'CAPACITY_EXCEEDED');
});

// ─────────────────────────────────────────────────────────────────────────────
// unassignSeat
// ─────────────────────────────────────────────────────────────────────────────

test('unassignSeat requires rsvpId (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(unassignSeat, seatReq({}));
  assert.equal(res.statusCode, 400);
});

test('unassignSeat maps ASSIGNMENT_NOT_FOUND to 409', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'unassign_seat') return { data: { success: false, error: 'ASSIGNMENT_NOT_FOUND', message: 'none' } };
    return {};
  });
  const { res } = await invoke(unassignSeat, seatReq({ rsvpId: 'r1' }));
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'ASSIGNMENT_NOT_FOUND');
});

test('unassignSeat success returns 200', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'unassign_seat') return { data: { success: true, message: 'Guest unassigned from Table 1.' } };
    return {};
  });
  const { res } = await invoke(unassignSeat, seatReq({ rsvpId: 'r1' }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// saveSeatingBatch — diffs the desired layout against current assignments and
// picks assign / reassign / unassign per guest.
// ─────────────────────────────────────────────────────────────────────────────

test('saveSeatingBatch rejects a non-array payload (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(saveSeatingBatch, seatReq({ assignments: 'nope' }));
  assert.equal(res.statusCode, 400);
});

test('saveSeatingBatch diffs current vs desired: assign new, reassign moved, unassign cleared', async () => {
  const rpcByFn = {};
  mock.setResolver((s) => {
    if (s.table === 'seating_assignments' && s.op === 'select') {
      // r1 currently at t1, r4 currently at t9.
      return { data: [{ party_id: 'r1', table_id: 't1' }, { party_id: 'r4', table_id: 't9' }] };
    }
    if (s.op === 'rpc') { (rpcByFn[s.fn] ||= []).push(s.params); return { data: { success: true } }; }
    return {};
  });

  const { res } = await invoke(saveSeatingBatch, seatReq({
    force: true,
    assignments: [
      { rsvpId: 'r1', tableId: 't2' },   // moved t1 -> t2  => reassign
      { rsvpId: 'r2', tableId: 't1' },   // brand new       => assign
      { rsvpId: 'r4', tableId: null },   // cleared          => unassign
      { rsvpId: 'r5', tableId: null },   // never seated     => no-op (skipped)
    ],
  }));

  assert.equal(res.statusCode, 200);
  assert.equal((rpcByFn['reassign_seat'] || []).length, 1);
  assert.equal((rpcByFn['assign_seat'] || []).length, 1);
  assert.equal((rpcByFn['unassign_seat'] || []).length, 1);
  // force flag threads through to the assign/reassign RPCs.
  assert.equal(rpcByFn['assign_seat'][0].p_force, true);
  assert.equal(rpcByFn['reassign_seat'][0].p_force, true);
  // r5 (null -> null) must produce no RPC call at all.
  assert.equal(res.body.results.length, 3);
});

test('saveSeatingBatch returns 400 BATCH_SAVE_FAILED when any row fails capacity', async () => {
  mock.setResolver((s) => {
    if (s.table === 'seating_assignments' && s.op === 'select') return { data: [] };
    if (s.op === 'rpc' && s.fn === 'assign_seat') {
      // r2 overflows its table; r1 is fine.
      if (s.params.p_party_id === 'r2') return { data: { success: false, message: 'CAPACITY_EXCEEDED' } };
      return { data: { success: true } };
    }
    return {};
  });

  const { res } = await invoke(saveSeatingBatch, seatReq({
    assignments: [{ rsvpId: 'r1', tableId: 't1' }, { rsvpId: 'r2', tableId: 't1' }],
  }));

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'BATCH_SAVE_FAILED');
  assert.match(res.body.message, /CAPACITY_EXCEEDED/);
});
