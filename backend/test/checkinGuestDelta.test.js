require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

const broadcasts = [];
injectModule('../../utils/realtime', {
  broadcast: async (eventId, event, payload) => { broadcasts.push({ eventId, event, payload }); },
});

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const svc = require('../services/checkinSyncService');
const ctrl = require('../controllers/checkinSyncController');

const EVENT = '11111111-1111-4111-8111-111111111111';

t.beforeEach(() => { mock.reset(); broadcasts.length = 0; });

// ══════════════════════════════════════════════════════════════════
// bundle_version (§19.2)
// ══════════════════════════════════════════════════════════════════

test('bundle version is the highest change-log sequence for the event', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_guest_changes') return { data: [{ seq: 4207 }] };
    return {};
  });
  assert.equal(await svc.getBundleVersion(EVENT), 4207);
});

test('an event with no logged changes reports version 0, not 1', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_guest_changes') return { data: [] };
    return {};
  });
  // 0 is meaningful: it is the "no baseline" signal the delta RPC keys off.
  assert.equal(await svc.getBundleVersion(EVENT), 0);
});

// ══════════════════════════════════════════════════════════════════
// Guest delta (§19.4)
// ══════════════════════════════════════════════════════════════════

test('a delta passes through upserts and removals', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'checkin_guest_delta') {
      return { data: {
        ok: true, from_version: 41, to_version: 47, requires_full_resync: false, changed_count: 2,
        upserts: [{ id: 'g1', fullName: 'Alice', tableName: 'Table 9' }],
        removed_guest_ids: ['g2'],
      } };
    }
    return {};
  });

  const out = await svc.getGuestDelta(EVENT, 41);
  assert.equal(out.fromVersion, 41);
  assert.equal(out.toVersion, 47);
  assert.equal(out.requiresFullResync, false);
  assert.equal(out.upserts[0].tableName, 'Table 9');
  assert.deepEqual(out.removedGuestIds, ['g2']);
});

test('requires_full_resync is surfaced with its reason so the device knows why', async () => {
  for (const reason of ['VERSION_TOO_OLD', 'NO_BASELINE', 'CHANGE_VOLUME']) {
    mock.reset();
    mock.setResolver((s) => {
      if (s.op === 'rpc') {
        return { data: {
          ok: true, from_version: 1, to_version: 900,
          requires_full_resync: true, reason, upserts: [], removed_guest_ids: [],
        } };
      }
      return {};
    });
    const out = await svc.getGuestDelta(EVENT, 1);
    assert.equal(out.requiresFullResync, true);
    assert.equal(out.reason, reason);
    assert.deepEqual(out.upserts, [], 'a full-resync response must not also ship a partial delta');
  }
});

test('a negative or garbage since_version is clamped to 0', async () => {
  let params = null;
  mock.setResolver((s) => {
    if (s.op === 'rpc') { params = s.params; return { data: { ok: true, from_version: 0, to_version: 0, upserts: [], removed_guest_ids: [] } }; }
    return {};
  });

  await svc.getGuestDelta(EVENT, -99);
  assert.equal(params.p_since, 0);
  await svc.getGuestDelta(EVENT, 'nonsense');
  assert.equal(params.p_since, 0);
});

test('an unknown event surfaces as 404 rather than an unhandled 500', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc') return { data: { ok: false, error: 'EVENT_NOT_FOUND' } };
    return {};
  });
  const { res } = await invoke(ctrl.getGuestDelta,
    mockReq({ params: { eventId: EVENT }, query: {}, user: { id: 'u1' } }));
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, 'EVENT_NOT_FOUND');
});

test('the guest-delta endpoint returns the version window and resync flag', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc') {
      return { data: {
        ok: true, from_version: 10, to_version: 12, requires_full_resync: false,
        changed_count: 1, upserts: [{ id: 'g1' }], removed_guest_ids: [],
      } };
    }
    return {};
  });
  const { res } = await invoke(ctrl.getGuestDelta,
    mockReq({ params: { eventId: EVENT }, query: { since_version: '10' }, user: { id: 'u1' } }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.toVersion, 12);
  assert.equal(res.body.data.requiresFullResync, false);
  assert.ok(res.body.meta.min_supported_app_version);
});

// ══════════════════════════════════════════════════════════════════
// Emergency controls (§21.5)
// ══════════════════════════════════════════════════════════════════

test('controls default to all-off when no cursor row exists yet', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_checkin_cursors') return { data: null };
    return {};
  });
  const out = await svc.getSyncControls(EVENT);
  assert.deepEqual(out, { syncDisabled: false, realtimeDisabled: false, pollingOnly: false });
});

test('controls are upserted, so the kill switch can be armed before any check-in exists', async () => {
  let upsertOpts = null; let payload = null;
  mock.setResolver((s) => {
    if (s.table === 'event_checkin_cursors' && s.op === 'upsert') {
      upsertOpts = s.upsertOpts; payload = s.payload; return {};
    }
    if (s.table === 'event_checkin_cursors' && s.op === 'select') {
      return { data: { sync_disabled: true, realtime_disabled: false, polling_only: true } };
    }
    return {};
  });

  const out = await svc.setSyncControls(EVENT, {
    syncDisabled: true, pollingOnly: true, note: 'retry storm', actorId: 'admin-1',
  });

  assert.equal(upsertOpts.onConflict, 'event_id');
  assert.equal(payload.sync_disabled, true);
  assert.equal(payload.polling_only, true);
  assert.equal(payload.controls_set_by, 'admin-1');
  assert.equal(payload.controls_note, 'retry storm');
  // realtimeDisabled was not supplied, so it must not be written at all.
  assert.equal('realtime_disabled' in payload, false);
  assert.equal(out.syncDisabled, true);
});

test('an empty controls patch is rejected rather than silently writing nothing', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(ctrl.setControls,
    mockReq({ params: { eventId: EVENT }, body: {}, user: { id: 'admin-1' } }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
  assert.equal(mock.calls.length, 0);
});

test('changing controls audits the acting admin and tells the fleet immediately', async () => {
  const audits = [];
  mock.setResolver((s) => {
    if (s.table === 'event_checkin_cursors' && s.op === 'upsert') return {};
    if (s.table === 'event_checkin_cursors' && s.op === 'select') {
      return { data: { sync_disabled: true, realtime_disabled: true, polling_only: false } };
    }
    if (s.table === 'activity_logs' && s.op === 'insert') { audits.push(s.payload); return {}; }
    return {};
  });

  const { res } = await invoke(ctrl.setControls, mockReq({
    params: { eventId: EVENT },
    body: { syncDisabled: true, realtimeDisabled: true, note: 'bad deploy' },
    user: { id: 'admin-7' },
  }));

  assert.equal(res.statusCode, 200);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, 'checkin_controls_changed');
  assert.equal(audits[0].actor_id, 'admin-7');
  assert.equal(audits[0].metadata.note, 'bad deploy');
  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0].event, 'checkin_controls_changed');
});

test('a long control note is truncated rather than rejected', async () => {
  let payload = null;
  mock.setResolver((s) => {
    if (s.table === 'event_checkin_cursors' && s.op === 'upsert') { payload = s.payload; return {}; }
    if (s.table === 'event_checkin_cursors' && s.op === 'select') {
      return { data: { sync_disabled: true, realtime_disabled: false, polling_only: false } };
    }
    return {};
  });
  await svc.setSyncControls(EVENT, { syncDisabled: true, note: 'x'.repeat(2000) });
  assert.equal(payload.controls_note.length, 500);
});

test('the batch drain still succeeds while sync is disabled — accepting data beats rejecting it', async () => {
  // A device may not have seen the flag yet. Rejecting its drain would strand
  // check-ins that exist nowhere else, so the server always takes the data.
  mock.setResolver((s) => {
    if (s.table === 'guests' && s.op === 'select') return { data: [{ id: 'g1', party_id: 'p1' }] };
    if (s.op === 'rpc' && s.fn === 'checkin_batch_upsert') {
      return { data: {
        ok: true,
        results: [{ client_checkin_id: '44444444-4444-4444-8444-444444444444', guest_id: 'g1', status: 'accepted', server_id: 's1', server_seq: 1 }],
        summary: { accepted: 1, duplicate: 0, conflict: 0, rejected: 0 }, max_seq: 1,
      } };
    }
    if (s.table === 'event_checkin_cursors') return { data: { sync_disabled: true, realtime_disabled: false, polling_only: false } };
    return {};
  });

  const { res } = await invoke(ctrl.postCheckInBatch, mockReq({
    params: { eventId: EVENT },
    body: { records: [{ client_checkin_id: '44444444-4444-4444-8444-444444444444', guest_id: 'g1' }] },
    user: { id: 'u1' },
  }));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.summary.accepted, 1);
});
