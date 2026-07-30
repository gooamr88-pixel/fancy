/**
 * Device provisioning + staff roster for the check-in app (spec §18).
 *
 * Two independent identities, deliberately never conflated:
 *   • DEVICE — proves this tablet may hold this event's guest data. Paired from
 *     the web dashboard, revocable, stored in the Android Keystore.
 *   • STAFF  — proves who is operating the tablet right now. A 4-digit PIN
 *     checked offline against a hash shipped in the bundle.
 *
 * Losing the tablet compromises the first. It must not compromise the second.
 *
 * ── PIN hashing ──
 * §18.5 asks for bcrypt or Argon2id. Neither is a dependency here and adding a
 * native module to a pm2 cluster deploy is a real cost, so this reuses the
 * platform's existing PBKDF2-SHA512 at 600k iterations (authController) — a
 * slow hash by any measure, and the same primitive already guarding organizer
 * passwords. The requirement §18.5 is actually expressing is "not a fast hash
 * over a 10,000-value keyspace", and 600k PBKDF2 satisfies that.
 *
 * ── Tokens ──
 * Only HASHES are stored. A database read must never yield a credential that
 * impersonates a device. Same reasoning as sessions.jti elsewhere.
 */
const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const { hashPassword } = require('../controllers/authController');
const logger = require('../utils/logger');

/**
 * Matches authController's CURRENT_ITERATIONS. PIN hashes are always written by
 * hashPassword(), so they are always at this cost.
 */
const PIN_ITERATIONS = 600000;

/**
 * Verifies a PIN against a `salt:hash` PBKDF2 string.
 *
 * Deliberately NOT authController.verifyPassword, for two reasons: it is not
 * exported, and it carries a legacy 1,000-iteration fallback for old organizer
 * passwords. Accepting a 1,000-iteration match over a 10,000-value PIN keyspace
 * would be trivially brute-forceable — precisely what §18.5's slow-hash
 * requirement exists to prevent. There is no legacy PIN to be compatible with,
 * so there is no fallback here.
 */
function verifyPinHash(pin, storedHash) {
  return new Promise((resolve) => {
    if (!storedHash) return resolve(false);
    const [salt, expected] = String(storedHash).split(':');
    if (!salt || !expected) return resolve(false);

    let expectedBuf;
    try {
      expectedBuf = Buffer.from(expected, 'hex');
    } catch {
      return resolve(false);
    }

    crypto.pbkdf2(String(pin), salt, PIN_ITERATIONS, 64, 'sha512', (err, derived) => {
      if (err) return resolve(false);
      try {
        resolve(crypto.timingSafeEqual(derived, expectedBuf));
      } catch {
        resolve(false);
      }
    });
  });
}

/** Pairing codes: 8 chars, 10 minutes, single use (§18.3). */
const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
/** Unambiguous alphabet — no O/0, I/1/L, so a code read off a screen can be typed. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

/** Access token 24h, refresh 90d rotated on every use (§18.4). */
const DEVICE_ACCESS_TTL_MS = 24 * 60 * 60 * 1000;
const DEVICE_REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Default cap on devices per event (decision D-16). */
const MAX_DEVICES_PER_EVENT = 6;

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

/** Cryptographically uniform pick from CODE_ALPHABET — no modulo bias. */
function generatePairingCode() {
  let out = '';
  while (out.length < CODE_LENGTH) {
    for (const byte of crypto.randomBytes(CODE_LENGTH * 2)) {
      // Reject the tail that would skew the distribution.
      if (byte >= 256 - (256 % CODE_ALPHABET.length)) continue;
      out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (out.length === CODE_LENGTH) break;
    }
  }
  return out;
}

const normalizeCode = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Opaque 32-byte token. Not a JWT: it must be revocable server-side, always. */
const generateToken = () => crypto.randomBytes(32).toString('base64url');

// ══════════════════════════════════════════════════════════════════
// Pairing
// ══════════════════════════════════════════════════════════════════

/**
 * Lists the gates available for an event (amendment A-17).
 *
 * A gate is a named `entrance` element in the event's seating map. Discovery
 * (report §5A) confirmed the representation at all three layers: an entrance is
 * `element_type = 'zone'` with `shape = 'entrance'`. There is no dedicated
 * entrance table, and `getTables` filters those out by default — hence this
 * explicit query rather than reusing the existing table listing.
 *
 * `table_name` is NOT NULL in the database and required with a 400 by
 * createTable, so every gate is guaranteed to have a name. No defensive
 * defaulting is needed here.
 */
async function listGates(eventId) {
  const { data, error } = await supabase
    .from('tables')
    .select('id, table_name')
    .eq('event_id', eventId)
    .eq('element_type', 'zone')
    .eq('shape', 'entrance')
    .order('table_name', { ascending: true });
  if (error) throw error;

  return (data || []).map((g) => ({ id: g.id, name: g.table_name }));
}

/**
 * Resolves a gate id, confirming it is an entrance belonging to this event.
 *
 * Validated here rather than by a database CHECK because a CHECK cannot reach
 * another table. Both conditions matter: the wrong event would let one organizer
 * bind a device to another's venue, and the wrong element type would let a device
 * be labelled "Table 4" in every conflict report.
 */
async function resolveGate(eventId, gateTableId) {
  if (!gateTableId) return null;

  const { data, error } = await supabase
    .from('tables')
    .select('id, table_name, element_type, shape, event_id')
    .eq('id', gateTableId)
    .maybeSingle();
  if (error) throw error;

  if (!data) return null;
  if (data.event_id !== eventId) return null;
  if (data.element_type !== 'zone' || data.shape !== 'entrance') return null;

  return { id: data.id, name: data.table_name };
}

/**
 * Issues a pairing code for a new device. Returns the PLAINTEXT code — the only
 * time it is ever available. Caller displays it as text + QR and never logs it.
 *
 * The device binds to a GATE, not a free-text label (amendment A-17): the
 * organizer picks an entrance that exists on the seating map, so the venue layout
 * is the single source of truth for the names that appear in the audit trail and
 * in conflict reports.
 */
async function createPairingCode(eventId, { gateTableId, createdBy }) {
  const gate = await resolveGate(eventId, gateTableId);
  if (!gate) return { ok: false, error: 'INVALID_GATE' };

  const { count, error: countErr } = await supabase
    .from('event_devices')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('is_active', true);
  if (countErr) throw countErr;

  // A cap makes an unexpected extra device visible rather than silent (§21.7).
  if ((count || 0) >= MAX_DEVICES_PER_EVENT) {
    return { ok: false, error: 'DEVICE_LIMIT_REACHED', limit: MAX_DEVICES_PER_EVENT };
  }

  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString();

  const { data, error } = await supabase
    .from('event_device_pairing_codes')
    .insert({
      event_id: eventId,
      code_hash: sha256(code),
      gate_table_id: gate.id,
      // Snapshotted so a code issued before a gate rename still pairs with the
      // name the organizer saw when they generated it.
      device_label: gate.name,
      expires_at: expiresAt,
      created_by: createdBy || null,
    })
    .select('id, expires_at')
    .single();
  if (error) throw error;

  return {
    ok: true,
    code,
    pairingId: data.id,
    expiresAt: data.expires_at,
    gateId: gate.id,
    deviceLabel: gate.name,
  };
}

/**
 * Moves a paired device to a different gate (amendment A-17).
 *
 * Available mid-event from the supervisor view and recorded in the audit trail by
 * the caller.
 *
 * Deliberately updates ONLY `event_devices`. Check-ins already recorded keep the
 * gate they were performed at, because §18.6 requires attribution be denormalised
 * and written at creation time — `check_ins.device_label` is a snapshot, not a
 * join. Rewriting history to match the device's current gate would make the audit
 * trail lie about where someone was admitted.
 */
async function reassignDeviceGate(eventId, deviceId, gateTableId) {
  const gate = await resolveGate(eventId, gateTableId);
  if (!gate) return { ok: false, error: 'INVALID_GATE' };

  const { data, error } = await supabase
    .from('event_devices')
    .update({ gate_table_id: gate.id, device_label: gate.name })
    .eq('id', deviceId)
    .eq('event_id', eventId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) return { ok: false, error: 'NOT_FOUND' };

  return { ok: true, gateId: gate.id, gateName: gate.name };
}

/**
 * Redeems a pairing code and provisions the device (§18.3 steps 4–6).
 *
 * Single-use is enforced by the partial unique index on (code_hash) WHERE
 * consumed_at IS NULL plus the consumed_at guard here — application logic alone
 * would race two simultaneous redemptions of the same code.
 */
async function redeemPairingCode(rawCode, { fingerprint = {}, appVersion = null } = {}) {
  const code = normalizeCode(rawCode);
  if (code.length !== CODE_LENGTH) return { ok: false, error: 'INVALID_CODE' };

  const { data: pairing, error } = await supabase
    .from('event_device_pairing_codes')
    .select('id, event_id, gate_table_id, device_label, expires_at, consumed_at')
    .eq('code_hash', sha256(code))
    .is('consumed_at', null)
    .maybeSingle();
  if (error) throw error;

  if (!pairing) return { ok: false, error: 'INVALID_CODE' };
  if (new Date(pairing.expires_at).getTime() < Date.now()) {
    return { ok: false, error: 'CODE_EXPIRED' };
  }

  const accessToken = generateToken();
  const refreshToken = generateToken();

  const { data: device, error: deviceErr } = await supabase
    .from('event_devices')
    .insert({
      event_id: pairing.event_id,
      gate_table_id: pairing.gate_table_id,
      device_label: pairing.device_label,
      token_hash: sha256(accessToken),
      refresh_token_hash: sha256(refreshToken),
      fingerprint: fingerprint && typeof fingerprint === 'object' ? fingerprint : {},
      app_version: appVersion,
      last_seen_at: new Date().toISOString(),
    })
    .select('id, event_id, device_label')
    .single();
  if (deviceErr) throw deviceErr;

  // Claim the code only AFTER the device exists — a failed insert must leave
  // the code redeemable rather than burning it.
  const { data: claimed, error: claimErr } = await supabase
    .from('event_device_pairing_codes')
    .update({ consumed_at: new Date().toISOString(), consumed_device_id: device.id })
    .eq('id', pairing.id)
    .is('consumed_at', null)
    .select('id');
  if (claimErr) throw claimErr;

  // Lost the race: another request consumed this code first. Undo our device.
  if (!claimed || claimed.length === 0) {
    await supabase.from('event_devices').delete().eq('id', device.id);
    return { ok: false, error: 'INVALID_CODE' };
  }

  return {
    ok: true,
    deviceId: device.id,
    eventId: device.event_id,
    deviceLabel: device.device_label,
    accessToken,
    refreshToken,
    accessExpiresAt: new Date(Date.now() + DEVICE_ACCESS_TTL_MS).toISOString(),
    refreshExpiresAt: new Date(Date.now() + DEVICE_REFRESH_TTL_MS).toISOString(),
  };
}

/**
 * Resolves a device access token.
 *
 * NOTE ON EXPIRY — this is the rule that matters most (§18.4). A tablet six
 * hours offline at a venue has an expired access token. Expiry governs SYNC,
 * never LOCAL OPERATION: the device keeps scanning and queueing regardless.
 * That is enforced on the device, not here. Here, an expired token simply gets
 * a 401 carrying TOKEN_EXPIRED so the client knows to refresh rather than to
 * wipe or to stop.
 */
async function resolveDeviceToken(token) {
  if (!token) return { ok: false, error: 'NO_TOKEN' };

  const { data: device, error } = await supabase
    .from('event_devices')
    .select('id, event_id, device_label, is_active, revoked_at, wipe_requested_at, token_issued_at')
    .eq('token_hash', sha256(token))
    .maybeSingle();
  if (error) throw error;

  if (!device) return { ok: false, error: 'INVALID_TOKEN' };

  // Revocation is immediate and instructs the device to destroy local data.
  if (!device.is_active || device.revoked_at) {
    return { ok: false, error: 'DEVICE_REVOKED', wipeRequired: true };
  }
  if (device.wipe_requested_at) {
    return { ok: false, error: 'WIPE_REQUESTED', wipeRequired: true, device };
  }

  const age = Date.now() - new Date(device.token_issued_at).getTime();
  if (age > DEVICE_ACCESS_TTL_MS) return { ok: false, error: 'TOKEN_EXPIRED', device };

  return { ok: true, device };
}

/** Rotates both tokens. The refresh token is single-use by construction. */
async function refreshDeviceToken(refreshToken) {
  if (!refreshToken) return { ok: false, error: 'NO_TOKEN' };

  const { data: device, error } = await supabase
    .from('event_devices')
    .select('id, event_id, device_label, is_active, revoked_at, refresh_issued_at')
    .eq('refresh_token_hash', sha256(refreshToken))
    .maybeSingle();
  if (error) throw error;

  if (!device) return { ok: false, error: 'INVALID_TOKEN' };
  if (!device.is_active || device.revoked_at) {
    return { ok: false, error: 'DEVICE_REVOKED', wipeRequired: true };
  }
  // 90 days, and it rotates on every use — so this only trips on a tablet that
  // has been out of contact for a full season.
  if (Date.now() - new Date(device.refresh_issued_at).getTime() > DEVICE_REFRESH_TTL_MS) {
    return { ok: false, error: 'REFRESH_EXPIRED' };
  }

  const accessToken = generateToken();
  const nextRefresh = generateToken();
  const now = new Date().toISOString();

  const { error: updErr } = await supabase
    .from('event_devices')
    .update({
      token_hash: sha256(accessToken),
      refresh_token_hash: sha256(nextRefresh),
      token_issued_at: now,
      refresh_issued_at: now,
      last_seen_at: now,
    })
    .eq('id', device.id)
    .is('revoked_at', null);
  if (updErr) throw updErr;

  return {
    ok: true,
    deviceId: device.id,
    eventId: device.event_id,
    accessToken,
    refreshToken: nextRefresh,
    accessExpiresAt: new Date(Date.now() + DEVICE_ACCESS_TTL_MS).toISOString(),
  };
}

/** Records device health so a failing tablet is visible before it dies (§21.7). */
async function recordDeviceHeartbeat(deviceId, { batteryLevel, storageFreeMb, bundleVersion, queueDepth, appVersion } = {}) {
  const patch = { last_seen_at: new Date().toISOString() };
  const clampInt = (v, lo, hi) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return undefined;
    return Math.min(Math.max(Math.trunc(n), lo), hi);
  };

  const battery = clampInt(batteryLevel, 0, 100);
  if (battery !== undefined) patch.battery_level = battery;
  const storage = clampInt(storageFreeMb, 0, 2 ** 31 - 1);
  if (storage !== undefined) patch.storage_free_mb = storage;
  const queue = clampInt(queueDepth, 0, 2 ** 31 - 1);
  if (queue !== undefined) patch.queue_depth = queue;
  const bundle = clampInt(bundleVersion, 0, Number.MAX_SAFE_INTEGER);
  if (bundle !== undefined) patch.bundle_version = bundle;
  if (appVersion) patch.app_version = String(appVersion).slice(0, 40);

  const { error } = await supabase.from('event_devices').update(patch).eq('id', deviceId);
  if (error) logger.warn({ err: error, deviceId }, '[checkinDevice] heartbeat write failed');
}

async function listDevices(eventId) {
  const { data, error } = await supabase
    .from('event_devices')
    .select('id, gate_table_id, device_label, is_active, revoked_at, wipe_requested_at, last_seen_at, battery_level, storage_free_mb, bundle_version, queue_depth, app_version, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  return (data || []).map((d) => ({
    id: d.id,
    gateId: d.gate_table_id,
    // The snapshot, not a join. A gate deleted out from under a device (only
    // possible via a direct database write — the API guards it) leaves
    // gate_table_id null while the name survives, so the audit trail stays
    // readable rather than showing a blank gate.
    label: d.device_label,
    gateMissing: d.gate_table_id === null,
    isActive: !!d.is_active && !d.revoked_at,
    revokedAt: d.revoked_at,
    wipePending: !!d.wipe_requested_at,
    lastSeenAt: d.last_seen_at,
    batteryLevel: d.battery_level,
    storageFreeMb: d.storage_free_mb,
    bundleVersion: d.bundle_version,
    queueDepth: d.queue_depth,
    appVersion: d.app_version,
    // A spare is only useful if it is PREPARED (§21.7). Surfacing this is what
    // lets a supervisor see, before the event, which devices are actually armed.
    isPrepared: d.bundle_version != null,
  }));
}

/**
 * Revokes a device. Rejected on next contact and told to wipe (§20.5).
 *
 * Tokens are cleared immediately rather than merely flagged — a revoked device
 * must not authenticate again even if the is_active check were ever bypassed.
 */
async function revokeDevice(eventId, deviceId, { actorId }) {
  const { data, error } = await supabase
    .from('event_devices')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_by: actorId || null,
      wipe_requested_at: new Date().toISOString(),
      token_hash: `revoked:${crypto.randomUUID()}`,
      refresh_token_hash: null,
    })
    .eq('id', deviceId)
    .eq('event_id', eventId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true };
}

/** Remote wipe without revoking — the tablet stays paired for future events. */
async function requestWipe(eventId, deviceId) {
  const { data, error } = await supabase
    .from('event_devices')
    .update({ wipe_requested_at: new Date().toISOString() })
    .eq('id', deviceId)
    .eq('event_id', eventId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true };
}

async function confirmWipe(deviceId) {
  const { error } = await supabase
    .from('event_devices')
    .update({ wipe_confirmed_at: new Date().toISOString(), wipe_requested_at: null, bundle_version: null })
    .eq('id', deviceId);
  if (error) throw error;
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════════
// Staff roster (§18.5)
// ══════════════════════════════════════════════════════════════════

const PIN_REGEX = /^\d{4}$/;

/**
 * Adds a staff member. The PIN is hashed here and the plaintext is discarded —
 * it is never stored, never returned, and never logged (§18.5).
 */
async function createStaff(eventId, { displayName, role = 'usher', pin }) {
  const name = String(displayName || '').trim();
  if (!name) return { ok: false, error: 'NAME_REQUIRED' };
  if (name.length > 80) return { ok: false, error: 'NAME_TOO_LONG' };
  if (!['usher', 'supervisor'].includes(role)) return { ok: false, error: 'INVALID_ROLE' };
  if (!PIN_REGEX.test(String(pin || ''))) return { ok: false, error: 'INVALID_PIN' };

  const pinHash = await hashPassword(String(pin));

  const { data, error } = await supabase
    .from('event_staff')
    .insert({ event_id: eventId, display_name: name, role, pin_hash: pinHash })
    .select('id, display_name, role, is_active')
    .single();

  if (error) {
    // The partial unique index on (event_id, lower(trim(display_name)))
    // WHERE is_active — two active "Ahmed"s would be unresolvable at the door.
    if (error.code === '23505') return { ok: false, error: 'DUPLICATE_NAME' };
    throw error;
  }

  return { ok: true, staff: { id: data.id, displayName: data.display_name, role: data.role, isActive: data.is_active } };
}

async function listStaff(eventId) {
  const { data, error } = await supabase
    .from('event_staff')
    .select('id, display_name, role, is_active, pin_reset_at, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  // pin_hash is deliberately absent. It belongs in the bundle (where the device
  // needs it to authenticate offline) and nowhere else.
  return (data || []).map((s) => ({
    id: s.id, displayName: s.display_name, role: s.role,
    isActive: !!s.is_active, pinResetAt: s.pin_reset_at,
  }));
}

async function resetStaffPin(eventId, staffId, { pin, actorId }) {
  if (!PIN_REGEX.test(String(pin || ''))) return { ok: false, error: 'INVALID_PIN' };

  const pinHash = await hashPassword(String(pin));
  const { data, error } = await supabase
    .from('event_staff')
    .update({
      pin_hash: pinHash,
      pin_reset_at: new Date().toISOString(),
      pin_reset_by: actorId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', staffId)
    .eq('event_id', eventId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true };
}

async function deactivateStaff(eventId, staffId) {
  const { data, error } = await supabase
    .from('event_staff')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', staffId)
    .eq('event_id', eventId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true };
}

/**
 * The event's active roster, keyed by staff id.
 *
 * The enforcement point for §18.2: "Every privileged operation carries the acting
 * staff identity and is validated server-side against the roster for that event."
 *
 * ── What the server can and cannot verify ──
 *
 * It CANNOT re-check a PIN. Staff authenticate offline against a hash that
 * travelled in the bundle, possibly hours earlier at a venue with no signal —
 * there is no PIN to re-present at sync time, and demanding one would break the
 * offline-first design outright.
 *
 * It CAN verify that the claimed identity exists on this event's roster and holds
 * the required role, and it can supply the display name itself rather than
 * trusting the client's. That is what turns attribution from a client assertion
 * into a server-checked fact.
 */
async function getActiveRoster(eventId) {
  const { data, error } = await supabase
    .from('event_staff')
    .select('id, display_name, role')
    .eq('event_id', eventId)
    .eq('is_active', true);
  if (error) throw error;

  const byId = new Map();
  for (const s of data || []) {
    byId.set(s.id, { staffId: s.id, displayName: s.display_name, role: s.role });
  }
  return byId;
}

/**
 * Resolves an acting staff member and checks they hold a role.
 *
 * @returns {{ok:true, staff}|{ok:false, error:'UNKNOWN_STAFF'|'INSUFFICIENT_ROLE'}}
 */
async function authorizeStaff(eventId, staffId, requiredRole = null) {
  if (!staffId) return { ok: false, error: 'UNKNOWN_STAFF' };

  const roster = await getActiveRoster(eventId);
  const staff = roster.get(staffId);
  if (!staff) return { ok: false, error: 'UNKNOWN_STAFF' };

  if (requiredRole && staff.role !== requiredRole) {
    return { ok: false, error: 'INSUFFICIENT_ROLE', staff };
  }
  return { ok: true, staff };
}

/**
 * Server-side PIN verification. NOT the gate on privileged actions — see
 * `authorizeStaff`, which is.
 *
 * An earlier version of this comment claimed this validated overrides and undos
 * arriving over the network. It cannot, and the distinction matters enough to
 * record: staff authenticate OFFLINE against a hash that travelled in the
 * bundle, possibly hours earlier at a venue with no signal. By the time the
 * check-in syncs there is no PIN to re-present, and requiring one would break
 * offline-first outright. What the server can check is that the claimed identity
 * is on the event roster and holds the required role, which is what
 * `authorizeStaff` does and what §18.2 actually asks for.
 *
 * Retained because it is the server half of the PIN round-trip: the tests hash a
 * PIN through `createStaff` and verify it back through here, which pins the
 * stored hash format that `PinVerifier.kt` must reproduce exactly — including
 * the hex-string-as-salt quirk. If an online PIN challenge is ever added, this
 * is the function it calls.
 */
async function verifyStaffPin(eventId, staffId, pin) {
  const { data: staff, error } = await supabase
    .from('event_staff')
    .select('id, display_name, role, is_active, pin_hash')
    .eq('id', staffId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) throw error;
  if (!staff || !staff.is_active) return { ok: false, error: 'UNKNOWN_STAFF' };

  const valid = await verifyPinHash(String(pin || ''), staff.pin_hash);
  if (!valid) return { ok: false, error: 'INVALID_PIN' };

  return { ok: true, staff: { id: staff.id, displayName: staff.display_name, role: staff.role } };
}

module.exports = {
  PAIRING_CODE_TTL_MS,
  DEVICE_ACCESS_TTL_MS,
  DEVICE_REFRESH_TTL_MS,
  MAX_DEVICES_PER_EVENT,
  CODE_LENGTH,
  sha256,
  verifyPinHash,
  listGates,
  resolveGate,
  reassignDeviceGate,
  generatePairingCode,
  normalizeCode,
  createPairingCode,
  redeemPairingCode,
  resolveDeviceToken,
  refreshDeviceToken,
  recordDeviceHeartbeat,
  listDevices,
  revokeDevice,
  requestWipe,
  confirmWipe,
  createStaff,
  listStaff,
  resetStaffPin,
  deactivateStaff,
  verifyStaffPin,
  getActiveRoster,
  authorizeStaff,
};
