const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * RBAC access-context resolver with a short-lived in-memory cache.
 *
 * A single call replaces the two uncached per-request lookups the auth
 * middleware used to perform (organizations + user_roles), resolving the full
 * picture — organizer status, admin status, role keys and the flattened
 * permission set — in one cached unit (Master Plan B4 fix / Foundation F1).
 *
 * The cache TTL is intentionally short so role/permission changes take effect
 * within a minute without a deploy; mutations can also call invalidate(userId)
 * for immediate effect.
 */

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // userId -> { value, expires }

/**
 * @typedef {Object} AccessContext
 * @property {boolean} isOrganizer
 * @property {string|null} orgId
 * @property {string|null} orgStatus    'active' | 'suspended' | 'banned'
 * @property {boolean} isAdmin          has an active admin_users row
 * @property {boolean} isSuperAdmin     holds the 'super_admin' role (implicit wildcard)
 * @property {string[]} roleKeys
 * @property {Set<string>} permissions
 */

/**
 * Loads the access context for a user, bypassing the cache.
 * @param {string} userId
 * @returns {Promise<AccessContext>}
 */
async function loadAccessContext(userId) {
  // Organizer side (legacy model) — confirms the account still exists & status.
  const orgPromise = supabase
    .from('organizations')
    .select('id, status')
    .eq('owner_user_id', userId)
    .maybeSingle();

  // Admin side (new RBAC model) — roles + their granted permissions.
  const adminPromise = supabase
    .from('admin_users')
    .select('id, status, admin_user_roles(roles(key, role_permissions(permissions(key))))')
    .eq('user_id', userId)
    .maybeSingle();

  const [{ data: org }, { data: admin, error: adminErr }] = await Promise.all([orgPromise, adminPromise]);
  if (adminErr) logger.warn({ err: adminErr, userId }, 'rbacService: admin lookup failed');

  const roleKeys = [];
  const permissions = new Set();
  let isSuperAdmin = false;
  const isAdmin = !!(admin && admin.status === 'active');

  if (isAdmin) {
    for (const aur of admin.admin_user_roles || []) {
      const role = aur.roles;
      if (!role) continue;
      roleKeys.push(role.key);
      if (role.key === 'super_admin') isSuperAdmin = true;
      for (const rp of role.role_permissions || []) {
        if (rp.permissions?.key) permissions.add(rp.permissions.key);
      }
    }
  }

  return {
    isOrganizer: !!org,
    orgId: org?.id || null,
    orgStatus: org?.status || null,
    isAdmin,
    isSuperAdmin,
    roleKeys,
    permissions,
  };
}

/**
 * Cached access-context accessor.
 * @param {string} userId
 * @returns {Promise<AccessContext>}
 */
async function getAccessContext(userId) {
  const hit = cache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.value;

  const value = await loadAccessContext(userId);
  cache.set(userId, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Evicts a user's cached context so the next request reloads it immediately. */
function invalidate(userId) {
  cache.delete(userId);
}

/** Clears the entire cache (e.g. after a bulk role change). */
function invalidateAll() {
  cache.clear();
}

/**
 * Whether a resolved context satisfies a permission key.
 * super_admin is an implicit wildcard — it holds every permission.
 * @param {AccessContext} ctx
 * @param {string} permissionKey
 */
function hasPermission(ctx, permissionKey) {
  if (!ctx) return false;
  if (ctx.isSuperAdmin) return true;
  return ctx.permissions.has(permissionKey);
}

module.exports = {
  getAccessContext,
  loadAccessContext,
  invalidate,
  invalidateAll,
  hasPermission,
  CACHE_TTL_MS,
};
