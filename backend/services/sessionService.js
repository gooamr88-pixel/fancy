const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { captureRequestMeta } = require('../middleware/adminAudit');

/**
 * Server-side session lifecycle (Master Plan §4 / §19 / Foundation F2).
 *
 * Issuing a token now also records a `sessions` row keyed by the JWT `jti`, so
 * sessions can be listed and revoked. requireAuth validates the jti against this
 * table (see middleware/auth.js — isSessionValid). All writes are best-effort:
 * an auth flow must never fail because session bookkeeping hiccuped.
 */

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // mirrors the JWT 24h expiry

/** Generates a unique jti for a new token. */
function newJti() {
  return crypto.randomUUID();
}

/**
 * Persists a session row for a freshly issued token.
 * @param {import('express').Request} req
 * @param {{ userId: string, jti: string, deviceLabel?: string }} info
 */
async function recordSession(req, { userId, jti, deviceLabel }) {
  try {
    const { ip, userAgent, browser, os } = captureRequestMeta(req);
    await supabase.from('sessions').insert({
      user_id: userId,
      jti,
      ip,
      user_agent: userAgent,
      device_label: deviceLabel || `${browser} on ${os}`,
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    });
  } catch (err) {
    logger.warn({ err, userId }, 'sessionService: failed to record session');
  }
}

/** Revokes a single session by jti (used on logout). */
async function revokeByJti(jti) {
  if (!jti) return;
  try {
    await supabase.from('sessions').update({ revoked_at: new Date().toISOString() }).eq('jti', jti).is('revoked_at', null);
  } catch (err) {
    logger.warn({ err }, 'sessionService: failed to revoke session');
  }
}

/** Revokes every active session for a user (suspend/ban/force-logout). */
async function revokeAllForUser(userId) {
  if (!userId) return 0;
  const { data, error } = await supabase
    .from('sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null)
    .select('id');
  if (error) throw error;
  return (data || []).length;
}

/** Records a login attempt (success or failure) into login_history. */
async function recordLogin(req, { userId, email, success, failureReason }) {
  try {
    const { ip, userAgent } = captureRequestMeta(req);
    await supabase.from('login_history').insert({
      user_id: userId || null,
      email: email || null,
      ip,
      user_agent: userAgent,
      success: !!success,
      failure_reason: failureReason || null,
    });
  } catch (err) {
    logger.warn({ err, email }, 'sessionService: failed to record login history');
  }
}

module.exports = { newJti, recordSession, revokeByJti, revokeAllForUser, recordLogin, SESSION_TTL_MS };
