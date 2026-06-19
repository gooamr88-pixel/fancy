-- ════════════════════════════════════════════════════════════════════════
-- RBAC FOUNDATION — granular role & permission system for the Super Admin
-- Control Center (Master Plan §1.1 / §18 / Foundation F1).
-- ────────────────────────────────────────────────────────────────────────
-- Replaces the binary user_roles.role ('organizer' | 'super_admin') model with
-- a proper role→permission matrix supporting 6 admin roles. The legacy
-- user_roles table is LEFT IN PLACE (still flags organizers); existing
-- super_admins are migrated into admin_users + the 'super_admin' role.
--
-- Enforcement: the backend uses the service-role key (bypasses RLS), so these
-- tables have RLS ENABLED with NO policies — a hard deny for any anon/authed
-- client. Only the trusted backend may read/write them.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT false,   -- system roles cannot be deleted
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         TEXT UNIQUE NOT NULL,             -- e.g. 'billing.refund'
    "group"     TEXT NOT NULL,                    -- e.g. 'payments'
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS admin_users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    mfa_enabled  BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_user_roles (
    admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (admin_user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_users_user ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_roles_admin ON admin_user_roles(admin_user_id);

-- ─────────────────────────────────────────────────────────
-- Seed: roles
-- ─────────────────────────────────────────────────────────

INSERT INTO roles (key, name, description, is_system) VALUES
    ('super_admin',        'Super Admin',        'Unrestricted platform owner. Implicitly holds every permission.', true),
    ('admin',              'Admin',              'Broad operational access; cannot manage roles/permissions or run destructive data ops.', true),
    ('finance_manager',    'Finance Manager',    'Payments, refunds, credits, subscriptions and financial analytics.', true),
    ('operations_manager', 'Operations Manager', 'Events, guests, invitations and operational monitoring.', true),
    ('marketing_manager',  'Marketing Manager',  'CMS, campaigns, coupons and broadcast notifications.', true),
    ('support_agent',      'Support Agent',      'Support tickets and read-only access to users/organizers/events.', true)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────
-- Seed: permission catalog (one row per capability)
-- ─────────────────────────────────────────────────────────

INSERT INTO permissions (key, "group", description) VALUES
    ('overview.view',        'overview',      'View executive overview & KPIs'),
    ('cms.view',             'cms',           'View landing CMS content'),
    ('cms.manage',           'cms',           'Edit landing CMS content'),
    ('authconfig.view',      'auth',          'View authentication policy'),
    ('authconfig.manage',    'auth',          'Edit authentication policy'),
    ('users.view',           'users',         'View platform users'),
    ('users.manage',         'users',         'Edit / suspend / ban / restore / delete users'),
    ('users.sessions',       'users',         'View and revoke user sessions'),
    ('organizers.view',      'organizers',    'View organizers'),
    ('organizers.manage',    'organizers',    'Edit / suspend / activate / delete organizers'),
    ('organizers.impersonate','organizers',   'Impersonate an organizer'),
    ('events.view',          'events',        'View events'),
    ('events.manage',        'events',        'Create / edit / archive / cancel / delete events'),
    ('invitations.view',     'invitations',   'View invitation delivery funnel'),
    ('guests.view',          'guests',        'View guests'),
    ('guests.manage',        'guests',        'Manage guest tags / groups / VIP'),
    ('payments.view',        'payments',      'View payments ledger'),
    ('payments.refund',      'payments',      'Issue refunds'),
    ('payments.manage',      'payments',      'Approve / decline manual payments'),
    ('credits.view',         'credits',       'View credit wallets'),
    ('credits.manage',       'credits',       'Grant / deduct / bonus credits, manage packages'),
    ('subscriptions.view',   'subscriptions', 'View plans & subscriptions'),
    ('subscriptions.manage', 'subscriptions', 'Create / edit / enable / disable plans'),
    ('config.view',          'config',        'View platform configuration'),
    ('config.manage',        'config',        'Edit platform configuration, integrations & secrets'),
    ('flags.view',           'flags',         'View feature flags'),
    ('flags.manage',         'flags',         'Toggle feature flags'),
    ('notifications.view',   'notifications', 'View notification templates & broadcasts'),
    ('notifications.manage', 'notifications', 'Edit templates and send broadcasts'),
    ('support.view',         'support',       'View support tickets'),
    ('support.manage',       'support',       'Assign / reply / resolve support tickets'),
    ('analytics.view',       'analytics',     'View analytics dashboards'),
    ('analytics.export',     'analytics',     'Export analytics (CSV/Excel/PDF)'),
    ('audit.view',           'audit',         'View audit logs'),
    ('rbac.view',            'rbac',          'View roles & permissions'),
    ('rbac.manage',          'rbac',          'Create roles and assign permissions'),
    ('security.view',        'security',      'View security center'),
    ('security.manage',      'security',      'Manage sessions / security policy'),
    ('health.view',          'health',        'View system health'),
    ('insights.view',        'insights',      'View AI insights'),
    ('finance.view',         'finance',       'View financial command center'),
    ('marketing.view',       'marketing',     'View marketing center'),
    ('marketing.manage',     'marketing',     'Manage coupons / campaigns / referrals'),
    ('data.view',            'data',          'View data management & backups'),
    ('data.manage',          'data',          'Run import / export / backup / restore'),
    ('operations.view',      'operations',    'View platform operations center')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────
-- Seed: role → permission grants
-- super_admin is intentionally NOT granted rows here; the backend treats the
-- 'super_admin' role as an implicit wildcard so it automatically holds every
-- permission added in the future.
-- ─────────────────────────────────────────────────────────

-- admin: everything EXCEPT rbac.manage and data.manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.key = 'admin' AND p.key NOT IN ('rbac.manage', 'data.manage')
ON CONFLICT DO NOTHING;

-- finance_manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.key = 'finance_manager' AND p.key IN (
    'overview.view','payments.view','payments.refund','payments.manage',
    'credits.view','credits.manage','subscriptions.view','subscriptions.manage',
    'finance.view','analytics.view','analytics.export','audit.view'
) ON CONFLICT DO NOTHING;

-- operations_manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.key = 'operations_manager' AND p.key IN (
    'overview.view','events.view','events.manage','guests.view','guests.manage',
    'invitations.view','operations.view','health.view','analytics.view','audit.view'
) ON CONFLICT DO NOTHING;

-- marketing_manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.key = 'marketing_manager' AND p.key IN (
    'overview.view','marketing.view','marketing.manage','cms.view','cms.manage',
    'notifications.view','notifications.manage','analytics.view','analytics.export'
) ON CONFLICT DO NOTHING;

-- support_agent
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.key = 'support_agent' AND p.key IN (
    'overview.view','support.view','support.manage',
    'users.view','organizers.view','events.view'
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────
-- Migrate existing super_admins (from legacy user_roles) into admin_users
-- and grant them the super_admin role.
-- ─────────────────────────────────────────────────────────

INSERT INTO admin_users (user_id, status)
SELECT ur.user_id, 'active'
FROM user_roles ur
WHERE ur.role = 'super_admin'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO admin_user_roles (admin_user_id, role_id)
SELECT au.id, r.id
FROM admin_users au
JOIN user_roles ur ON ur.user_id = au.user_id AND ur.role = 'super_admin'
JOIN roles r ON r.key = 'super_admin'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────
-- RLS: enable with no policies → service-role-only (hard deny for clients)
-- ─────────────────────────────────────────────────────────

ALTER TABLE roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_user_roles  ENABLE ROW LEVEL SECURITY;

COMMIT;
