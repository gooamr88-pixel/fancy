const { supabase } = require('../../config/supabase');
const { sendOk, sendFail } = require('../../utils/responseEnvelope');
const logger = require('../../utils/logger');

/**
 * Cross-organization check-in administration (amendment A-16, super admin).
 *
 * Everything here spans organizations, which is the whole point: a Fancy operator
 * handling "a client's tablet was stolen" cannot be expected to first find which
 * organizer owns it. The organizer-scoped equivalents live in
 * checkinDeviceController and are reachable only for the caller's own events.
 *
 * ── Permissions ──
 *
 * Reuses the pre-seeded RBAC keys rather than inventing new ones. An unseeded key
 * belongs to no role, so it would silently work for super admins and fail for
 * every other admin — a permission that exists only in code is a permission
 * nobody can grant.
 *
 *   registry + summary → events.view      (per-event operational data)
 *   revoke + wipe      → security.manage  ("Manage sessions / security policy";
 *                        a device token IS a session, and revocation extends the
 *                        same sessions.jti pattern — see A-16)
 */

/**
 * GET /api/v1/admin/checkin/devices
 *
 * The device registry across every organization.
 *
 * Filterable by staleness because the operational question is almost never "show
 * me all devices" — it is "which tablets are still holding guest data they should
 * not be", which is a staleness question (§20.5's retention policy).
 */
const listAllDevices = async (req, res, next) => {
  const staleDays = Number.parseInt(req.query.staleDays, 10);
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 200, 500);

  try {
    const { data, error } = await supabase
      .from('event_devices')
      .select(`
        id, event_id, device_label, gate_table_id, is_active, revoked_at,
        wipe_requested_at, wipe_confirmed_at, last_seen_at, battery_level,
        storage_free_mb, bundle_version, queue_depth, app_version, created_at,
        events(id, title, event_date, org_id, organizations(id, name, email))
      `)
      .order('last_seen_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;

    const now = Date.now();
    let rows = (data || []).map((d) => {
      const lastSeenMs = d.last_seen_at ? new Date(d.last_seen_at).getTime() : null;
      const eventDateMs = d.events?.event_date ? new Date(d.events.event_date).getTime() : null;

      return {
        id: d.id,
        label: d.device_label,
        eventId: d.event_id,
        eventTitle: d.events?.title || null,
        eventDate: d.events?.event_date || null,
        orgId: d.events?.organizations?.id || null,
        orgName: d.events?.organizations?.name || null,
        orgEmail: d.events?.organizations?.email || null,
        isActive: !!d.is_active && !d.revoked_at,
        revokedAt: d.revoked_at,
        wipePending: !!d.wipe_requested_at && !d.wipe_confirmed_at,
        wipeConfirmedAt: d.wipe_confirmed_at,
        lastSeenAt: d.last_seen_at,
        batteryLevel: d.battery_level,
        storageFreeMb: d.storage_free_mb,
        bundleVersion: d.bundle_version,
        queueDepth: d.queue_depth,
        appVersion: d.app_version,
        // Still holding a guest list for an event that finished. §20.5's
        // 7-day auto-purge should have cleared it; if this is set, the device
        // has not come back online since — which is exactly the case worth
        // chasing, because the data is sitting on a tablet nobody is watching.
        holdingStaleData: !!(
          d.bundle_version != null
          && !d.revoked_at
          && eventDateMs
          && now - eventDateMs > 7 * 24 * 3600 * 1000
        ),
        daysSinceSeen: lastSeenMs == null ? null : Math.floor((now - lastSeenMs) / (24 * 3600 * 1000)),
      };
    });

    if (Number.isFinite(staleDays)) {
      rows = rows.filter((r) => r.daysSinceSeen == null || r.daysSinceSeen >= staleDays);
    }

    return sendOk(res, {
      devices: rows,
      counts: {
        total: rows.length,
        active: rows.filter((r) => r.isActive).length,
        wipePending: rows.filter((r) => r.wipePending).length,
        holdingStaleData: rows.filter((r) => r.holdingStaleData).length,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/admin/checkin/devices/:deviceId
 *
 * Global revocation (§18.4, §20.5). Works regardless of which organization owns
 * the event — the case this exists for is a lost or stolen tablet, and waiting to
 * establish ownership is exactly the wrong response.
 *
 * Clears the token hashes outright rather than only flagging the row, so a
 * revoked device cannot authenticate again even if the is_active check were ever
 * bypassed.
 */
const revokeDeviceGlobal = async (req, res, next) => {
  const { deviceId } = req.params;
  const reason = req.body?.reason;

  try {
    const { data, error } = await supabase
      .from('event_devices')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: req.user?.id || null,
        // Revocation always implies a wipe: a device that must stop working is a
        // device that must not keep the guest list.
        wipe_requested_at: new Date().toISOString(),
        token_hash: `revoked:${require('crypto').randomUUID()}`,
        refresh_token_hash: null,
      })
      .eq('id', deviceId)
      .select('id, event_id, device_label');
    if (error) throw error;

    if (!data || data.length === 0) {
      return sendFail(res, { status: 404, error: 'NOT_FOUND', message: 'Device not found.' });
    }

    const device = data[0];
    await supabase.from('activity_logs').insert({
      event_id: device.event_id,
      actor_id: req.user?.id || null,
      action: 'checkin_device_revoked_by_admin',
      entity_type: 'event_device',
      entity_id: device.id,
      metadata: { reason: reason || null, device_label: device.device_label },
    });

    logger.warn(
      { deviceId, eventId: device.event_id, actorId: req.user?.id || null },
      '[admin] check-in device revoked platform-wide',
    );

    return sendOk(res, { revoked: true, wipeRequested: true });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/checkin/devices/:deviceId/wipe
 *
 * Remote wipe WITHOUT revoking (§20.5).
 *
 * Distinct from revocation on purpose: a tablet that is simply finished with an
 * event should forget the guest list but stay provisioned for the next one.
 * Collapsing the two would force a re-pair after every event, and an operator who
 * has to re-pair six tablets monthly will eventually stop wiping them.
 */
const requestWipeGlobal = async (req, res, next) => {
  const { deviceId } = req.params;

  try {
    const { data, error } = await supabase
      .from('event_devices')
      .update({ wipe_requested_at: new Date().toISOString(), wipe_confirmed_at: null })
      .eq('id', deviceId)
      .select('id, event_id, device_label');
    if (error) throw error;

    if (!data || data.length === 0) {
      return sendFail(res, { status: 404, error: 'NOT_FOUND', message: 'Device not found.' });
    }

    await supabase.from('activity_logs').insert({
      event_id: data[0].event_id,
      actor_id: req.user?.id || null,
      action: 'checkin_device_wipe_requested_by_admin',
      entity_type: 'event_device',
      entity_id: deviceId,
      metadata: { device_label: data[0].device_label },
    });

    return sendOk(res, {
      wipeRequested: true,
      // Stated so an operator does not read silence as failure. A tablet that is
      // switched off in a drawer wipes when it next reaches the internet, which
      // may be weeks — the request is durable, not immediate.
      note: 'The device erases its guest list the next time it reaches the internet.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/checkin/events/:eventId/summary
 *
 * Post-event operational summary (§21.6).
 *
 * "For a product operated unattended by untrained staff at venues you are not
 * present at, this is not a minor gap — it makes the product unmaintainable."
 * This answers "what actually happened on that tablet" when a client reports that
 * the app stopped working.
 */
const getOperationalSummary = async (req, res, next) => {
  const { eventId } = req.params;

  try {
    const [{ data: event }, { data: devices }, { data: checkIns }, { data: conflicts }] = await Promise.all([
      supabase.from('events').select('id, title, event_date, timezone, organizations(name)').eq('id', eventId).maybeSingle(),
      supabase.from('event_devices').select('id, device_label, last_seen_at, battery_level, storage_free_mb, bundle_version, queue_depth, app_version, revoked_at, created_at').eq('event_id', eventId),
      supabase.from('check_ins').select('device_label, method, checked_in_at, server_received_at, token_verified, deleted_at').eq('event_id', eventId),
      supabase.from('event_check_in_conflicts').select('id, resolved_at').eq('event_id', eventId),
    ]);

    if (!event) {
      return sendFail(res, { status: 404, error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }

    const rows = checkIns || [];
    const live = rows.filter((c) => !c.deleted_at);

    const perDevice = (devices || []).map((d) => {
      const recorded = live.filter((c) => c.device_label === d.device_label);
      const times = recorded.map((c) => new Date(c.checked_in_at).getTime()).filter(Number.isFinite);

      return {
        id: d.id,
        label: d.device_label,
        appVersion: d.app_version,
        scans: recorded.length,
        firstScanAt: times.length ? new Date(Math.min(...times)).toISOString() : null,
        lastScanAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
        lastSeenAt: d.last_seen_at,
        // Peak queue depth is not retained historically — this is the LAST
        // reported value, which is the honest thing to show. A device that
        // finished cleanly reports 0; a non-zero value here means it stopped
        // reporting with work outstanding, which is the situation worth chasing.
        lastQueueDepth: d.queue_depth,
        lastBattery: d.battery_level,
        bundleVersion: d.bundle_version,
        revoked: !!d.revoked_at,
      };
    });

    const skewed = live.filter((c) => {
      if (!c.checked_in_at || !c.server_received_at) return false;
      return Math.abs(new Date(c.checked_in_at) - new Date(c.server_received_at)) > 5 * 60 * 1000;
    }).length;

    return sendOk(res, {
      event: {
        id: event.id,
        title: event.title,
        eventDate: event.event_date,
        orgName: event.organizations?.name || null,
      },
      totals: {
        devices: (devices || []).length,
        arrivals: live.length,
        reversed: rows.length - live.length,
        conflicts: (conflicts || []).length,
        unresolvedConflicts: (conflicts || []).filter((c) => !c.resolved_at).length,
        // Explicitly false, not falsy: null means no ticket was presented, which
        // is normal for a manual check-in and must not be counted as a failure.
        unverifiedScans: live.filter((c) => c.token_verified === false).length,
        clockSkewed: skewed,
      },
      byMethod: Object.entries(
        live.reduce((acc, c) => {
          const key = c.method || 'unknown';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
      ).map(([method, count]) => ({ method, count })).sort((a, b) => b.count - a.count),
      devices: perDevice,
      // Stated rather than omitted: §21.6 asks for a crash count, and there is no
      // crash reporting integrated yet. Returning 0 would read as "no crashes"
      // rather than "not measured", which is the more dangerous of the two.
      crashReporting: {
        available: false,
        note: 'Crash reporting is not integrated yet (§21.6). Crash counts are not measured.',
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listAllDevices,
  revokeDeviceGlobal,
  requestWipeGlobal,
  getOperationalSummary,
};
