-- ═══════════════════════════════════════════════════════════
-- FANCY RSVP — CLEAN DATABASE (COMPLETE)
-- Deletes ALL data from every table. Development/testing only.
--
-- ⚠ WARNING: This will permanently delete ALL data.
--   DO NOT run against production.
--
-- Usage:  psql -f clean_database.sql
--    or:  paste into Supabase SQL Editor
--
-- Last updated: 2026-06-26 — synced with migration
-- 20260704000000_submit_rsvp_phone_dedupe + backend 002_guest_analytics.
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- Temporarily disable all triggers to avoid FK constraint errors during truncation
SET session_replication_role = 'replica';

-- ─── Drop materialized view (must be dropped before truncating source tables) ───
DROP MATERIALIZED VIEW IF EXISTS mv_daily_revenue CASCADE;

-- ─── Truncate all tables conditionally ───
DO $$
DECLARE
    tbl text;
    tbls text[] := ARRAY[
        'sms_campaign_recipients',
        'sms_campaigns',
        'email_log',
        'guest_analytics',
        'guest_reminders',
        'admin_audit_logs',
        'security_events',
        'login_history',
        'devices',
        'sessions',
        'admin_user_roles',
        'admin_users',
        'role_permissions',
        'permissions',
        'roles',
        'user_roles',
        'payment_disputes',
        'event_payments',
        'subscriptions',
        'plans',
        'credit_packages',
        'sms_credit_ledger',
        'sms_credit_wallets',
        'seating_assignments',
        'tables',
        'custom_answers',
        'rsvp_guests',
        'check_ins',
        'rsvp_form_fields',
        'rsvps',
        'activity_logs',
        'events',
        'organizations',
        'super_admin_config'
    ];
BEGIN
    FOREACH tbl IN ARRAY tbls LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            EXECUTE 'TRUNCATE TABLE ' || quote_ident(tbl) || ' CASCADE';
        END IF;
    END LOOP;
END $$;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- ─── Reseed: super_admin_config ───
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'super_admin_config') THEN
        INSERT INTO super_admin_config (id, pricing_tiers, sms_rate_cents_per_credit, sms_markup_percentage, platform_commission_pct)
        VALUES (
            '00000000-0000-0000-0000-000000000000',
            '[
                {"name": "Essential", "price_cents": 7900, "max_guests": 100},
                {"name": "Premium", "price_cents": 14900, "max_guests": 300},
                {"name": "Enterprise", "price_cents": 24900, "max_guests": 1000}
            ]'::jsonb,
            8,
            40.0,
            0.0
        ) ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- ─── Reseed: RBAC roles ───
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
        INSERT INTO roles (key, name, description, is_system) VALUES
            ('super_admin',        'Super Admin',        'Unrestricted platform owner. Implicitly holds every permission.', true),
            ('admin',              'Admin',              'Broad operational access; cannot manage roles/permissions or run destructive data ops.', true),
            ('finance_manager',    'Finance Manager',    'Payments, refunds, credits, subscriptions and financial analytics.', true),
            ('operations_manager', 'Operations Manager', 'Events, guests, invitations and operational monitoring.', true),
            ('marketing_manager',  'Marketing Manager',  'CMS, campaigns, coupons and broadcast notifications.', true),
            ('support_agent',      'Support Agent',      'Support tickets and read-only access to users/organizers/events.', true)
        ON CONFLICT (key) DO NOTHING;
    END IF;
END $$;

-- ─── Reseed: permission catalog ───
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'permissions') THEN
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
    END IF;
END $$;

-- ─── Reseed: role→permission grants ───
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_permissions'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'permissions'
    ) THEN
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
    END IF;
END $$;

-- ─── Reseed: plans from pricing_tiers ───
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plans'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'super_admin_config'
    ) THEN
        INSERT INTO plans (key, name, price_cents, max_guests, sort_order, "interval")
        SELECT
            lower(regexp_replace(tier->>'name', '[^a-zA-Z0-9]+', '_', 'g')) AS key,
            tier->>'name'                                                    AS name,
            COALESCE((tier->>'price_cents')::int, 0)                         AS price_cents,
            (tier->>'max_guests')::int                                       AS max_guests,
            ord                                                              AS sort_order,
            'one_time'
        FROM super_admin_config sac,
             LATERAL jsonb_array_elements(sac.pricing_tiers) WITH ORDINALITY AS arr(tier, ord)
        WHERE sac.id = '00000000-0000-0000-0000-000000000000'
        ON CONFLICT (key) DO NOTHING;
    END IF;
END $$;

-- ─── Recreate materialized view ───
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_payments'
    ) THEN
        -- Recreate materialized view
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_revenue AS
        SELECT
          date_trunc('day', COALESCE(ep.completed_at, ep.created_at))::date AS day,
          COALESCE(SUM(ep.amount_cents) FILTER (WHERE ep.status IN ('completed', 'refunded')), 0) AS gross_cents,
          COALESCE(SUM(
            CASE
              WHEN ep.refunded_at IS NOT NULL THEN COALESCE(ep.refund_amount_cents, 0)
              WHEN ep.status = 'refunded'     THEN COALESCE(ep.refund_amount_cents, ep.amount_cents)
              ELSE 0
            END
          ), 0) AS refunded_cents,
          COALESCE(SUM(ep.amount_cents) FILTER (WHERE ep.status IN ('completed', 'refunded')), 0)
            - COALESCE(SUM(
                CASE
                  WHEN ep.refunded_at IS NOT NULL THEN COALESCE(ep.refund_amount_cents, 0)
                  WHEN ep.status = 'refunded'     THEN COALESCE(ep.refund_amount_cents, ep.amount_cents)
                  ELSE 0
                END
              ), 0) AS net_cents,
          COUNT(*) FILTER (WHERE ep.status IN ('completed', 'refunded')) AS payment_count
        FROM event_payments ep
        GROUP BY 1;

        -- Unique index on the grouping key is required for REFRESH ... CONCURRENTLY
        CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_revenue_day ON mv_daily_revenue(day);

        -- Refresh (will be empty but ensures the view is queryable)
        REFRESH MATERIALIZED VIEW mv_daily_revenue;
    END IF;
END $$;

COMMIT;

-- ═══ NOTE ═══
-- To also clean Supabase Storage (uploaded files), run in the Supabase dashboard:
--   DELETE FROM storage.objects WHERE bucket_id = 'event-assets';
-- This removes all uploaded music, gallery images, and cover images.
