const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { supabase } = require('../../config/supabase');
const logger = require('../../utils/logger');
const { logAdminAction } = require('../../middleware/adminAudit');
const { setAuthCookie, COOKIE_NAME } = require('../../middleware/auth');
const { invalidate } = require('../../services/rbacService');
const { revokeAllForUser, newJti, recordSession } = require('../../services/sessionService');
const { hashPassword } = require('../authController');

const JWT_SECRET = process.env.JWT_SECRET;
const VALID_STATUSES = ['active', 'suspended', 'banned'];

/**
 * User & Organizer lifecycle management (Master Plan §4 / §5). In this data
 * model an "organization" is the user account (organizations.owner_user_id ↔
 * auth.users.id), so both sections operate over the same record.
 */

/** GET /api/v1/admin/users/:userId — full profile + sessions + login history. */
const getUserDetail = async (req, res, next) => {
  const { userId } = req.params;
  try {
    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, owner_user_id, name, email, phone, status, suspended_reason, suspended_at, created_at, email_verified')
      .eq('owner_user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!org) return res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: 'User not found.' });

    const [{ count: eventCount }, { data: sessions }, { data: logins }, { data: adminRow }] = await Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
      supabase.from('sessions').select('id, ip, user_agent, device_label, created_at, last_seen_at, revoked_at, expires_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('login_history').select('ip, user_agent, success, failure_reason, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      // Live RBAC tables — the legacy user_roles table no longer reflects real access.
      supabase.from('admin_users').select('status, admin_user_roles(roles(key))').eq('user_id', userId).maybeSingle(),
    ]);

    const roleKeys = adminRow && adminRow.status === 'active'
      ? (adminRow.admin_user_roles || []).map((ur) => ur.roles?.key).filter(Boolean)
      : [];
    const isAdmin = roleKeys.length > 0;

    return res.json({
      success: true,
      user: {
        userId: org.owner_user_id,
        orgId: org.id,
        name: org.name,
        email: org.email,
        phone: org.phone,
        status: org.status || 'active',
        suspendedReason: org.suspended_reason,
        suspendedAt: org.suspended_at,
        emailVerified: org.email_verified,
        createdAt: org.created_at,
        role: roleKeys.includes('super_admin') ? 'super_admin' : (roleKeys[0] || 'organizer'),
        isAdmin,
        roleKeys,
        eventCount: eventCount || 0,
        sessions: sessions || [],
        loginHistory: logins || [],
      },
    });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/admin/users/:userId/status  body: { status, reason? } */
const setUserStatus = async (req, res, next) => {
  const { userId } = req.params;
  const { status, reason } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, error: 'INVALID_STATUS', message: `status must be one of: ${VALID_STATUSES.join(', ')}.` });
  }
  if (userId === req.user.id) {
    return res.status(400).json({ success: false, error: 'SELF_ACTION_FORBIDDEN', message: 'You cannot change your own account status.' });
  }
  try {
    const updates = {
      status,
      suspended_reason: status === 'active' ? null : (reason || '').toString().slice(0, 500) || null,
      suspended_at: status === 'active' ? null : new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('owner_user_id', userId)
      .select('id, owner_user_id, status')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: 'User not found.' });

    // Suspending or banning force-logs-out the user everywhere.
    let revoked = 0;
    if (status !== 'active') revoked = await revokeAllForUser(userId);
    invalidate(userId); // refresh cached access context (ban check)

    await logAdminAction(req, {
      action: status === 'active' ? 'user.restore' : `user.${status}`,
      entityType: 'user',
      entityId: userId,
      after: { status },
      metadata: { reason: reason || null, sessionsRevoked: revoked },
    });

    return res.json({ success: true, message: `User ${status === 'active' ? 'restored' : status}.`, sessionsRevoked: revoked });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/admin/users/:userId/sessions */
const listUserSessions = async (req, res, next) => {
  const { userId } = req.params;
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, ip, user_agent, device_label, created_at, last_seen_at, revoked_at, expires_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return res.json({ success: true, sessions: data || [] });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/admin/users/:userId/sessions/:sessionId/revoke */
const revokeUserSession = async (req, res, next) => {
  const { userId, sessionId } = req.params;
  try {
    const { data, error } = await supabase
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'SESSION_NOT_FOUND', message: 'Active session not found.' });
    await logAdminAction(req, { action: 'user.session.revoke', entityType: 'session', entityId: sessionId, metadata: { userId } });
    return res.json({ success: true, message: 'Session revoked.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/organizers/:userId/reset-password
 * Sets a strong random temporary password, revokes all sessions, and returns the
 * temp password ONCE for the admin to relay. (Organizer should change it after.)
 */
const resetOrganizerPassword = async (req, res, next) => {
  const { userId } = req.params;
  try {
    const { data: org, error: findErr } = await supabase
      .from('organizations').select('email').eq('owner_user_id', userId).maybeSingle();
    if (findErr) throw findErr;
    if (!org) return res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: 'User not found.' });

    // Generate a 16-char temp password meeting the strength policy.
    const tempPassword = `Aa1${crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
    const passwordHash = await hashPassword(tempPassword);

    const { error: updErr } = await supabase
      .from('organizations')
      .update({ password_hash: passwordHash, failed_login_attempts: 0, lockout_until: null })
      .eq('owner_user_id', userId);
    if (updErr) throw updErr;

    await revokeAllForUser(userId);
    invalidate(userId);
    await logAdminAction(req, { action: 'organizer.reset_password', entityType: 'user', entityId: userId });

    return res.json({ success: true, message: 'Temporary password set. Share it securely; the organizer should change it on next login.', tempPassword });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/organizers/:userId/impersonate
 * Issues an organizer session for the admin's browser with an `imp` claim
 * recording who is impersonating. Logging out returns the admin to their own
 * login. Writes a security_event + audit log.
 */
const impersonateOrganizer = async (req, res, next) => {
  const { userId } = req.params;
  try {
    const { data: org, error } = await supabase
      .from('organizations').select('id, owner_user_id, email, name, status').eq('owner_user_id', userId).maybeSingle();
    if (error) throw error;
    if (!org) return res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: 'Organizer not found.' });
    if (org.status === 'banned') {
      return res.status(400).json({ success: false, error: 'ACCOUNT_BANNED', message: 'Cannot impersonate a banned account.' });
    }

    const jti = newJti();
    // Short-lived impersonation token (1h) carrying the impersonator id for audit.
    const token = jwt.sign(
      { id: org.owner_user_id, email: org.email, role: 'organizer', imp: req.user.id, jti },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    setAuthCookie(res, token);
    await recordSession(req, { userId: org.owner_user_id, jti, deviceLabel: `Impersonation by admin ${req.user.email || req.user.id}` });

    // Security event + audit (best-effort security_event).
    try {
      await supabase.from('security_events').insert({
        user_id: org.owner_user_id,
        type: 'impersonation',
        severity: 'warning',
        ip: req.ip || null,
        metadata: { impersonator_id: req.user.id, impersonator_email: req.user.email },
      });
    } catch (e) {
      logger.warn({ err: e }, 'Failed to record impersonation security_event');
    }
    await logAdminAction(req, { action: 'organizer.impersonate', entityType: 'user', entityId: userId, metadata: { orgId: org.id } });

    return res.json({ success: true, message: `Now impersonating ${org.name || org.email}. Log out to return to your admin account.`, organizer: { id: org.id, email: org.email, name: org.name } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUserDetail,
  setUserStatus,
  listUserSessions,
  revokeUserSession,
  resetOrganizerPassword,
  impersonateOrganizer,
};
