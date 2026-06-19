const { supabase } = require('../../config/supabase');
const { logAdminAction } = require('../../middleware/adminAudit');
const { invalidate } = require('../../services/rbacService');

/**
 * Role & Permission management (Master Plan §18 / Foundation F1).
 * Exposes the permission catalog, role CRUD with permission grants, and
 * assignment of admin roles to users. All mutations are audit-logged.
 */

/** GET /api/v1/admin/rbac/permissions — the full permission catalog, grouped. */
const listPermissions = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('permissions')
      .select('id, key, group, description')
      .order('group', { ascending: true })
      .order('key', { ascending: true });
    if (error) throw error;
    return res.json({ success: true, permissions: data || [] });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/admin/rbac/roles — roles with their granted permission keys. */
const listRoles = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('id, key, name, description, is_system, role_permissions(permissions(key))')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const roles = (data || []).map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.is_system,
      permissions: (r.role_permissions || []).map((rp) => rp.permissions?.key).filter(Boolean),
    }));
    return res.json({ success: true, roles });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/admin/rbac/roles — create a custom (non-system) role. */
const createRole = async (req, res, next) => {
  const { key, name, description } = req.body;
  if (!key || !name) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'key and name are required.' });
  }
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return res.status(400).json({ success: false, error: 'INVALID_KEY', message: 'key must be lowercase snake_case.' });
  }
  try {
    const { data, error } = await supabase
      .from('roles')
      .insert({ key, name, description: description || null, is_system: false })
      .select('id, key, name, description, is_system')
      .single();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'ROLE_EXISTS', message: 'A role with that key already exists.' });
      }
      throw error;
    }
    await logAdminAction(req, { action: 'rbac.role.create', entityType: 'role', entityId: data.id, after: data });
    return res.status(201).json({ success: true, role: data });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/admin/rbac/roles/:roleId/permissions
 * Replaces a role's permission grants wholesale. body: { permissionKeys: [...] }
 * super_admin's grants are immutable (it is an implicit wildcard).
 */
const setRolePermissions = async (req, res, next) => {
  const { roleId } = req.params;
  const { permissionKeys } = req.body;
  if (!Array.isArray(permissionKeys)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'permissionKeys must be an array.' });
  }

  try {
    const { data: role, error: roleErr } = await supabase
      .from('roles').select('id, key').eq('id', roleId).single();
    if (roleErr || !role) {
      return res.status(404).json({ success: false, error: 'ROLE_NOT_FOUND', message: 'Role not found.' });
    }
    if (role.key === 'super_admin') {
      return res.status(400).json({ success: false, error: 'IMMUTABLE_ROLE', message: 'super_admin permissions cannot be edited; it implicitly holds all permissions.' });
    }

    const { data: perms, error: permErr } = await supabase
      .from('permissions').select('id, key').in('key', permissionKeys.length ? permissionKeys : ['__none__']);
    if (permErr) throw permErr;

    // Replace grants: delete existing, insert new set.
    const { error: delErr } = await supabase.from('role_permissions').delete().eq('role_id', roleId);
    if (delErr) throw delErr;

    if (perms && perms.length) {
      const rows = perms.map((p) => ({ role_id: roleId, permission_id: p.id }));
      const { error: insErr } = await supabase.from('role_permissions').insert(rows);
      if (insErr) throw insErr;
    }

    invalidateAllAdmins(); // role change affects every admin holding it
    await logAdminAction(req, {
      action: 'rbac.role.set_permissions',
      entityType: 'role',
      entityId: roleId,
      after: { permissionKeys: (perms || []).map((p) => p.key) },
    });
    return res.json({ success: true, message: 'Role permissions updated.' });
  } catch (err) {
    next(err);
  }
};

/** GET /api/v1/admin/rbac/admins — admin users with their assigned roles. */
const listAdminUsers = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, user_id, status, last_login_at, created_at, admin_user_roles(roles(id, key, name))');
    if (error) throw error;

    const userIds = (data || []).map((a) => a.user_id);
    let orgMap = new Map();
    if (userIds.length) {
      const { data: orgs } = await supabase
        .from('organizations').select('owner_user_id, name, email').in('owner_user_id', userIds);
      orgMap = new Map((orgs || []).map((o) => [o.owner_user_id, o]));
    }

    const admins = (data || []).map((a) => ({
      id: a.id,
      userId: a.user_id,
      name: orgMap.get(a.user_id)?.name || null,
      email: orgMap.get(a.user_id)?.email || null,
      status: a.status,
      lastLoginAt: a.last_login_at,
      createdAt: a.created_at,
      roles: (a.admin_user_roles || []).map((ur) => ur.roles).filter(Boolean),
    }));
    return res.json({ success: true, admins });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/admin/rbac/admins/:userId/roles
 * Sets a user's admin roles. body: { roleKeys: [...] }
 * An empty array removes admin access entirely.
 */
const setAdminRoles = async (req, res, next) => {
  const { userId } = req.params;
  const { roleKeys } = req.body;
  if (!Array.isArray(roleKeys)) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'roleKeys must be an array.' });
  }

  // Guard against self-lockout: a super_admin cannot strip their own super_admin role.
  if (userId === req.user.id && !roleKeys.includes('super_admin') && req.user.access?.isSuperAdmin) {
    return res.status(400).json({
      success: false,
      error: 'SELF_DEMOTION_FORBIDDEN',
      message: 'You cannot remove your own Super Admin role. Ask another Super Admin to do it.',
    });
  }

  try {
    if (roleKeys.length === 0) {
      // Remove admin access: delete admin_users row (cascades admin_user_roles).
      const { data: existing } = await supabase.from('admin_users').select('id').eq('user_id', userId).maybeSingle();
      if (existing) await supabase.from('admin_users').delete().eq('user_id', userId);
      invalidate(userId);
      await logAdminAction(req, { action: 'rbac.admin.remove', entityType: 'admin_user', entityId: userId });
      return res.json({ success: true, message: 'Admin access removed.' });
    }

    const { data: roles, error: rolesErr } = await supabase.from('roles').select('id, key').in('key', roleKeys);
    if (rolesErr) throw rolesErr;
    if (!roles || roles.length !== roleKeys.length) {
      return res.status(400).json({ success: false, error: 'INVALID_ROLE', message: 'One or more role keys are invalid.' });
    }

    // Upsert the admin_users row.
    const { data: adminRow, error: upErr } = await supabase
      .from('admin_users')
      .upsert({ user_id: userId, status: 'active' }, { onConflict: 'user_id' })
      .select('id')
      .single();
    if (upErr) throw upErr;

    // Replace role assignments.
    await supabase.from('admin_user_roles').delete().eq('admin_user_id', adminRow.id);
    const rows = roles.map((r) => ({ admin_user_id: adminRow.id, role_id: r.id }));
    const { error: insErr } = await supabase.from('admin_user_roles').insert(rows);
    if (insErr) throw insErr;

    invalidate(userId);
    await logAdminAction(req, { action: 'rbac.admin.set_roles', entityType: 'admin_user', entityId: userId, after: { roleKeys } });
    return res.json({ success: true, message: 'Admin roles updated.' });
  } catch (err) {
    next(err);
  }
};

// Role-permission edits can affect many admins at once; clear the whole cache.
function invalidateAllAdmins() {
  require('../../services/rbacService').invalidateAll();
}

module.exports = {
  listPermissions,
  listRoles,
  createRole,
  setRolePermissions,
  listAdminUsers,
  setAdminRoles,
};
