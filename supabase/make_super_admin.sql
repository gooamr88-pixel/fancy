-- ═══════════════════════════════════════════════════════════
-- FANCY RSVP — MAKE SUPER ADMIN
-- Creates the user gooamr88@gmail.com and grants full
-- super_admin access across all RBAC tables.
--
-- Run this in the Supabase SQL Editor AFTER all migrations
-- have been applied.
-- ═══════════════════════════════════════════════════════════

-- ─── Step 1: Create the auth user (if not exists) ───
-- Supabase stores users in auth.users with bcrypt-hashed passwords.
-- pgcrypto (crypt/gen_salt) is pre-installed on every Supabase project.

INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    role,
    aud,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
)
SELECT
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'gooamr88@gmail.com',
    crypt('Yousefamr100100@@', gen_salt('bf')),
    now(),
    'authenticated',
    'authenticated',
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Super Admin"}'::jsonb,
    false,       -- Supabase internal flag, not our app-level super admin
    now(),
    now(),
    '',
    '',
    '',
    ''
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'gooamr88@gmail.com'
);

-- Also create the identity record (required by Supabase Auth for email login)
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email),
    'email',
    u.id::text,
    now(),
    now(),
    now()
FROM auth.users u
WHERE u.email = 'gooamr88@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = u.id AND i.provider = 'email'
  );

-- ─── Step 2: Add to user_roles (legacy super_admin flag) ───
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'
FROM auth.users
WHERE email = 'gooamr88@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

-- ─── Step 3: Add to admin_users (RBAC system) ───
INSERT INTO public.admin_users (user_id, status, mfa_enabled, last_login_at)
SELECT id, 'active', false, now()
FROM auth.users
WHERE email = 'gooamr88@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET status = 'active';

-- ─── Step 4: Grant super_admin role in admin_user_roles ───
INSERT INTO public.admin_user_roles (admin_user_id, role_id)
SELECT au.id, r.id
FROM public.admin_users au
JOIN auth.users u ON u.id = au.user_id
JOIN public.roles r ON r.key = 'super_admin'
WHERE u.email = 'gooamr88@gmail.com'
ON CONFLICT (admin_user_id, role_id) DO NOTHING;

-- ─── Verify ───
SELECT
    u.id AS auth_user_id,
    u.email,
    ur.role AS legacy_role,
    au.status AS admin_status,
    r.key AS rbac_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.admin_users au ON au.user_id = u.id
LEFT JOIN public.admin_user_roles aur ON aur.admin_user_id = au.id
LEFT JOIN public.roles r ON r.id = aur.role_id
WHERE u.email = 'gooamr88@gmail.com';
