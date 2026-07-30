/**
 * Device authentication for the check-in app (spec §18.1, §18.4).
 *
 * A paired tablet presents `Authorization: Device <token>`. This resolves it to
 * an event_devices row and pins the request to THAT device's event — the scope
 * is the device's own event, never a client-supplied one, so a token for event A
 * can never read event B's guest list (§18.4 "Scope").
 *
 * The `Device` scheme is deliberately distinct from `Bearer`. requireAuth also
 * reads Authorization, and if both used `Bearer` a device token would fall
 * through to the organizer JWT verifier and produce a confusing 401 instead of
 * a clear one.
 *
 * ── What this middleware must NOT do ──
 * An expired access token is a 401 with TOKEN_EXPIRED so the client refreshes.
 * It is never a signal to stop scanning or to wipe. Token state governs SYNC,
 * never LOCAL OPERATION (§18.4) — a tablet six hours offline at a venue has an
 * expired token and must keep working.
 */
const deviceService = require('../services/checkinDeviceService');
const logger = require('../utils/logger');

const extractDeviceToken = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Device ')) return header.slice(7).trim();
  return null;
};

/**
 * Requires a valid device token. On success sets:
 *   req.device   = { id, eventId, label }
 *   req.params.eventId = the device's own event (overriding any path value)
 */
const requireDevice = async (req, res, next) => {
  const token = extractDeviceToken(req);
  if (!token) {
    return res.status(401).json({
      success: false, error: 'DEVICE_UNAUTHENTICATED',
      message: 'A device token is required.',
    });
  }

  try {
    const result = await deviceService.resolveDeviceToken(token);

    if (!result.ok) {
      const status = result.error === 'DEVICE_REVOKED' || result.error === 'WIPE_REQUESTED' ? 403 : 401;
      return res.status(status).json({
        success: false,
        error: result.error,
        message: result.error === 'TOKEN_EXPIRED'
          ? 'Device access token expired. Refresh it and retry.'
          : 'This device is not authorised.',
        // The device purges local event data on seeing this (§20.5). It is the
        // only instruction that may destroy guest data on a tablet, so it is
        // stated explicitly rather than inferred from a status code.
        meta: result.wipeRequired ? { wipe_required: true } : undefined,
      });
    }

    req.device = {
      id: result.device.id,
      eventId: result.device.event_id,
      label: result.device.device_label,
    };

    // A path eventId that disagrees with the token is REJECTED, not silently
    // overridden. Silently rewriting it would let a device believe it had
    // scanned into event B while the server quietly served event A — the exact
    // wrong-event confusion §10 requires be reported, never absorbed.
    if (req.params.eventId && req.params.eventId !== result.device.event_id) {
      return res.status(403).json({
        success: false, error: 'DEVICE_EVENT_MISMATCH',
        message: 'This device is not paired to that event.',
      });
    }
    req.params.eventId = result.device.event_id;

    // Opportunistic health capture — the app sends these as headers on any call
    // rather than paying for a dedicated heartbeat request (§21.6: telemetry
    // rides along with normal sync, never its own always-on connection).
    const battery = req.get('X-Device-Battery');
    const storage = req.get('X-Device-Storage-Free-Mb');
    const queue = req.get('X-Device-Queue-Depth');
    const bundle = req.get('X-Device-Bundle-Version');
    const appVersion = req.get('X-App-Version');
    if (battery || storage || queue || bundle || appVersion) {
      deviceService.recordDeviceHeartbeat(req.device.id, {
        batteryLevel: battery, storageFreeMb: storage,
        queueDepth: queue, bundleVersion: bundle, appVersion,
      }).catch((e) => logger.warn({ err: e.message }, '[deviceAuth] heartbeat failed'));
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Accepts EITHER a device token or an organizer session.
 *
 * The sync endpoints are used by both: tablets at the door, and the organizer's
 * own dashboard/web kiosk. Device auth is tried first because it is cheaper (one
 * indexed lookup, no RBAC context resolution) and because a request carrying a
 * `Device` scheme header was unambiguously meant for it.
 */
const requireDeviceOrAuth = (organizerChain) => async (req, res, next) => {
  if (extractDeviceToken(req)) return requireDevice(req, res, next);

  // Fall through to the organizer middleware chain (requireAuth + ownership).
  let i = 0;
  const runNext = (err) => {
    if (err) return next(err);
    const mw = organizerChain[i++];
    if (!mw) return next();
    return mw(req, res, runNext);
  };
  runNext();
};

module.exports = { requireDevice, requireDeviceOrAuth, extractDeviceToken };
