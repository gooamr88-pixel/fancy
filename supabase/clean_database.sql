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
-- Last updated: 2026-08-10 — the truncate step no longer needs updating. It
-- discovers every table in the `public` schema at runtime, so it stays correct
-- across any set of migrations without being edited. The only hand-maintained
-- parts left are the reseed blocks below (super_admin_config + RBAC), which
-- still have to track their own schemas.
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- Temporarily disable all triggers to avoid FK constraint errors during truncation
SET session_replication_role = 'replica';

-- ─── Drop materialized view (must be dropped before truncating source tables) ───
DROP MATERIALIZED VIEW IF EXISTS mv_daily_revenue CASCADE;

-- ─── Truncate every table in `public`, discovered at runtime ───
-- This used to be a hand-maintained ARRAY of table names, and it drifted badly:
-- it was last synced at 20260719_marketing_forms, so ~30 migrations' worth of
-- newer tables were never truncated. Most of them survived only partially
-- (TRUNCATE ... CASCADE reaches anything with an FK to events/organizations),
-- but four had no FK path to a truncated table at all and came through a
-- "clean" completely intact — `testimonials`, `press_mentions`, `blog_posts`
-- and `promo_codes` (its only FK, created_by -> auth.users, was dropped by
-- 20260808). Those are landing-page and blog content, so the symptom was old
-- marketing copy reappearing on a supposedly empty database.
--
-- Enumerating pg_class instead of listing names means the script can never
-- drift again: a table added by a future migration is cleaned the day it
-- exists, with no edit here.
DO $$
DECLARE
    tbl_list text;
BEGIN
    SELECT string_agg(format('%I.%I', n.nspname, c.relname), ', ')
      INTO tbl_list
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')      -- ordinary + partitioned; excludes views and matviews
       AND NOT c.relispartition          -- partitions are emptied via their parent
       -- Skip anything an extension owns (PostGIS drops spatial_ref_sys into
       -- public, for example). We usually lack the ownership to truncate those,
       -- and the resulting error would abort the whole transaction and leave
       -- the database untouched — a silent no-op clean.
       AND NOT EXISTS (
           SELECT 1 FROM pg_depend d
            WHERE d.objid = c.oid
              AND d.classid = 'pg_class'::regclass
              AND d.deptype = 'e'
       );

    IF tbl_list IS NOT NULL THEN
        -- One statement for all tables: TRUNCATE requires that every table in a
        -- CASCADE group be truncated together anyway, and it sidesteps the
        -- ordering problem the old per-table loop had.
        EXECUTE 'TRUNCATE TABLE ' || tbl_list || ' RESTART IDENTITY CASCADE';
    END IF;
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
                {"name": "Essential", "price_cents": 7900, "max_guests": 100, "max_events": 0, "remove_watermark": false, "recommended": false, "is_custom": false, "features": []},
                {"name": "Premium", "price_cents": 14900, "max_guests": 300, "max_events": 0, "remove_watermark": true, "recommended": true, "is_custom": false, "features": []},
                {"name": "Enterprise", "price_cents": 24900, "max_guests": 1000, "max_events": 0, "remove_watermark": true, "recommended": false, "is_custom": false, "features": []}
            ]'::jsonb,
            -- Cents per SEGMENT that the carrier charges us: Vonage US outbound
            -- $0.00809 plus roughly $0.002-0.003 of carrier pass-through fees.
            -- Fractional on purpose; the column is NUMERIC since 20260822000000.
            1.1,
            -- 1.1 x 2.7273 = 3.00 cents list price to the organizer.
            172.73,
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

-- ─── Recreate materialized view ───
-- Matches the definition from supabase/migrations/20260717000000_admin_
-- revenue_consistency_fix.sql (folds in SMS credit purchases alongside event
-- fees) — an earlier version of this file recreated the pre-20260717
-- definition here, which would silently downgrade an already-migrated
-- database's view back to the old gross/refund logic on every clean run.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_payments'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sms_credit_ledger'
    ) THEN
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_revenue AS
        WITH combined AS (
          SELECT
            date_trunc('day', COALESCE(completed_at, created_at))::date AS day,
            amount_cents,
            CASE
              WHEN refunded_at IS NOT NULL THEN COALESCE(refund_amount_cents, 0)
              WHEN status = 'refunded'     THEN COALESCE(refund_amount_cents, amount_cents)
              ELSE 0
            END AS refunded_cents,
            (status IN ('completed', 'refunded')) AS counts
          FROM event_payments
          UNION ALL
          SELECT
            date_trunc('day', created_at)::date AS day,
            COALESCE(amount_cents, 0) AS amount_cents,
            0 AS refunded_cents,
            true AS counts
          FROM sms_credit_ledger
          WHERE transaction_type = 'purchase'
        )
        SELECT
          day,
          COALESCE(sum(amount_cents) FILTER (WHERE counts), 0) AS gross_cents,
          COALESCE(sum(refunded_cents), 0) AS refunded_cents,
          COALESCE(sum(amount_cents) FILTER (WHERE counts), 0) - COALESCE(sum(refunded_cents), 0) AS net_cents,
          count(*) FILTER (WHERE counts) AS payment_count
        FROM combined
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
