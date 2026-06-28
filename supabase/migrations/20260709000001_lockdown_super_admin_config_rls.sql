-- ════════════════════════════════════════════════════════════════════════
-- Fix: super_admin_config readable by every authenticated organizer
-- ────────────────────────────────────────────────────────────────────────
-- organizer_select_config (USING (true)) let any authenticated user SELECT
-- the entire super_admin_config row, which since 20260616300000 also holds
-- manual_payment_methods (bank/IBAN details) and SMS margin percentages.
--
-- Verified this table is never queried directly by the frontend with the
-- organizer's session (no Supabase client call against super_admin_config
-- in frontend/) — every organizer-facing read (pricing tiers, manual
-- payment instructions, landing stats) goes through the backend, which
-- uses the service-role key and so bypasses RLS entirely. The
-- organizer_select_config policy was therefore pure unnecessary exposure
-- with no functional dependency; dropping it is safe.
--
-- admin_all_config already grants super admins full access (including
-- SELECT), so removing the broad policy leaves admin access intact.
-- ════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS organizer_select_config ON super_admin_config;
