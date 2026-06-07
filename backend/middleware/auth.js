const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

/**
 * Middleware to enforce authentication.
 * Validates Supabase JWTs (via remote auth service or local verification fallback).
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHENTICATED',
      message: 'Authentication token is required.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    let decoded;
    const isLocalDB = !process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project') || !process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!isLocalDB && supabase.auth && typeof supabase.auth.getUser === 'function') {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Session is invalid or expired.'
        });
      }
      decoded = {
        id: user.id,
        email: user.email,
        role: user.role
      };
    } else {
      // Local fallback verification
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_sign_key_for_authentication');
    }

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
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    let decoded;
    const isLocalDB = !process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project') || !process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!isLocalDB && supabase.auth && typeof supabase.auth.getUser === 'function') {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        decoded = {
          id: user.id,
          email: user.email,
          role: user.role
        };
      }
    } else {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_sign_key_for_authentication');
    }

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

    const ownerId = event.organizations?.owner_user_id || event.org_id;
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
  verifyEventOwner
};
