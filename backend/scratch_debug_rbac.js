require('dotenv').config();
const { supabase } = require('./config/supabase');

async function debugRbac() {
  try {
    console.log("Checking admin_users...");
    const { data: adminUsers, error: auErr } = await supabase.from('admin_users').select('*');
    if (auErr) console.error("admin_users error:", auErr);
    else console.log("admin_users count:", adminUsers.length, adminUsers);

    console.log("Checking roles...");
    const { data: roles, error: rErr } = await supabase.from('roles').select('*');
    if (rErr) console.error("roles error:", rErr);
    else console.log("roles count:", roles.length, roles);

    console.log("Checking admin_user_roles...");
    const { data: adminUserRoles, error: aurErr } = await supabase.from('admin_user_roles').select('*');
    if (aurErr) console.error("admin_user_roles error:", aurErr);
    else console.log("admin_user_roles count:", adminUserRoles.length, adminUserRoles);

    // Let's try the exact query from rbacService:
    // adminPromise = supabase
    //   .from('admin_users')
    //   .select('id, status, admin_user_roles(roles(key, role_permissions(permissions(key))))')
    //   .eq('user_id', userId)
    console.log("Trying the nested join query from rbacService.js...");
    if (adminUsers.length > 0) {
      const userId = adminUsers[0].user_id;
      console.log(`Querying for user_id: ${userId}`);
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, status, admin_user_roles(roles(key, role_permissions(permissions(key))))')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.error("rbacService join query failed:", error);
      } else {
        console.log("rbacService join query success:", JSON.stringify(data, null, 2));
      }
    } else {
      console.log("No admin user found to test the nested query.");
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

debugRbac();
