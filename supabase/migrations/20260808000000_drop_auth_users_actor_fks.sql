-- ════════════════════════════════════════════════════════════════════════
-- FIX: same class of bug as 20260728000000_drop_checkin_actor_fk.sql, found
-- across the rest of the schema while debugging a 500 on promo code
-- creation — and confirmed to already be blocking admin promotion too.
--
-- Root cause: this app's real identity system is organizations.owner_user_id,
-- a self-issued crypto.randomUUID() minted by register() (authController.js)
-- — NOT Supabase Auth. auth.users in this project is only ever populated
-- manually for platform admins (see supabase/make_super_admin.sql), and only
-- as a one-off bootstrap, not kept in sync going forward. Every column below
-- carries `REFERENCES auth.users(id)` but is actually populated from
-- req.user.id, which traces back to organizations.owner_user_id — so the
-- constraint silently mismatches for any account whose auth.users row was
-- never created, was recreated with a new id, or (for ordinary organizers)
-- never existed in the first place.
--
-- Concretely, this was already:
--   - blocking promo_codes.created_by inserts (the bug that surfaced this)
--   - about to block ANY new admin promotion — applyAdminRoles()
--     (rbacController.js) upserts admin_users.user_id straight from an
--     organizer's owner_user_id, which fails the same FK the moment a
--     second real admin (not the manually-bootstrapped one) is promoted
--   - silently swallowing every admin_audit_logs write for any admin whose
--     id doesn't happen to exist in auth.users (logAdminAction catches and
--     only logs the failure — see backend/middleware/adminAudit.js)
--
-- Fix: drop the FK on every actor/owner column that is populated from this
-- app's own user-id space rather than a verified auth.users id. None of
-- these are ever joined against auth.users in application code — they're
-- plain attribution/ownership uuids — so referential integrity against a
-- table this app's identity doesn't actually live in was never protecting
-- anything real. Columns stay plain nullable/not-null uuid, unchanged.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.organizations         DROP CONSTRAINT IF EXISTS fk_organizations_owner_user_id;
ALTER TABLE public.user_roles            DROP CONSTRAINT IF EXISTS fk_user_roles_user_id;
ALTER TABLE public.admin_users           DROP CONSTRAINT IF EXISTS admin_users_user_id_fkey;
ALTER TABLE public.admin_audit_logs      DROP CONSTRAINT IF EXISTS admin_audit_logs_actor_user_id_fkey;
ALTER TABLE public.sessions              DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE public.login_history         DROP CONSTRAINT IF EXISTS login_history_user_id_fkey;
ALTER TABLE public.devices               DROP CONSTRAINT IF EXISTS devices_user_id_fkey;
ALTER TABLE public.security_events       DROP CONSTRAINT IF EXISTS security_events_user_id_fkey;
ALTER TABLE public.promo_codes           DROP CONSTRAINT IF EXISTS promo_codes_created_by_fkey;
ALTER TABLE public.promo_code_redemptions DROP CONSTRAINT IF EXISTS promo_code_redemptions_redeemed_by_fkey;

COMMIT;
