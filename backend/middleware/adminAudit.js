const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Admin audit trail (Master Plan §17 / Foundation F2).
 *
 * Captures the IP / browser / OS context of an admin action and writes a row to
 * admin_audit_logs. Auditing is best-effort: a logging failure never breaks the
 * underlying request — it is logged and swallowed.
 */

/** Minimal dependency-free User-Agent → { browser, os } parser. */
function parseUserAgent(ua = '') {
  let browser = 'Unknown';
  let os = 'Unknown';

  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/(iPhone|iPad|iOS)/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  return { browser, os };
}

/** Extracts request metadata used for both audit logs and session/login rows. */
function captureRequestMeta(req) {
  const userAgent = req.headers['user-agent'] || '';
  const { browser, os } = parseUserAgent(userAgent);
  // req.ip respects Express trust-proxy config; fall back to socket address.
  const ip = req.ip || req.socket?.remoteAddress || null;
  return { ip, userAgent, browser, os };
}

/**
 * Records a single admin action.
 * @param {import('express').Request} req
 * @param {Object} entry
 * @param {string} entry.action            e.g. 'payment.refund'
 * @param {string} [entry.entityType]
 * @param {string} [entry.entityId]
 * @param {Object} [entry.before]
 * @param {Object} [entry.after]
 * @param {Object} [entry.metadata]
 */
async function logAdminAction(req, { action, entityType, entityId, before, after, metadata } = {}) {
  try {
    const { ip, userAgent, browser, os } = captureRequestMeta(req);
    const actorRole = req.user?.access?.roleKeys?.[0] || (req.user?.access?.isSuperAdmin ? 'super_admin' : null);

    await supabase.from('admin_audit_logs').insert({
      actor_user_id: req.user?.id || null,
      actor_role: actorRole,
      action,
      entity_type: entityType || null,
      entity_id: entityId != null ? String(entityId) : null,
      ip,
      user_agent: userAgent,
      browser,
      os,
      before: before || null,
      after: after || null,
      metadata: metadata || {},
    });
  } catch (err) {
    logger.error({ err, action }, 'Failed to write admin audit log');
  }
}

module.exports = { logAdminAction, captureRequestMeta, parseUserAgent };
