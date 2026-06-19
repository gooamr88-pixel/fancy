-- ═══════════════════════════════════════════════════════════
-- FANCY RSVP — CLEAN DATABASE
-- Deletes ALL data from every table. Development/testing only.
--
-- ⚠ WARNING: This will permanently delete ALL data.
--   DO NOT run against production.
--
-- Usage:  psql -f clean_database.sql
--    or:  paste into Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- Temporarily disable all triggers to avoid FK constraint errors during truncation
SET session_replication_role = 'replica';

-- ─── Drop materialized view (must be dropped before truncating source tables) ───
DROP MATERIALIZED VIEW IF EXISTS mv_daily_revenue CASCADE;

-- ─── Truncate all tables (order: leaf/child tables → parent tables) ───

-- Admin & Security
TRUNCATE TABLE admin_audit_logs CASCADE;
TRUNCATE TABLE security_events CASCADE;
TRUNCATE TABLE login_history CASCADE;
TRUNCATE TABLE devices CASCADE;
TRUNCATE TABLE sessions CASCADE;
TRUNCATE TABLE admin_user_roles CASCADE;
TRUNCATE TABLE admin_users CASCADE;
TRUNCATE TABLE role_permissions CASCADE;
TRUNCATE TABLE permissions CASCADE;
TRUNCATE TABLE roles CASCADE;
TRUNCATE TABLE user_roles CASCADE;

-- Subscriptions & Payments
TRUNCATE TABLE payment_disputes CASCADE;
TRUNCATE TABLE event_payments CASCADE;
TRUNCATE TABLE subscriptions CASCADE;
TRUNCATE TABLE plans CASCADE;
TRUNCATE TABLE credit_packages CASCADE;

-- SMS & Campaigns
TRUNCATE TABLE sms_credit_ledger CASCADE;
TRUNCATE TABLE sms_credit_wallets CASCADE;

-- Seating
TRUNCATE TABLE seating_assignments CASCADE;
TRUNCATE TABLE tables CASCADE;

-- RSVPs & Guests
TRUNCATE TABLE custom_answers CASCADE;
TRUNCATE TABLE rsvp_guests CASCADE;
TRUNCATE TABLE check_ins CASCADE;
TRUNCATE TABLE email_invitations CASCADE;
TRUNCATE TABLE rsvp_form_fields CASCADE;
TRUNCATE TABLE rsvps CASCADE;

-- Activity & Analytics
TRUNCATE TABLE activity_logs CASCADE;

-- Events
TRUNCATE TABLE events CASCADE;

-- Organizations
TRUNCATE TABLE organizations CASCADE;

-- Platform Config
TRUNCATE TABLE super_admin_config CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- ─── Recreate materialized view ───
-- (The view definition from 20260619130000_overview_finance.sql)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_revenue AS
SELECT
  date_trunc('day', ep.created_at)::date AS day,
  COALESCE(SUM(ep.amount_cents) FILTER (WHERE ep.status = 'completed'), 0) AS gross_cents,
  COALESCE(SUM(ep.refund_amount_cents) FILTER (WHERE ep.refund_amount_cents > 0), 0) AS refunded_cents,
  COALESCE(SUM(ep.amount_cents) FILTER (WHERE ep.status = 'completed'), 0)
    - COALESCE(SUM(ep.refund_amount_cents) FILTER (WHERE ep.refund_amount_cents > 0), 0) AS net_cents,
  COUNT(*) FILTER (WHERE ep.status = 'completed') AS payment_count
FROM event_payments ep
GROUP BY 1
ORDER BY 1 DESC;

-- Refresh (will be empty but ensures the view is queryable)
REFRESH MATERIALIZED VIEW mv_daily_revenue;

COMMIT;

-- ═══ NOTE ═══
-- To also clean Supabase Storage (uploaded files), run in the Supabase dashboard:
--   DELETE FROM storage.objects WHERE bucket_id = 'event-assets';
-- This removes all uploaded music, gallery images, and cover images.
