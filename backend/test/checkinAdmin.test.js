require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const ctrl = require('../controllers/admin/checkinAdminController');

const EVENT = '11111111-1111-4111-8111-111111111111';
const DEVICE = '22222222-2222-4222-8222-222222222222';

t.beforeEach(() => mock.reset());

const DAY = 24 * 3600 * 1000;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

const deviceRow = (over = {}) => ({
  id: DEVICE,
  event_id: EVENT,
  device_label: 'Main entrance',
  is_active: true,
  revoked_at: null,
  wipe_requested_at: null,
  wipe_confirmed_at: null,
  last_seen_at: iso(-2 * 3600 * 1000),
  battery_level: 80,
  storage_free_mb: 4000,
  bundle_version: 12,
  queue_depth: 0,
  app_version: '1.0.0',
  created_at: iso(-30 * DAY),
  events: {
    id: EVENT, title: 'Nadia & Omar', event_date: iso(-1 * DAY), org_id: 'org-1',
    organizations: { id: 'org-1', name: 'Via Events', email: 'via@example.com' },
  },
  ...over,
});

/**
 * Super-admin check-in surfaces (amendment A-16).
 *
 * The registry's job is to make one specific risk visible: a tablet that still
 * holds the complete guest list of a finished private event and has not come
 * back online to purge it (§20.5). Most of these tests are about that flag being
 * right, because a false negative there is a guest list nobody knows about.
 */

// ══════════════════════════════════════════════════════════════════
// Registry
// ══════════════════════════════════════════════════════════════════

test('the registry spans organizations and surfaces the owner', async () => {
  mock.setResolver((s) => (s.table === 'event_devices' ? { data: [deviceRow()] } : {}));

  const { res } = await invoke(ctrl.listAllDevices, mockReq({ query: {}, user: { id: 'admin-1' } }));
  assert.equal(res.statusCode, 200);
  const d = res.body.data.devices[0];
  assert.equal(d.orgName, 'Via Events');
  assert.equal(d.eventTitle, 'Nadia & Omar');
});

test('a device still holding a guest list for a long-finished event is flagged', async () => {
  mock.setResolver((s) => (s.table === 'event_devices'
    ? {
      data: [deviceRow({
        bundle_version: 12,
        events: { ...deviceRow().events, event_date: iso(-30 * DAY) },
      })],
    }
    : {}));

  const { res } = await invoke(ctrl.listAllDevices, mockReq({ query: {}, user: { id: 'admin-1' } }));
  // §20.5 purges 7 days after the event, but only on next launch. A tablet in a
  // drawer keeps the list indefinitely, and that is what this flag catches.
  assert.equal(res.body.data.devices[0].holdingStaleData, true);
  assert.equal(res.body.data.counts.holdingStaleData, 1);
});

test('a device with no guest list is NOT flagged, however old the event', async () => {
  mock.setResolver((s) => (s.table === 'event_devices'
    ? {
      data: [deviceRow({
        bundle_version: null,
        events: { ...deviceRow().events, event_date: iso(-90 * DAY) },
      })],
    }
    : {}));

  const { res } = await invoke(ctrl.listAllDevices, mockReq({ query: {}, user: { id: 'admin-1' } }));
  // It already purged. Flagging it would bury the ones that have not.
  assert.equal(res.body.data.devices[0].holdingStaleData, false);
});

test('a revoked device is not flagged as holding data', async () => {
  mock.setResolver((s) => (s.table === 'event_devices'
    ? {
      data: [deviceRow({
        revoked_at: iso(-DAY),
        events: { ...deviceRow().events, event_date: iso(-30 * DAY) },
      })],
    }
    : {}));

  const { res } = await invoke(ctrl.listAllDevices, mockReq({ query: {}, user: { id: 'admin-1' } }));
  // Revocation already queued a wipe; it is handled, not outstanding.
  assert.equal(res.body.data.devices[0].holdingStaleData, false);
});

test('a recent event is not flagged — the purge window has not passed', async () => {
  mock.setResolver((s) => (s.table === 'event_devices'
    ? { data: [deviceRow({ events: { ...deviceRow().events, event_date: iso(-2 * DAY) } })] }
    : {}));

  const { res } = await invoke(ctrl.listAllDevices, mockReq({ query: {}, user: { id: 'admin-1' } }));
  assert.equal(res.body.data.devices[0].holdingStaleData, false);
});

test('staleDays filters to devices that have not reported', async () => {
  mock.setResolver((s) => (s.table === 'event_devices'
    ? {
      data: [
        deviceRow({ id: 'fresh', last_seen_at: iso(-2 * 3600 * 1000) }),
        deviceRow({ id: 'stale', last_seen_at: iso(-20 * DAY) }),
        deviceRow({ id: 'never', last_seen_at: null }),
      ],
    }
    : {}));

  const { res } = await invoke(ctrl.listAllDevices,
    mockReq({ query: { staleDays: '7' }, user: { id: 'admin-1' } }));

  const ids = res.body.data.devices.map((d) => d.id);
  assert.equal(ids.includes('fresh'), false);
  assert.ok(ids.includes('stale'));
  // A device that has NEVER reported is the most concerning case of all, so it
  // must never be filtered out of a staleness view.
  assert.ok(ids.includes('never'));
});

test('an orphaned device row does not crash the registry', async () => {
  mock.setResolver((s) => (s.table === 'event_devices' ? { data: [deviceRow({ events: null })] } : {}));

  const { res } = await invoke(ctrl.listAllDevices, mockReq({ query: {}, user: { id: 'admin-1' } }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.devices[0].orgName, null);
  assert.equal(res.body.data.devices[0].holdingStaleData, false);
});

// ══════════════════════════════════════════════════════════════════
// Revoke and wipe — different acts, deliberately
// ══════════════════════════════════════════════════════════════════

test('revoking clears the tokens, requests a wipe, and audits', async () => {
  let patch = null;
  const audits = [];
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'update') {
      patch = s.payload;
      return { data: [{ id: DEVICE, event_id: EVENT, device_label: 'Main entrance' }] };
    }
    if (s.table === 'activity_logs' && s.op === 'insert') { audits.push(s.payload); return {}; }
    return {};
  });

  const { res } = await invoke(ctrl.revokeDeviceGlobal, mockReq({
    params: { deviceId: DEVICE }, body: { reason: 'Stolen at venue' }, user: { id: 'admin-1' },
  }));

  assert.equal(res.statusCode, 200);
  assert.equal(patch.is_active, false);
  assert.equal(patch.refresh_token_hash, null);
  assert.ok(patch.token_hash.startsWith('revoked:'), 'the old token hash must stop matching');
  // A device that must stop working is a device that must not keep the list.
  assert.ok(patch.wipe_requested_at);
  assert.equal(audits[0].action, 'checkin_device_revoked_by_admin');
  assert.equal(audits[0].metadata.reason, 'Stolen at venue');
});

test('a wipe leaves the device paired — it is not a revoke', async () => {
  let patch = null;
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'update') {
      patch = s.payload;
      return { data: [{ id: DEVICE, event_id: EVENT, device_label: 'Main entrance' }] };
    }
    return {};
  });

  const { res } = await invoke(ctrl.requestWipeGlobal,
    mockReq({ params: { deviceId: DEVICE }, body: {}, user: { id: 'admin-1' } }));

  assert.equal(res.statusCode, 200);
  assert.ok(patch.wipe_requested_at);
  // Collapsing wipe into revoke would force a re-pair after every event, and an
  // operator re-pairing six tablets monthly will eventually stop wiping them.
  assert.equal('is_active' in patch, false);
  assert.equal('token_hash' in patch, false);
});

test('wiping clears a previous confirmation so the device acts again', async () => {
  let patch = null;
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'update') {
      patch = s.payload;
      return { data: [{ id: DEVICE, event_id: EVENT, device_label: 'X' }] };
    }
    return {};
  });

  await invoke(ctrl.requestWipeGlobal,
    mockReq({ params: { deviceId: DEVICE }, body: {}, user: { id: 'admin-1' } }));
  assert.equal(patch.wipe_confirmed_at, null);
});

test('revoking or wiping an unknown device is 404', async () => {
  mock.setResolver((s) => (s.table === 'event_devices' && s.op === 'update' ? { data: [] } : {}));

  for (const handler of [ctrl.revokeDeviceGlobal, ctrl.requestWipeGlobal]) {
    mock.reset();
    mock.setResolver((s) => (s.table === 'event_devices' && s.op === 'update' ? { data: [] } : {}));
    const { res } = await invoke(handler,
      mockReq({ params: { deviceId: DEVICE }, body: {}, user: { id: 'admin-1' } }));
    assert.equal(res.statusCode, 404);
  }
});

// ══════════════════════════════════════════════════════════════════
// Operational summary (§21.6)
// ══════════════════════════════════════════════════════════════════

test('the summary attributes scans to the device that recorded them', async () => {
  mock.setResolver((s) => {
    if (s.table === 'events') return { data: { id: EVENT, title: 'Nadia & Omar', event_date: iso(-DAY), organizations: { name: 'Via Events' } } };
    if (s.table === 'event_devices') {
      return { data: [
        { id: 'd1', device_label: 'Main entrance', queue_depth: 0, app_version: '1.0.0' },
        { id: 'd2', device_label: 'Garden gate', queue_depth: 3, app_version: '1.0.0' },
      ] };
    }
    if (s.table === 'check_ins') {
      return { data: [
        { device_label: 'Main entrance', method: 'qr_scan', checked_in_at: iso(-3 * 3600 * 1000), server_received_at: iso(-3 * 3600 * 1000), token_verified: true, deleted_at: null },
        { device_label: 'Main entrance', method: 'qr_scan', checked_in_at: iso(-2 * 3600 * 1000), server_received_at: iso(-2 * 3600 * 1000), token_verified: false, deleted_at: null },
        { device_label: 'Garden gate', method: 'manual_search', checked_in_at: iso(-1 * 3600 * 1000), server_received_at: iso(-1 * 3600 * 1000), token_verified: null, deleted_at: null },
      ] };
    }
    if (s.table === 'event_check_in_conflicts') return { data: [{ id: 'c1', resolved_at: null }] };
    return {};
  });

  const { res } = await invoke(ctrl.getOperationalSummary,
    mockReq({ params: { eventId: EVENT }, user: { id: 'admin-1' } }));

  assert.equal(res.statusCode, 200);
  const body = res.body.data;
  assert.equal(body.totals.arrivals, 3);
  assert.equal(body.totals.unresolvedConflicts, 1);
  // Explicitly false only — null means no ticket was presented, which is normal
  // for a manual check-in and is not a failure.
  assert.equal(body.totals.unverifiedScans, 1);

  const main = body.devices.find((d) => d.label === 'Main entrance');
  const garden = body.devices.find((d) => d.label === 'Garden gate');
  assert.equal(main.scans, 2);
  assert.equal(garden.scans, 1);
  // Non-zero means it stopped reporting with arrivals unsent.
  assert.equal(garden.lastQueueDepth, 3);
});

test('the summary says crash reporting is unmeasured rather than reporting zero', async () => {
  mock.setResolver((s) => {
    if (s.table === 'events') return { data: { id: EVENT, title: 'X', event_date: iso(0), organizations: null } };
    return { data: [] };
  });

  const { res } = await invoke(ctrl.getOperationalSummary,
    mockReq({ params: { eventId: EVENT }, user: { id: 'admin-1' } }));

  // §21.6 asks for a crash count and none is integrated. Returning 0 would read
  // as "no crashes" rather than "not measured" — the more dangerous of the two.
  assert.equal(res.body.data.crashReporting.available, false);
  assert.match(res.body.data.crashReporting.note, /not integrated/i);
});

test('clock divergence beyond five minutes is counted', async () => {
  mock.setResolver((s) => {
    if (s.table === 'events') return { data: { id: EVENT, title: 'X', event_date: iso(0), organizations: null } };
    if (s.table === 'check_ins') {
      return { data: [
        { device_label: 'A', method: 'qr_scan', checked_in_at: '2026-08-01T19:00:00Z', server_received_at: '2026-08-01T19:00:30Z', deleted_at: null },
        { device_label: 'A', method: 'qr_scan', checked_in_at: '2027-01-01T00:00:00Z', server_received_at: '2026-08-01T19:00:00Z', deleted_at: null },
      ] };
    }
    return { data: [] };
  });

  const { res } = await invoke(ctrl.getOperationalSummary,
    mockReq({ params: { eventId: EVENT }, user: { id: 'admin-1' } }));
  assert.equal(res.body.data.totals.clockSkewed, 1);
});

test('a reversed admission is excluded from arrivals but counted', async () => {
  mock.setResolver((s) => {
    if (s.table === 'events') return { data: { id: EVENT, title: 'X', event_date: iso(0), organizations: null } };
    if (s.table === 'check_ins') {
      return { data: [
        { device_label: 'A', method: 'qr_scan', checked_in_at: iso(-3600000), deleted_at: null },
        { device_label: 'A', method: 'qr_scan', checked_in_at: iso(-3600000), deleted_at: iso(-1800000) },
      ] };
    }
    return { data: [] };
  });

  const { res } = await invoke(ctrl.getOperationalSummary,
    mockReq({ params: { eventId: EVENT }, user: { id: 'admin-1' } }));
  assert.equal(res.body.data.totals.arrivals, 1);
  assert.equal(res.body.data.totals.reversed, 1);
});

test('an unknown event is 404', async () => {
  mock.setResolver((s) => (s.table === 'events' ? { data: null } : { data: [] }));
  const { res } = await invoke(ctrl.getOperationalSummary,
    mockReq({ params: { eventId: EVENT }, user: { id: 'admin-1' } }));
  assert.equal(res.statusCode, 404);
});
