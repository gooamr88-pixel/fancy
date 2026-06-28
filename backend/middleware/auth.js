const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');
const { getAccessContext } = require('../services/rbacService');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET environment variable is required');

/** Cookie configuration — single source of truth for all auth endpoints. */
const COOKIE_NAME = 'fancy_session';
// 'lax' (not 'strict') so the session survives top-level navigations back from
// external providers like Stripe Checkout. 'strict' withholds the cookie on the
// return navigation, which logs the user out after paying. 'lax' still blocks the
// cookie on cross-site POST/embedded requests, preserving CSRF protection.
const getCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge, // milliseconds
});

/**
 * Sets the httpOnly auth cookie on the response.
 * @param {import('express').Response} res
 * @param {string} token - JWT to store
 */
const setAuthCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, getCookieOptions(24 * 60 * 60 * 1000)); // 24 hours
};

/**
 * Clears the httpOnly auth cookie from the response.
 * @param {import('express').Response} res
 */
const clearAuthCookie = (res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
};

/**
 * Extracts JWT from request: cookie first, then Authorization header (backward compat).
 * @param {import('express').Request} req
 * @returns {string|null}
 */
const extractToken = (req) => {
  // 1. httpOnly cookie (primary)
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  // 2. Authorization header (backward compatibility for mobile clients / external API consumers)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
};

/**
 * Validates a token's server-side session by its `jti` claim.
 * Tokens issued before the sessions migration carry no `jti`; those are treated
 * as legacy-valid until their natural 24h expiry so deploys don't force logouts.
 * @returns {Promise<boolean>} true if the session is valid (or legacy)
 */
const isSessionValid = async (decoded) => {
  // SEC-6: EVERY session must be server-side revocable. Tokens are always issued
  // with a `jti` (see authController.issueAuthCookie), so a token lacking one is
  // forged or predates the sessions system — deny it (fail-closed). The previous
  // legacy allowance is removed now that there are no pre-migration tokens to honor.
  if (!decoded.jti) return false;
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('revoked_at, expires_at')
      .eq('jti', decoded.jti)
      .maybeSingle();
    // SECURITY (M1): FAIL CLOSED. A token that asserts a `jti` must map to a live,
    // non-revoked session. If we can't positively confirm that — lookup error,
    // missing row, revoked, or expired — deny. Previously this fail-OPENED on a
    // lookup error, so a revoked/forged session slipped through on a transient DB
    // hiccup.
    if (error) {
      logger.error({ err: error, jti: decoded.jti }, 'session validation lookup failed — denying (fail-closed)');
      return false;
    }
    if (!data) return false;            // jti present but no session → revoked/forged
    if (data.revoked_at) return false;  // explicitly revoked (logout / suspension)
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return false;
    return true;
  } catch (e) {
    logger.error({ err: e, jti: decoded.jti }, 'session validation threw — denying (fail-closed)');
    return false;
  }
};

/**
 * Middleware to enforce authentication.
 * Reads JWT from httpOnly cookie or Authorization header, validates any
 * server-side session, then resolves a single cached RBAC access context
 * (organizer + admin + permissions) — replacing the previous two uncached
 * lookups (Master Plan B4 fix).
 */
const requireAuth = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHENTICATED',
      message: 'Authentication token is required.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const userId = decoded.id || decoded.sub;

    if (!(await isSessionValid(decoded))) {
      return res.status(401).json({ success: false, error: 'SESSION_REVOKED', message: 'This session is no longer valid.' });
    }

    const access = await getAccessContext(userId);

    // The account must still exist as an organizer or an admin.
    if (!access.isOrganizer && !access.isAdmin) {
      return res.status(401).json({ success: false, error: 'User no longer exists' });
    }
    // Banned organizers are denied platform access entirely.
    if (access.isOrganizer && access.orgStatus === 'banned') {
      return res.status(403).json({ success: false, error: 'ACCOUNT_BANNED', message: 'This account has been banned.' });
    }

    req.user = {
      id: userId,
      email: decoded.email,
      role: decoded.role,
      jti: decoded.jti || null,
      access,
      isSuperAdmin: access.isSuperAdmin, // backward-compat mirror for existing controllers
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Authentication token is invalid or expired.'
    });
  }
};

/**
 * Middleware for optional authentication (public endpoints that behave differently if logged in).
 */
const optionalAuth = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

    // A revoked/expired session must not populate req.user here either — otherwise
    // a banned/logged-out user keeps being treated as authenticated on every
    // optionalAuth route until the JWT's natural expiry, even though requireAuth
    // would already be rejecting the same token elsewhere.
    if (decoded && (await isSessionValid(decoded))) {
      const userId = decoded.id || decoded.sub;
      const access = await getAccessContext(userId);
      req.user = {
        id: userId,
        email: decoded.email,
        role: decoded.role,
        jti: decoded.jti || null,
        access,
        isSuperAdmin: access.isSuperAdmin,
      };
    }
  } catch (e) {
    // Ignore errors for optional auth
  }
  next();
};

/**
 * Middleware to restrict access to super administrators only.
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || !req.user.access?.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Access restricted to system administrators.'
    });
  }
  next();
};

/**
 * Middleware to verify that the logged-in user owns the event being accessed.
 * Super admins bypass this check automatically.
 */
const verifyEventOwner = async (req, res, next) => {
  const { eventId } = req.params;
  if (!eventId) return next();

  if (req.user?.isSuperAdmin) return next();

  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('org_id, organizations(owner_user_id)')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      return res.status(404).json({
        success: false,
        error: 'EVENT_NOT_FOUND',
        message: 'Event not found.'
      });
    }

    const ownerId = event.organizations?.owner_user_id;
    if (ownerId !== req.user?.id) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'You do not have permission to access resources for this event.'
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  requireAuth,
  optionalAuth,
  requireSuperAdmin,
  verifyEventOwner,
  setAuthCookie,
  clearAuthCookie,
  COOKIE_NAME,
};
