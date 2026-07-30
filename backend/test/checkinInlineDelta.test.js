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

const svc = require('../services/checkinSyncService');
const ctrl = require('../controllers/checkinSyncController');

const EVENT = '11111111-1111-4111-8111-111111111111';
const CID = '44444444-4444-4444-8444-444444444444';

t.beforeEach(() => mock.reset());

/**
 * Inline delta on the batch response (amendment A-15).
 *
 * During an arrival rush devices upload constantly, making the batch response the
 * highest-frequency channel available. Carrying the delta on it converges the
 * fleet in a second or two instead of at the next poll tick.
 *
 * The ordering requirement is the subtle part and is pinned below: the delta must
 * be computed AFTER the batch applies, or a device is handed a sequence it
 * immediately overtakes with its own writes and re-fetches them next time.
 */

const batchResolver = ({ deltaRows = [], cursorSeq = 9, rpcMaxSeq = 7, onRpc } = {}) => {
  let rpcCalled = false;
  return (s) => {
    if (s.table === 'guests' && s.op === 'select') return { data: [{ id: 'g1', party_id: 'p1' }] };
    if (s.op === 'rpc' && s.fn === 'checkin_batch_upsert') {
      rpcCalled = true;
      if (onRpc) onRpc();
      return {
        data: {
          ok: true,
          results: [{ client_checkin_id: CID, guest_id: 'g1', status: 'accepted', server_id: 's1', server_seq: 7 }],
          summary: { accepted: 1, duplicate: 0, conflict: 0, rejected: 0 },
          max_seq: rpcMaxSeq,
        },
      };
    }
    if (s.table === 'check_ins' && s.op === 'select') {
      // The delta read. Asserting rpcCalled here is what pins the ordering.
      assert.equal(rpcCalled, true, 'the delta must be read AFTER the batch is applied');
      return { data: deltaRows };
    }
    if (s.table === 'event_checkin_cursors') return { data: { last_seq: cursorSeq } };
    if (s.table === 'event_guest_changes') return { data: [{ seq: 3 }] };
    return {};
  };
};

const record = { client_checkin_id: CID, guest_id: 'g1' };

// ══════════════════════════════════════════════════════════════════
// The delta rides along
// ══════════════════════════════════════════════════════════════════

test('a batch with since_seq returns the delta inline', async () => {
  mock.setResolver(batchResolver({
    deltaRows: [{
      id: 'srv-9', guest_id: 'g-other', party_id: 'p-other', server_seq: 8,
      undo_seq: null, deleted_at: null, checked_in_at: '2026-08-01T19:00:00Z',
      method: 'qr_scan', staff_display_name: 'Karim', device_label: 'Garden gate',
    }],
  }));

  const out = await svc.submitCheckInBatch(EVENT, [record], { sinceSeq: 5 });
  assert.equal(out.summary.accepted, 1);
  assert.equal(out.delta.changes.length, 1);
  assert.equal(out.delta.changes[0].guestId, 'g-other');
  assert.equal(out.delta.maxSeq, 9);
});

test('CONTRACT: the delta is computed AFTER the batch applies', async () => {
  // Asserted inside the resolver: the check_ins read must not happen before the
  // RPC. Computing it first would hand back a sequence the device immediately
  // overtakes with its own just-accepted writes, and it would re-fetch them.
  mock.setResolver(batchResolver({ deltaRows: [] }));
  await svc.submitCheckInBatch(EVENT, [record], { sinceSeq: 5 });
});

test('omitting since_seq returns no delta, and reads nothing extra', async () => {
  let deltaRead = false;
  mock.setResolver((s) => {
    if (s.table === 'check_ins' && s.op === 'select') deltaRead = true;
    return batchResolver()(s);
  });

  const out = await svc.submitCheckInBatch(EVENT, [record]);
  assert.equal(out.delta, null);
  assert.equal(deltaRead, false, 'an older client must not pay for a delta it did not ask for');
});

test('since_seq of 0 still produces a delta — 0 is a real baseline, not "unset"', async () => {
  mock.setResolver(batchResolver({ deltaRows: [] }));
  const out = await svc.submitCheckInBatch(EVENT, [record], { sinceSeq: 0 });
  assert.notEqual(out.delta, null);
});

test('truncation is reported so the device follows up rather than assuming it is caught up', async () => {
  // getDelta's default limit is 500; 501 rows means truncated.
  const rows = Array.from({ length: 501 }, (_, i) => ({
    id: `srv-${i}`, guest_id: `g${i}`, party_id: 'p1', server_seq: i + 1,
    undo_seq: null, deleted_at: null,
  }));
  mock.setResolver(batchResolver({ deltaRows: rows }));

  const out = await svc.submitCheckInBatch(EVENT, [record], { sinceSeq: 0 });
  assert.equal(out.delta.truncated, true);
  assert.equal(out.delta.changes.length, 500);
});

// ══════════════════════════════════════════════════════════════════
// A delta failure must never cost a committed batch
// ══════════════════════════════════════════════════════════════════

test('a failing delta read still returns the batch result', async () => {
  mock.setResolver((s) => {
    if (s.table === 'guests' && s.op === 'select') return { data: [{ id: 'g1', party_id: 'p1' }] };
    if (s.op === 'rpc') {
      return {
        data: {
          ok: true,
          results: [{ client_checkin_id: CID, guest_id: 'g1', status: 'accepted', server_id: 's1', server_seq: 7 }],
          summary: { accepted: 1, duplicate: 0, conflict: 0, rejected: 0 },
          max_seq: 7,
        },
      };
    }
    if (s.table === 'check_ins' && s.op === 'select') return { error: { message: 'boom' } };
    return {};
  });

  // The check-ins are already committed server-side. Throwing here would make the
  // device retry a batch the server already holds — safe, thanks to the
  // idempotency key, but pointless traffic during the busiest moment of the night.
  const out = await svc.submitCheckInBatch(EVENT, [record], { sinceSeq: 5 });
  assert.equal(out.summary.accepted, 1);
  assert.equal(out.delta, null);
});

// ══════════════════════════════════════════════════════════════════
// Endpoint wiring
// ══════════════════════════════════════════════════════════════════

test('the endpoint accepts since_seq in snake_case or camelCase', async () => {
  for (const body of [
    { records: [record], since_seq: 5 },
    { records: [record], sinceSeq: 5 },
  ]) {
    mock.reset();
    mock.setResolver(batchResolver({ deltaRows: [] }));
    const { res } = await invoke(ctrl.postCheckInBatch,
      mockReq({ params: { eventId: EVENT }, body, user: { id: 'u1' } }));
    assert.equal(res.statusCode, 200);
    assert.notEqual(res.body.data.delta, null, `failed for ${JSON.stringify(body)}`);
  }
});

test('a negative since_seq is clamped rather than passed through', async () => {
  mock.setResolver(batchResolver({ deltaRows: [] }));
  const { res } = await invoke(ctrl.postCheckInBatch,
    mockReq({ params: { eventId: EVENT }, body: { records: [record], since_seq: -50 }, user: { id: 'u1' } }));
  assert.equal(res.statusCode, 200);
  assert.notEqual(res.body.data.delta, null);
});

test('a garbage since_seq is treated as absent, not as zero', async () => {
  let deltaRead = false;
  mock.setResolver((s) => {
    if (s.table === 'check_ins' && s.op === 'select') deltaRead = true;
    return batchResolver()(s);
  });

  const { res } = await invoke(ctrl.postCheckInBatch,
    mockReq({ params: { eventId: EVENT }, body: { records: [record], since_seq: 'soon' }, user: { id: 'u1' } }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.delta, null);
  assert.equal(deltaRead, false);
});

test('the delta key is present on an empty batch, so clients can rely on the schema', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(ctrl.postCheckInBatch,
    mockReq({ params: { eventId: EVENT }, body: { records: [] }, user: { id: 'u1' } }));
  assert.equal(res.statusCode, 200);
  assert.equal('delta' in res.body.data, true);
  assert.equal(res.body.data.delta, null);
});
