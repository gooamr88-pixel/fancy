const { hasPermission } = require('../services/rbacService');

/**
 * Granular authorization middleware (Master Plan §18 / Foundation F1).
 *
 * Must run AFTER requireAuth, which populates req.user with the resolved access
 * context (isSuperAdmin + permissions Set). super_admin implicitly satisfies
 * every permission.
 *
 * Usage:
 *   router.get('/payments', requireAuth, requirePermission('payments.view'), handler)
 */

const deny = (res) =>
  res.status(403).json({
    success: false,
    error: 'FORBIDDEN',
    message: 'You do not have permission to perform this action.',
  });

/** Requires a single permission key. */
function requirePermission(permissionKey) {
  return (req, res, next) => {
    const ctx = req.user?.access;
    if (!ctx) return deny(res);
    if (hasPermission(ctx, permissionKey)) return next();
    return deny(res);
  };
}

/** Requires ANY one of the supplied permission keys. */
function requireAnyPermission(...keys) {
  return (req, res, next) => {
    const ctx = req.user?.access;
    if (!ctx) return deny(res);
    if (keys.some((k) => hasPermission(ctx, k))) return next();
    return deny(res);
  };
}

/** Requires that the caller is an admin of any kind (has an active admin_users row). */
function requireAdmin(req, res, next) {
  if (req.user?.access?.isAdmin) return next();
  return deny(res);
}

module.exports = { requirePermission, requireAnyPermission, requireAdmin };
