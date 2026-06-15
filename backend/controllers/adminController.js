const { supabase } = require('../config/supabase');

const VALID_ROLES = ['organizer', 'super_admin'];

/**
 * Lists platform users (organizers) with their current role so a Super Admin can
 * promote/demote them. Roles default to 'organizer' when no user_roles row exists.
 * GET /api/v1/admin/users
 */
const listPlatformUsers = async (req, res, next) => {
  try {
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('owner_user_id, name, email, created_at')
      .order('created_at', { ascending: false });

    if (orgError) throw orgError;

    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (roleError) throw roleError;

    const roleByUser = new Map((roles || []).map(r => [r.user_id, r.role]));

    const users = (orgs || []).map(o => ({
      userId: o.owner_user_id,
      name: o.name,
      email: o.email,
      role: roleByUser.get(o.owner_user_id) || 'organizer',
    }));

    return res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
};

/**
 * Assigns a role (organizer | super_admin) to a user.
 * PATCH /api/v1/admin/users/role  body: { userId, role }
 */
const setUserRole = async (req, res, next) => {
  const { userId, role } = req.body;

  if (!userId || !role) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'userId and role are required.' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: 'INVALID_ROLE', message: `role must be one of: ${VALID_ROLES.join(', ')}.` });
  }
  // Prevent a super admin from demoting themselves (avoids accidental lockout).
  if (userId === req.user.id && role !== 'super_admin') {
    return res.status(400).json({
      success: false,
      error: 'SELF_DEMOTION_FORBIDDEN',
      message: 'You cannot remove your own Super Admin role. Ask another Super Admin to do it.',
    });
  }

  try {
    const { data, error } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    return res.json({ success: true, message: 'User role updated successfully.', userRole: data });
  } catch (err) {
    next(err);
  }
};

module.exports = { listPlatformUsers, setUserRole };
