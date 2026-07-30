/**
 * Device provisioning + staff roster endpoints (spec §18).
 *
 * Two audiences, deliberately separated in the route table:
 *   • Organizer/admin (session auth) — create pairing codes, list/revoke
 *     devices, manage the staff roster.
 *   • The tablet itself (no auth for pairing, device token thereafter) —
 *     redeem a pairing code, refresh a token, confirm a wipe.
 */
const { supabase } = require('../config/supabase');
const deviceService = require('../services/checkinDeviceService');
const { sendOk, sendFail } = require('../utils/responseEnvelope');
const logger = require('../utils/logger');

const FAIL_STATUS = {
  // A-17: the gate must be a named entrance on THIS event's seating map.
  INVALID_GATE: 400,
  DEVICE_LIMIT_REACHED: 409,
  INVALID_CODE: 400,
  CODE_EXPIRED: 410,
  NOT_FOUND: 404,
  NAME_REQUIRED: 400,
  NAME_TOO_LONG: 400,
  INVALID_ROLE: 400,
  INVALID_PIN: 400,
  DUPLICATE_NAME: 409,
  UNKNOWN_STAFF: 404,
  INVALID_TOKEN: 401,
  DEVICE_REVOKED: 403,
  REFRESH_EXPIRED: 401,
  NO_TOKEN: 401,
};

const fail = (res, result, fallback = 400) => sendFail(res, {
  status: FAIL_STATUS[result.error] || fallback,
  error: result.error || 'ERROR',
  meta: result.limit ? { limit: result.limit } : undefined,
});

// ─────────────────────────────────────────────────────────
// Organizer-facing: devices
// ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/checkin/events/:eventId/gates
 *
 * The entrances defined on this event's seating map (amendment A-17).
 *
 * An empty list is a meaningful answer, not an error: device provisioning is
 * unavailable until the map defines at least one named entrance, and the UI must
 * say so plainly and link to the map editor rather than showing a blank dropdown.
 */
const listGates = async (req, res, next) => {
  try {
    const gates = await deviceService.listGates(req.params.eventId);
    return sendOk(res, { gates, canProvision: gates.length > 0 });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/checkin/events/:eventId/devices/pairing-codes */
const createPairingCode = async (req, res, next) => {
  try {
    const result = await deviceService.createPairingCode(req.params.eventId, {
      gateTableId: req.body?.gateTableId,
      createdBy: req.user?.id || null,
    });
    if (!result.ok) return fail(res, result);

    // The plaintext code is returned exactly once and never logged.
    logger.info({ eventId: req.params.eventId, pairingId: result.pairingId }, '[checkinDevice] pairing code issued');

    return sendOk(res, {
      code: result.code,
      gateId: result.gateId,
      deviceLabel: result.deviceLabel,
      expiresAt: result.expiresAt,
      ttlSeconds: Math.round(deviceService.PAIRING_CODE_TTL_MS / 1000),
    }, { status: 201 });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/checkin/events/:eventId/devices/:deviceId/gate
 *
 * Moves a device to another gate mid-event (amendment A-17).
 *
 * Check-ins already recorded keep the gate they were performed at — the audit
 * trail describes where a guest actually walked in, not where the tablet ended up.
 */
const reassignGate = async (req, res, next) => {
  try {
    const result = await deviceService.reassignDeviceGate(
      req.params.eventId,
      req.params.deviceId,
      req.body?.gateTableId,
    );
    if (!result.ok) return fail(res, result);

    supabase.from('activity_logs').insert({
      event_id: req.params.eventId,
      actor_id: req.user?.id || null,
      action: 'checkin_device_gate_changed',
      entity_type: 'event_device',
      entity_id: req.params.deviceId,
      metadata: { gate_id: result.gateId, gate_name: result.gateName },
    }).then(({ error }) => {
      if (error) logger.warn({ err: error }, '[checkinDevice] gate change audit write failed');
    });

    return sendOk(res, { gateId: result.gateId, gateName: result.gateName });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/checkin/events/:eventId/devices */
const listDevices = async (req, res, next) => {
  try {
    return sendOk(res, { devices: await deviceService.listDevices(req.params.eventId) });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/v1/checkin/events/:eventId/devices/:deviceId */
const revokeDevice = async (req, res, next) => {
  try {
    const result = await deviceService.revokeDevice(req.params.eventId, req.params.deviceId, {
      actorId: req.user?.id || null,
    });
    if (!result.ok) return fail(res, result);

    supabase.from('activity_logs').insert({
      event_id: req.params.eventId,
      actor_id: req.user?.id || null,
      action: 'checkin_device_revoked',
      entity_type: 'event_device',
      entity_id: req.params.deviceId,
      metadata: {},
    }).then(({ error }) => {
      if (error) logger.warn({ err: error }, '[checkinDevice] revoke audit write failed');
    });

    return sendOk(res, { revoked: true, wipeRequested: true });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/checkin/events/:eventId/devices/:deviceId/wipe */
const requestWipe = async (req, res, next) => {
  try {
    const result = await deviceService.requestWipe(req.params.eventId, req.params.deviceId);
    if (!result.ok) return fail(res, result);
    return sendOk(res, { wipeRequested: true });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────
// Organizer-facing: staff roster
// ─────────────────────────────────────────────────────────

/** POST /api/v1/checkin/events/:eventId/staff */
const createStaff = async (req, res, next) => {
  try {
    const result = await deviceService.createStaff(req.params.eventId, {
      displayName: req.body?.displayName,
      role: req.body?.role || 'usher',
      pin: req.body?.pin,
    });
    if (!result.ok) return fail(res, result);
    return sendOk(res, result.staff, { status: 201 });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/checkin/events/:eventId/staff */
const listStaff = async (req, res, next) => {
  try {
    return sendOk(res, { staff: await deviceService.listStaff(req.params.eventId) });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/checkin/events/:eventId/staff/:staffId/pin */
const resetStaffPin = async (req, res, next) => {
  try {
    const result = await deviceService.resetStaffPin(req.params.eventId, req.params.staffId, {
      pin: req.body?.pin,
      actorId: req.user?.id || null,
    });
    if (!result.ok) return fail(res, result);
    return sendOk(res, { reset: true });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/v1/checkin/events/:eventId/staff/:staffId */
const deactivateStaff = async (req, res, next) => {
  try {
    const result = await deviceService.deactivateStaff(req.params.eventId, req.params.staffId);
    if (!result.ok) return fail(res, result);
    return sendOk(res, { deactivated: true });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────
// Device-facing
// ─────────────────────────────────────────────────────────

/**
 * POST /api/v1/checkin/devices/pair
 *
 * Unauthenticated by necessity — the tablet has no credential yet. The pairing
 * code IS the credential: 8 chars from a 31-symbol alphabet, single-use, valid
 * 10 minutes, and rate-limited at the app level. Guessing one inside its window
 * is a ~31^8 problem against a limiter.
 */
const pairDevice = async (req, res, next) => {
  try {
    const result = await deviceService.redeemPairingCode(req.body?.code, {
      fingerprint: req.body?.fingerprint,
      appVersion: req.body?.appVersion,
    });
    if (!result.ok) return fail(res, result);

    logger.info({ eventId: result.eventId, deviceId: result.deviceId }, '[checkinDevice] device paired');

    return sendOk(res, {
      deviceId: result.deviceId,
      eventId: result.eventId,
      deviceLabel: result.deviceLabel,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessExpiresAt: result.accessExpiresAt,
      refreshExpiresAt: result.refreshExpiresAt,
    }, { status: 201 });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/checkin/devices/refresh */
const refreshDevice = async (req, res, next) => {
  try {
    const result = await deviceService.refreshDeviceToken(req.body?.refreshToken);
    if (!result.ok) {
      return sendFail(res, {
        status: FAIL_STATUS[result.error] || 401,
        error: result.error,
        meta: result.wipeRequired ? { wipe_required: true } : undefined,
      });
    }
    return sendOk(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessExpiresAt: result.accessExpiresAt,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/checkin/devices/wipe-confirm — device reports data destroyed. */
const confirmWipe = async (req, res, next) => {
  try {
    await deviceService.confirmWipe(req.device.id);
    return sendOk(res, { confirmed: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listGates,
  reassignGate,
  createPairingCode,
  listDevices,
  revokeDevice,
  requestWipe,
  createStaff,
  listStaff,
  resetStaffPin,
  deactivateStaff,
  pairDevice,
  refreshDevice,
  confirmWipe,
};
