-- ─── WHICH SMS MIGRATIONS HAVE ACTUALLY BEEN APPLIED? ────────────────────────
--
-- Read-only. Run this in the SQL editor before or after applying anything; it
-- reports one row per object the SMS subsystem needs, and which migration
-- supplies it. Anything showing MISSING tells you exactly which file to run.
--
-- Written because a migration failing with `relation "x" does not exist` names
-- the symptom, not the gap — and applying files one at a time out of order is
-- how that gap appears in the first place.

WITH expected(sort_key, object_name, kind, supplied_by) AS (VALUES
  (1,  'sms_credit_wallets',                      'table',  '20260607100000_schema_completion'),
  (2,  'sms_credit_ledger',                       'table',  '20260607100000_schema_completion'),
  (3,  'sms_campaigns',                           'table',  '20260627000000_sms_campaign_jobs'),
  (4,  'sms_campaign_recipients',                 'table',  '20260627000000_sms_campaign_jobs'),
  (5,  'sms_opt_outs',                            'table',  '20260809000000_sms_compliance'),
  (6,  'sms_optin_submissions',                   'table',  '20260810000000_sms_optin_submissions'),
  (7,  'sms_consent_log',                         'table',  '20260811010000_sms_consent_log'),
  (8,  'sms_consent_log.method',                  'column', '20260812010000_host_sms_consent_attestation'),
  (9,  'rsvp_parties.sms_consent_method',         'column', '20260812010000_host_sms_consent_attestation'),
  (10, 'sms_log',                                 'table',  '20260818000000_sms_addon'),
  (11, 'events.sms_addon_purchased_at',           'column', '20260818000000_sms_addon'),
  (12, 'events.sms_settings',                     'column', '20260818000000_sms_addon'),
  (13, 'organizations.sms_consent',               'column', '20260818000000_sms_addon'),
  (14, 'super_admin_config.sms_pricing_config',   'column', '20260819000000_sms_pricing_config'),
  (15, 'sms_credit_ledger.cost_cents',            'column', '20260820000000_sms_usage_and_limits'),
  (16, 'sms_credit_wallets.last_used_at',         'column', '20260820000000_sms_usage_and_limits'),
  (17, 'organizations.sms_delivered_total',       'column', '20260820000000_sms_usage_and_limits'),
  (18, 'increment_sms_delivered',                 'function', '20260820000000_sms_usage_and_limits'),
  (19, 'reset_sms_balance_alerts',                'function', '20260820000000_sms_usage_and_limits'),
  (20, 'sms_admin_analytics',                     'function', '20260820000000_sms_usage_and_limits')
)
SELECT
  e.object_name,
  e.kind,
  CASE
    WHEN e.kind = 'table' THEN
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = e.object_name
      ) THEN 'ok' ELSE 'MISSING' END
    WHEN e.kind = 'column' THEN
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name  = split_part(e.object_name, '.', 1)
          AND column_name = split_part(e.object_name, '.', 2)
      ) THEN 'ok' ELSE 'MISSING' END
    ELSE
      CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = e.object_name
      ) THEN 'ok' ELSE 'MISSING' END
  END AS status,
  e.supplied_by
FROM expected e
ORDER BY e.sort_key;
