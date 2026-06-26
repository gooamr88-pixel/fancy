/**
 * Bootstrap Super Admin — one-time script.
 *
 * Usage:  node scripts/bootstrap-admin.js <email>
 *
 * What it does:
 *  1. Looks up the organization by email.
 *  2. Ensures a 'super_admin' role exists in the `roles` table.
 *  3. Upserts an `admin_users` row linked to the org's owner_user_id.
 *  4. Assigns the super_admin role via `admin_user_roles`.
 *  5. Upserts a `user_roles` row so the legacy check also works.
 *
 * Safe to run multiple times — uses upserts.
 */

require('dotenv').config();
const { supabase } = require('../config/supabase');

(async () => {
  const email = (process.argv[2] || '').toLowerCase().trim();
  if (!email) {
    console.error('Usage: node scripts/bootstrap-admin.js <email>');
    process.exit(1);
  }

  console.log(`\n🔍 Looking up organization for: ${email}`);

  // 1. Find the org
  const { data: orgs, error: orgErr } = await supabase
    .from('organizations')
    .select('id, owner_user_id, name, email')
    .eq('email', email)
    .limit(1);

  if (orgErr) { console.error('❌ DB error:', orgErr.message); process.exit(1); }
  const org = orgs?.[0];
  if (!org) { console.error(`❌ No organization found for ${email}. Register first at /register.`); process.exit(1); }

  const userId = org.owner_user_id;
  console.log(`✅ Found org: "${org.name}" (userId=${userId})`);

  // 2. Ensure the 'super_admin' role exists
  let { data: role } = await supabase.from('roles').select('id, key').eq('key', 'super_admin').maybeSingle();
  if (!role) {
    console.log('📝 Creating "super_admin" role...');
    const { data: created, error: roleErr } = await supabase
      .from('roles')
      .insert({ key: 'super_admin', name: 'Super Admin', description: 'Full platform access' })
      .select('id, key')
      .single();
    if (roleErr) { console.error('❌ Could not create role:', roleErr.message); process.exit(1); }
    role = created;
  }
  console.log(`✅ Role: ${role.key} (id=${role.id})`);

  // 3. Upsert admin_users
  const { data: adminRow, error: adminErr } = await supabase
    .from('admin_users')
    .upsert({ user_id: userId, status: 'active' }, { onConflict: 'user_id' })
    .select('id')
    .single();
  if (adminErr) { console.error('❌ admin_users upsert failed:', adminErr.message); process.exit(1); }
  console.log(`✅ admin_users row: id=${adminRow.id}`);

  // 4. Link admin ↔ role (replace existing assignments)
  await supabase.from('admin_user_roles').delete().eq('admin_user_id', adminRow.id);
  const { error: linkErr } = await supabase
    .from('admin_user_roles')
    .insert({ admin_user_id: adminRow.id, role_id: role.id });
  if (linkErr) { console.error('❌ admin_user_roles insert failed:', linkErr.message); process.exit(1); }
  console.log(`✅ Assigned super_admin role`);

  // 5. Legacy user_roles table
  const { error: legacyErr } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: 'super_admin' }, { onConflict: 'user_id' });
  if (!legacyErr) {
    console.log(`✅ Legacy user_roles updated`);
  } else {
    console.log(`⚠️  Legacy user_roles upsert skipped (table may not exist): ${legacyErr.message}`);
  }

  console.log(`\n🎉 Done! "${org.name}" (${email}) is now a Super Admin.`);
  console.log(`   Log out → log back in → you should see the "Super Admin" button.\n`);
  process.exit(0);
})();
