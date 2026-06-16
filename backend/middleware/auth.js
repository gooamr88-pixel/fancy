const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

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
 * Middleware to enforce authentication.
 * Reads JWT from httpOnly cookie or Authorization header.
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

    req.user = {
      id: decoded.id || decoded.sub,
      email: decoded.email,
      role: decoded.role
    };

    // Check if the user is a super admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', req.user.id)
      .single();

    req.user.isSuperAdmin = (roleData?.role === 'super_admin');

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

    if (decoded) {
      req.user = {
        id: decoded.id || decoded.sub,
        email: decoded.email,
        role: decoded.role
      };

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', req.user.id)
        .single();

      req.user.isSuperAdmin = (roleData?.role === 'super_admin');
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
  if (!req.user || !req.user.isSuperAdmin) {
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
