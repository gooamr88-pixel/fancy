require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const svc = require('../services/checkinDeviceService');
const ctrl = require('../controllers/checkinDeviceController');
const { requireDevice, extractDeviceToken } = require('../middleware/deviceAuth');

const EVENT = '11111111-1111-4111-8111-111111111111';
const EVENT_B = '99999999-9999-4999-8999-999999999999';
const DEVICE = '22222222-2222-4222-8222-222222222222';

const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const iso = (msFromNow) => new Date(Date.now() + msFromNow).toISOString();

t.beforeEach(() => mock.reset());

// ══════════════════════════════════════════════════════════════════
// Pairing codes (§18.3, §18.7 #1)
// ══════════════════════════════════════════════════════════════════

test('pairing codes use an unambiguous alphabet — no O/0 or I/1/L to mistype', () => {
  for (let i = 0; i < 200; i++) {
    const code = svc.generatePairingCode();
    assert.equal(code.length, svc.CODE_LENGTH);
    assert.ok(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/.test(code), `bad alphabet: ${code}`);
  }
});

test('pairing codes do not repeat across many draws', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(svc.generatePairingCode());
  assert.ok(seen.size > 495, 'codes must not collide in a small sample');
});

test('code normalisation tolerates lowercase, spaces and dashes as typed at a desk', () => {
  assert.equal(svc.normalizeCode(' abcd-2345 '), 'ABCD2345');
});

// ══════════════════════════════════════════════════════════════════
// Gate binding (amendment A-17)
//
// Discovery (report §5A) confirmed an entrance is `element_type='zone'` AND
// `shape='entrance'`. These tests pin that, because binding to the wrong element
// type would label every conflict report with a table number.
// ══════════════════════════════════════════════════════════════════

const GATE = '55555555-5555-4555-8555-555555555555';

/** A resolver that answers the gate lookup, then delegates. */
const withGate = (gateRow, rest = () => ({})) => (s) => {
  if (s.table === 'tables' && s.op === 'select') return { data: gateRow };
  return rest(s);
};

test('listGates queries entrances specifically, not all layout elements', async () => {
  let filters = null;
  mock.setResolver((s) => {
    if (s.table === 'tables' && s.op === 'select') {
      filters = s.filters;
      return { data: [{ id: GATE, table_name: 'Main entrance' }] };
    }
    return {};
  });

  const gates = await svc.listGates(EVENT);
  assert.deepEqual(gates, [{ id: GATE, name: 'Main entrance' }]);
  // getTables defaults to element_type='table', so a gate query must be explicit.
  assert.ok(filters.eq.some(([c, v]) => c === 'element_type' && v === 'zone'));
  assert.ok(filters.eq.some(([c, v]) => c === 'shape' && v === 'entrance'));
});

test('a gate on another event is refused — one organizer cannot bind to another venue', async () => {
  mock.setResolver(withGate({
    id: GATE, table_name: 'Main', element_type: 'zone', shape: 'entrance', event_id: EVENT_B,
  }));
  assert.equal(await svc.resolveGate(EVENT, GATE), null);
});

test('a table or a non-entrance zone is refused as a gate', async () => {
  for (const row of [
    { element_type: 'table', shape: 'round' },
    { element_type: 'zone', shape: 'bar' },
    { element_type: 'zone', shape: 'dance_floor' },
  ]) {
    mock.reset();
    mock.setResolver(withGate({ id: GATE, table_name: 'X', event_id: EVENT, ...row }));
    assert.equal(
      await svc.resolveGate(EVENT, GATE), null,
      `${row.element_type}/${row.shape} must not be a gate`,
    );
  }
});

test('a real entrance on this event resolves', async () => {
  mock.setResolver(withGate({
    id: GATE, table_name: 'Garden gate', element_type: 'zone', shape: 'entrance', event_id: EVENT,
  }));
  assert.deepEqual(await svc.resolveGate(EVENT, GATE), { id: GATE, name: 'Garden gate' });
});

test('a pairing code is refused without a valid gate', async () => {
  mock.setResolver(withGate(null));
  const out = await svc.createPairingCode(EVENT, { gateTableId: GATE });
  assert.equal(out.ok, false);
  assert.equal(out.error, 'INVALID_GATE');
});

test('a pairing code is refused when no gate is supplied at all', async () => {
  mock.setResolver(() => ({}));
  const out = await svc.createPairingCode(EVENT, {});
  assert.equal(out.error, 'INVALID_GATE');
  // Rejected before any database work — resolveGate short-circuits on a null id.
  assert.equal(mock.calls.length, 0);
});

test('the device cap is enforced at issue time (decision D-16)', async () => {
  mock.setResolver(withGate(
    { id: GATE, table_name: 'Main entrance', element_type: 'zone', shape: 'entrance', event_id: EVENT },
    (s) => (s.table === 'event_devices' ? { count: svc.MAX_DEVICES_PER_EVENT, data: [] } : {}),
  ));
  const out = await svc.createPairingCode(EVENT, { gateTableId: GATE });
  assert.equal(out.ok, false);
  assert.equal(out.error, 'DEVICE_LIMIT_REACHED');
  assert.equal(out.limit, svc.MAX_DEVICES_PER_EVENT);
});

test('the gate cap and the device cap are independent — several devices may share one gate', async () => {
  // §21.7 / A-17: a busy main entrance legitimately runs two tablets. Gate binding
  // constrains WHERE, the cap constrains HOW MANY.
  let inserted = null;
  mock.setResolver(withGate(
    { id: GATE, table_name: 'Main entrance', element_type: 'zone', shape: 'entrance', event_id: EVENT },
    (s) => {
      if (s.table === 'event_devices') return { count: 2, data: [] };
      if (s.table === 'event_device_pairing_codes' && s.op === 'insert') {
        inserted = s.payload;
        return { data: { id: 'pair-1', expires_at: iso(600000) } };
      }
      return {};
    },
  ));

  const out = await svc.createPairingCode(EVENT, { gateTableId: GATE });
  assert.equal(out.ok, true, 'a second device on the same gate must be allowed');
  assert.equal(inserted.gate_table_id, GATE);
});

test('only the HASH of a pairing code is persisted, and the gate name is snapshotted', async () => {
  let inserted = null;
  mock.setResolver(withGate(
    { id: GATE, table_name: 'Garden gate', element_type: 'zone', shape: 'entrance', event_id: EVENT },
    (s) => {
      if (s.table === 'event_devices') return { count: 0, data: [] };
      if (s.table === 'event_device_pairing_codes' && s.op === 'insert') {
        inserted = s.payload;
        return { data: { id: 'pair-1', expires_at: iso(600000) } };
      }
      return {};
    },
  ));

  const out = await svc.createPairingCode(EVENT, { gateTableId: GATE });
  assert.equal(out.ok, true);
  assert.equal(inserted.code_hash, sha(out.code));
  assert.ok(!JSON.stringify(inserted).includes(out.code), 'plaintext code must not be stored');
  // Snapshotted so a code issued before a rename still pairs with the name the
  // organizer saw when they generated it.
  assert.equal(inserted.device_label, 'Garden gate');
  assert.equal(out.deviceLabel, 'Garden gate');
});

test('reassigning a device updates the device only — history keeps its gate', async () => {
  let devicePatch = null;
  const touched = [];
  mock.setResolver(withGate(
    { id: GATE, table_name: 'Garden gate', element_type: 'zone', shape: 'entrance', event_id: EVENT },
    (s) => {
      touched.push(s.table);
      if (s.table === 'event_devices' && s.op === 'update') {
        devicePatch = s.payload;
        return { data: [{ id: DEVICE }] };
      }
      return {};
    },
  ));

  const out = await svc.reassignDeviceGate(EVENT, DEVICE, GATE);
  assert.equal(out.ok, true);
  assert.equal(devicePatch.gate_table_id, GATE);
  assert.equal(devicePatch.device_label, 'Garden gate');
  // §18.6: attribution is written at creation time and immutable thereafter.
  // Rewriting it would make the audit trail lie about where a guest walked in.
  assert.equal(touched.includes('check_ins'), false, 'check_ins must never be rewritten');
});

test('reassigning to an invalid gate is refused', async () => {
  mock.setResolver(withGate(null));
  const out = await svc.reassignDeviceGate(EVENT, DEVICE, GATE);
  assert.equal(out.error, 'INVALID_GATE');
});

test('an expired pairing code is refused', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_device_pairing_codes' && s.op === 'select') {
      return { data: { id: 'p1', event_id: EVENT, device_label: 'Main', expires_at: iso(-1000), consumed_at: null } };
    }
    return {};
  });
  const out = await svc.redeemPairingCode('ABCD2345');
  assert.equal(out.ok, false);
  assert.equal(out.error, 'CODE_EXPIRED');
});

test('an unknown or already-consumed code is refused', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_device_pairing_codes' && s.op === 'select') return { data: null };
    return {};
  });
  const out = await svc.redeemPairingCode('ABCD2345');
  assert.equal(out.ok, false);
  assert.equal(out.error, 'INVALID_CODE');
});

test('a wrong-length code is rejected without a database lookup', async () => {
  mock.setResolver(() => ({}));
  const out = await svc.redeemPairingCode('AB');
  assert.equal(out.error, 'INVALID_CODE');
  assert.equal(mock.calls.length, 0);
});

test('redeeming issues tokens and stores only their hashes, carrying the gate through', async () => {
  let deviceInsert = null;
  mock.setResolver((s) => {
    if (s.table === 'event_device_pairing_codes' && s.op === 'select') {
      return { data: { id: 'p1', event_id: EVENT, gate_table_id: GATE, device_label: 'Main entrance', expires_at: iso(60000), consumed_at: null } };
    }
    if (s.table === 'event_devices' && s.op === 'insert') {
      deviceInsert = s.payload;
      return { data: { id: DEVICE, event_id: EVENT, device_label: 'Main entrance' } };
    }
    if (s.table === 'event_device_pairing_codes' && s.op === 'update') return { data: [{ id: 'p1' }] };
    return {};
  });

  const out = await svc.redeemPairingCode('ABCD2345', { fingerprint: { model: 'Tab A9' }, appVersion: '1.0.0' });
  assert.equal(out.ok, true);
  assert.equal(deviceInsert.gate_table_id, GATE, 'the gate binding must survive redemption');
  assert.equal(deviceInsert.token_hash, sha(out.accessToken));
  assert.equal(deviceInsert.refresh_token_hash, sha(out.refreshToken));
  const stored = JSON.stringify(deviceInsert);
  assert.ok(!stored.includes(out.accessToken), 'raw access token must not be stored');
  assert.ok(!stored.includes(out.refreshToken), 'raw refresh token must not be stored');
});

test('losing the single-use race removes the orphan device and refuses the code', async () => {
  const deleted = [];
  mock.setResolver((s) => {
    if (s.table === 'event_device_pairing_codes' && s.op === 'select') {
      return { data: { id: 'p1', event_id: EVENT, device_label: 'Main', expires_at: iso(60000), consumed_at: null } };
    }
    if (s.table === 'event_devices' && s.op === 'insert') {
      return { data: { id: DEVICE, event_id: EVENT, device_label: 'Main' } };
    }
    // Another request consumed the code first — the guarded update matches nothing.
    if (s.table === 'event_device_pairing_codes' && s.op === 'update') return { data: [] };
    if (s.table === 'event_devices' && s.op === 'delete') { deleted.push(s.filters); return {}; }
    return {};
  });

  const out = await svc.redeemPairingCode('ABCD2345');
  assert.equal(out.ok, false);
  assert.equal(out.error, 'INVALID_CODE');
  assert.equal(deleted.length, 1, 'the half-provisioned device must be cleaned up');
});

// ══════════════════════════════════════════════════════════════════
// Device token lifecycle (§18.4)
// ══════════════════════════════════════════════════════════════════

test('a valid device token resolves', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'select') {
      return { data: { id: DEVICE, event_id: EVENT, device_label: 'Main', is_active: true, revoked_at: null, wipe_requested_at: null, token_issued_at: iso(-1000) } };
    }
    return {};
  });
  const out = await svc.resolveDeviceToken('tok');
  assert.equal(out.ok, true);
  assert.equal(out.device.event_id, EVENT);
});

test('a revoked device is refused and told to wipe', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'select') {
      return { data: { id: DEVICE, event_id: EVENT, is_active: false, revoked_at: iso(-5000), token_issued_at: iso(-1000) } };
    }
    return {};
  });
  const out = await svc.resolveDeviceToken('tok');
  assert.equal(out.error, 'DEVICE_REVOKED');
  assert.equal(out.wipeRequired, true);
});

test('an expired access token reports TOKEN_EXPIRED — never a wipe, never a stop', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'select') {
      return { data: { id: DEVICE, event_id: EVENT, is_active: true, revoked_at: null, wipe_requested_at: null,
        token_issued_at: iso(-(svc.DEVICE_ACCESS_TTL_MS + 60000)) } };
    }
    return {};
  });
  const out = await svc.resolveDeviceToken('tok');
  assert.equal(out.error, 'TOKEN_EXPIRED');
  assert.notEqual(out.wipeRequired, true, 'expiry must never instruct a wipe');
});

test('refresh rotates BOTH tokens', async () => {
  let patch = null;
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'select') {
      return { data: { id: DEVICE, event_id: EVENT, is_active: true, revoked_at: null, refresh_issued_at: iso(-1000) } };
    }
    if (s.table === 'event_devices' && s.op === 'update') { patch = s.payload; return {}; }
    return {};
  });

  const out = await svc.refreshDeviceToken('old-refresh');
  assert.equal(out.ok, true);
  assert.equal(patch.token_hash, sha(out.accessToken));
  assert.equal(patch.refresh_token_hash, sha(out.refreshToken));
  assert.notEqual(out.accessToken, out.refreshToken);
});

test('a refresh token older than its 90-day life is refused', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'select') {
      return { data: { id: DEVICE, event_id: EVENT, is_active: true, revoked_at: null,
        refresh_issued_at: iso(-(svc.DEVICE_REFRESH_TTL_MS + 1000)) } };
    }
    return {};
  });
  const out = await svc.refreshDeviceToken('old');
  assert.equal(out.error, 'REFRESH_EXPIRED');
});

test('revoking clears the tokens rather than only flagging the row', async () => {
  let patch = null;
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'update') { patch = s.payload; return { data: [{ id: DEVICE }] }; }
    return {};
  });
  const out = await svc.revokeDevice(EVENT, DEVICE, { actorId: 'admin-1' });
  assert.equal(out.ok, true);
  assert.equal(patch.is_active, false);
  assert.equal(patch.refresh_token_hash, null);
  assert.ok(patch.token_hash.startsWith('revoked:'), 'the old token hash must stop matching');
  assert.ok(patch.wipe_requested_at, 'revocation implies a wipe');
});

test('listDevices reports whether each device is actually PREPARED, not just paired', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'select') {
      return { data: [
        { id: 'd1', device_label: 'Main', is_active: true, revoked_at: null, bundle_version: 4, battery_level: 82 },
        { id: 'd2', device_label: 'Spare', is_active: true, revoked_at: null, bundle_version: null, battery_level: 15 },
      ] };
    }
    return {};
  });
  const out = await svc.listDevices(EVENT);
  assert.equal(out[0].isPrepared, true);
  // An unprepared spare is worthless at a venue with no internet (§21.7).
  assert.equal(out[1].isPrepared, false);
});

// ══════════════════════════════════════════════════════════════════
// Heartbeat hardening
// ══════════════════════════════════════════════════════════════════

test('heartbeat values are clamped, so a malfunctioning client cannot violate the CHECKs', async () => {
  let patch = null;
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'update') { patch = s.payload; return {}; }
    return {};
  });
  await svc.recordDeviceHeartbeat(DEVICE, { batteryLevel: 900, storageFreeMb: -5, queueDepth: -1 });
  assert.equal(patch.battery_level, 100);
  assert.equal(patch.storage_free_mb, 0);
  assert.equal(patch.queue_depth, 0);
});

test('heartbeat ignores non-numeric junk instead of writing NaN', async () => {
  let patch = null;
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'update') { patch = s.payload; return {}; }
    return {};
  });
  await svc.recordDeviceHeartbeat(DEVICE, { batteryLevel: 'full' });
  assert.equal('battery_level' in patch, false);
  assert.ok(patch.last_seen_at);
});

// ══════════════════════════════════════════════════════════════════
// Staff roster (§18.5)
// ══════════════════════════════════════════════════════════════════

test('a PIN must be exactly four digits', async () => {
  mock.setResolver(() => ({}));
  for (const pin of ['123', '12345', 'abcd', '', null, '12 4']) {
    const out = await svc.createStaff(EVENT, { displayName: 'Amina', pin });
    assert.equal(out.error, 'INVALID_PIN', `accepted a bad pin: ${pin}`);
  }
});

test('only usher and supervisor are roster roles — organizer/admin are platform identities', async () => {
  mock.setResolver(() => ({}));
  for (const role of ['organizer', 'admin', 'root']) {
    const out = await svc.createStaff(EVENT, { displayName: 'X', role, pin: '1234' });
    assert.equal(out.error, 'INVALID_ROLE');
  }
});

test('the PIN is hashed, never stored in plaintext, and never returned', async () => {
  let inserted = null;
  mock.setResolver((s) => {
    if (s.table === 'event_staff' && s.op === 'insert') {
      inserted = s.payload;
      return { data: { id: 'staff-1', display_name: 'Amina', role: 'supervisor', is_active: true } };
    }
    return {};
  });

  const out = await svc.createStaff(EVENT, { displayName: 'Amina', role: 'supervisor', pin: '4821' });
  assert.equal(out.ok, true);
  assert.ok(!JSON.stringify(inserted).includes('4821'), 'plaintext PIN must never be stored');
  assert.ok(/^[0-9a-f]{32}:[0-9a-f]{128}$/.test(inserted.pin_hash), 'expected salt:pbkdf2 hash');
  assert.equal(JSON.stringify(out).includes('4821'), false, 'plaintext PIN must never be returned');
});

test('a duplicate active name is refused — two "Amina"s are unresolvable at the door', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_staff' && s.op === 'insert') return { error: { code: '23505' } };
    return {};
  });
  const out = await svc.createStaff(EVENT, { displayName: 'Amina', pin: '1234' });
  assert.equal(out.error, 'DUPLICATE_NAME');
});

test('listStaff never leaks pin_hash — that belongs in the bundle and nowhere else', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_staff' && s.op === 'select') {
      return { data: [{ id: 's1', display_name: 'Amina', role: 'usher', is_active: true, pin_hash: 'SECRET' }] };
    }
    return {};
  });
  const out = await svc.listStaff(EVENT);
  assert.ok(!JSON.stringify(out).includes('SECRET'));
  assert.equal(out[0].displayName, 'Amina');
});

test('a correct PIN verifies and a wrong one does not', async () => {
  // Hash a real PIN through the production hasher, then verify against it.
  let stored = null;
  mock.setResolver((s) => {
    if (s.table === 'event_staff' && s.op === 'insert') {
      stored = s.payload.pin_hash;
      return { data: { id: 's1', display_name: 'Amina', role: 'supervisor', is_active: true } };
    }
    if (s.table === 'event_staff' && s.op === 'select') {
      return { data: { id: 's1', display_name: 'Amina', role: 'supervisor', is_active: true, pin_hash: stored } };
    }
    return {};
  });

  await svc.createStaff(EVENT, { displayName: 'Amina', role: 'supervisor', pin: '4821' });
  const good = await svc.verifyStaffPin(EVENT, 's1', '4821');
  assert.equal(good.ok, true);
  assert.equal(good.staff.role, 'supervisor');

  const bad = await svc.verifyStaffPin(EVENT, 's1', '4822');
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'INVALID_PIN');
});

test('a deactivated staff member cannot authenticate', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_staff' && s.op === 'select') {
      return { data: { id: 's1', display_name: 'Amina', role: 'usher', is_active: false, pin_hash: 'x:y' } };
    }
    return {};
  });
  const out = await svc.verifyStaffPin(EVENT, 's1', '1234');
  assert.equal(out.error, 'UNKNOWN_STAFF');
});

// ══════════════════════════════════════════════════════════════════
// Device auth middleware
// ══════════════════════════════════════════════════════════════════

test('the Device scheme is distinct from Bearer so an organizer JWT is never confused for a device token', () => {
  assert.equal(extractDeviceToken(mockReq({ headers: { authorization: 'Device abc' } })), 'abc');
  assert.equal(extractDeviceToken(mockReq({ headers: { authorization: 'Bearer abc' } })), null);
  assert.equal(extractDeviceToken(mockReq({})), null);
});

test('a missing device token is 401', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(requireDevice, mockReq({ params: {} }));
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'DEVICE_UNAUTHENTICATED');
});

test('a revoked device gets 403 plus an explicit wipe instruction', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'select') {
      return { data: { id: DEVICE, event_id: EVENT, is_active: false, revoked_at: iso(-1000), token_issued_at: iso(-1000) } };
    }
    return {};
  });
  const { res } = await invoke(requireDevice,
    mockReq({ params: {}, headers: { authorization: 'Device tok' } }));
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'DEVICE_REVOKED');
  assert.equal(res.body.meta.wipe_required, true);
});

test('an expired token is 401 and carries NO wipe instruction', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'select') {
      return { data: { id: DEVICE, event_id: EVENT, is_active: true, revoked_at: null, wipe_requested_at: null,
        token_issued_at: iso(-(svc.DEVICE_ACCESS_TTL_MS + 1000)) } };
    }
    return {};
  });
  const { res } = await invoke(requireDevice,
    mockReq({ params: {}, headers: { authorization: 'Device tok' } }));
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'TOKEN_EXPIRED');
  assert.equal(res.body.meta, undefined);
});

test('a device token pins the request to its OWN event', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'select') {
      return { data: { id: DEVICE, event_id: EVENT, device_label: 'Main', is_active: true, revoked_at: null, wipe_requested_at: null, token_issued_at: iso(-1000) } };
    }
    return {};
  });
  const req = mockReq({ params: {}, headers: { authorization: 'Device tok' } });
  const { res, next } = await invoke(requireDevice, req);
  assert.equal(next, true);
  assert.equal(res.finished, false);
  assert.equal(req.params.eventId, EVENT);
  assert.equal(req.device.label, 'Main');
});

test('a path eventId that disagrees with the token is rejected, not silently rewritten', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'select') {
      return { data: { id: DEVICE, event_id: EVENT, device_label: 'Main', is_active: true, revoked_at: null, wipe_requested_at: null, token_issued_at: iso(-1000) } };
    }
    return {};
  });
  const { res } = await invoke(requireDevice,
    mockReq({ params: { eventId: EVENT_B }, headers: { authorization: 'Device tok' } }));
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'DEVICE_EVENT_MISMATCH');
});

// ══════════════════════════════════════════════════════════════════
// Controller surface
// ══════════════════════════════════════════════════════════════════

test('POST pair returns 201 with both tokens', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_device_pairing_codes' && s.op === 'select') {
      return { data: { id: 'p1', event_id: EVENT, device_label: 'Main', expires_at: iso(60000), consumed_at: null } };
    }
    if (s.table === 'event_devices' && s.op === 'insert') {
      return { data: { id: DEVICE, event_id: EVENT, device_label: 'Main' } };
    }
    if (s.table === 'event_device_pairing_codes' && s.op === 'update') return { data: [{ id: 'p1' }] };
    return {};
  });

  const { res } = await invoke(ctrl.pairDevice, mockReq({ body: { code: 'ABCD2345' } }));
  assert.equal(res.statusCode, 201);
  assert.ok(res.body.data.accessToken);
  assert.ok(res.body.data.refreshToken);
  assert.equal(res.body.data.eventId, EVENT);
});

test('an expired code surfaces as 410 Gone, distinguishable from a wrong code', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_device_pairing_codes' && s.op === 'select') {
      return { data: { id: 'p1', event_id: EVENT, device_label: 'Main', expires_at: iso(-1000), consumed_at: null } };
    }
    return {};
  });
  const { res } = await invoke(ctrl.pairDevice, mockReq({ body: { code: 'ABCD2345' } }));
  assert.equal(res.statusCode, 410);
  assert.equal(res.body.error, 'CODE_EXPIRED');
});

test('the device cap surfaces as 409 with the limit attached', async () => {
  mock.setResolver(withGate(
    { id: GATE, table_name: 'Seventh door', element_type: 'zone', shape: 'entrance', event_id: EVENT },
    (s) => (s.table === 'event_devices' ? { count: svc.MAX_DEVICES_PER_EVENT, data: [] } : {}),
  ));
  const { res } = await invoke(ctrl.createPairingCode,
    mockReq({ params: { eventId: EVENT }, body: { gateTableId: GATE }, user: { id: 'u1' } }));
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.meta.limit, svc.MAX_DEVICES_PER_EVENT);
});

test('a pairing request naming a gate that is not an entrance is 400, not 409', async () => {
  // The two failures need different remedies: pick a different gate versus revoke
  // a device. Collapsing them would send an organizer looking in the wrong place.
  mock.setResolver(withGate(
    { id: GATE, table_name: 'Table 4', element_type: 'table', shape: 'round', event_id: EVENT },
  ));
  const { res } = await invoke(ctrl.createPairingCode,
    mockReq({ params: { eventId: EVENT }, body: { gateTableId: GATE }, user: { id: 'u1' } }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'INVALID_GATE');
});

test('the gates endpoint reports canProvision=false when the map has no entrance', async () => {
  // §A-17: provisioning is unavailable until the map defines a named entrance,
  // and the UI must say so rather than show an empty dropdown.
  mock.setResolver((s) => (s.table === 'tables' ? { data: [] } : {}));
  const { res } = await invoke(ctrl.listGates,
    mockReq({ params: { eventId: EVENT }, user: { id: 'u1' } }));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.gates, []);
  assert.equal(res.body.data.canProvision, false);
});

test('revoking a device writes an audit row', async () => {
  const audits = [];
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'update') return { data: [{ id: DEVICE }] };
    if (s.table === 'activity_logs' && s.op === 'insert') { audits.push(s.payload); return {}; }
    return {};
  });
  const { res } = await invoke(ctrl.revokeDevice,
    mockReq({ params: { eventId: EVENT, deviceId: DEVICE }, user: { id: 'admin-1' } }));
  assert.equal(res.statusCode, 200);
  assert.equal(audits[0].action, 'checkin_device_revoked');
  assert.equal(audits[0].actor_id, 'admin-1');
});

test('revoking an unknown device is 404', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_devices' && s.op === 'update') return { data: [] };
    return {};
  });
  const { res } = await invoke(ctrl.revokeDevice,
    mockReq({ params: { eventId: EVENT, deviceId: DEVICE }, user: { id: 'admin-1' } }));
  assert.equal(res.statusCode, 404);
});
