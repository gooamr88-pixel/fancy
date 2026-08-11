-- ════════════════════════════════════════════════════════════════════════════
-- WHICH OF THE SIX SMS MIGRATIONS HAVE ACTUALLY RUN
--
-- Read-only. Run this FIRST and apply only what comes back "MISSING".
--
-- Each row probes a thing one migration creates, so the answer does not depend on
-- a migrations table being accurate — which matters here, because the SQL was
-- applied by hand rather than by the CLI.
-- ════════════════════════════════════════════════════════════════════════════

WITH probe AS (
  SELECT
    -- 1 · 20260818000000_sms_addon — the one the error proved absent
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='events' AND column_name='sms_settings')      AS c_sms_settings,
    (SELECT count(*) FROM information_schema.tables
      WHERE table_schema='public' AND table_name='sms_log')                                    AS t_sms_log,
    -- 2 · 20260819000000_sms_pricing_config
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='super_admin_config' AND column_name='sms_pricing_config') AS c_pricing,
    -- 3 · 20260820000000_sms_usage_and_limits
    (SELECT count(*) FROM information_schema.tables
      WHERE table_schema='public' AND table_name='sms_credit_ledger')                          AS t_ledger,
    -- 4 · 20260821000000_sms_organizer_optin_and_perf
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='organizations' AND column_name='sms_consent') AS c_org_consent,
    -- 5 · 20260822000000_sms_rebuild — short_links is what every SMS link depends on
    (SELECT count(*) FROM information_schema.tables
      WHERE table_schema='public' AND table_name='short_links')                                 AS t_short_links,
    (SELECT count(*) FROM information_schema.tables
      WHERE table_schema='public' AND table_name='seating_notify_queue')                        AS t_seating_queue
)
SELECT step, migration, needs, state FROM (
  SELECT 1 AS step, '20260818000000_sms_addon'                  AS migration,
         'events.sms_settings + sms_log'                        AS needs,
         CASE WHEN c_sms_settings>0 AND t_sms_log>0 THEN 'ok' ELSE 'MISSING' END AS state FROM probe
  UNION ALL
  SELECT 2, '20260819000000_sms_pricing_config', 'super_admin_config.sms_pricing_config',
         CASE WHEN c_pricing>0     THEN 'ok' ELSE 'MISSING' END FROM probe
  UNION ALL
  SELECT 3, '20260820000000_sms_usage_and_limits', 'sms_credit_ledger',
         CASE WHEN t_ledger>0      THEN 'ok' ELSE 'MISSING' END FROM probe
  UNION ALL
  SELECT 4, '20260821000000_sms_organizer_optin_and_perf', 'organizations.sms_consent',
         CASE WHEN c_org_consent>0 THEN 'ok' ELSE 'MISSING' END FROM probe
  UNION ALL
  SELECT 5, '20260822000000_sms_rebuild', 'short_links + seating_notify_queue',
         CASE WHEN t_short_links>0 AND t_seating_queue>0 THEN 'ok' ELSE 'MISSING' END FROM probe
) rows ORDER BY step;


-- ── Step 6 has no schema of its own: it only writes data. Ask the data. ──
-- Run this only once step 1 reports ok, or it errors the same way as before.
--
--   SELECT
--     count(*)                                                   AS events,
--     count(*) FILTER (WHERE sms_settings ? 'rsvp_confirmation')  AS have_new_key,
--     count(*) FILTER (WHERE sms_settings ? 'campaign')           AS still_pre_rebuild
--   FROM public.events;
--
-- have_new_key = events  → 20260823000000 has run.
-- still_pre_rebuild > 0  → 20260822000000 has NOT finished; run it before 6.
