-- ============================================================================
--  Stripe Test → LIVE cutover — database cleanup
--  Run ONCE against the PRODUCTION Supabase project, at cutover.
--
--  Why: the LIVE Stripe account is a brand-new account (different email) than the
--  test account. Stripe Customer IDs do NOT carry across accounts/modes. Any
--  test-mode `cus_...` stored on an organization, if sent with the new sk_live_
--  key, throws "No such customer" and breaks checkout creation.
--
--  Effect after running:
--    • Event checkout transparently recreates a fresh Live customer on the org's
--      next payment (createCheckoutSession auto-creates when this is NULL).
--    • SMS-credit purchase intentionally blocks (NO_STRIPE_CUSTOMER) for an org
--      until it has completed one event payment in Live — existing, correct flow.
--
--  Safe + idempotent: if the column is already all NULL (fresh DB), it's a no-op.
-- ============================================================================

-- 1) Pre-check — how many rows will be affected (run first, just to look).
SELECT count(*) AS rows_with_test_customer_id
FROM   organizations
WHERE  stripe_customer_id IS NOT NULL;

-- 2) The cleanup. Clears test-mode Stripe customer IDs so Live recreates them.
UPDATE organizations
SET    stripe_customer_id = NULL
WHERE  stripe_customer_id IS NOT NULL;

-- 3) Verify — MUST return 0.
SELECT count(*) AS remaining_non_null
FROM   organizations
WHERE  stripe_customer_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- OPTIONAL (data hygiene, not required for correctness):
-- Historical test charges in event_payments / sms_credit_ledger hold test-mode
-- cs_/pi_/re_ IDs. They are inert (Live IDs won't collide), but if this prod DB
-- also held QA/test money you may want to archive them so financial reporting
-- doesn't mix test and real revenue. Review BEFORE deleting — adjust the filter
-- to match how you tag test data; the statements below are intentionally left
-- commented out so nothing is removed by accident.
--
--   -- SELECT id, event_id, amount_cents, status, created_at
--   --   FROM event_payments WHERE payment_method = 'stripe' AND created_at < '<cutover-date>';
--   -- DELETE FROM event_payments WHERE ...;   -- only after confirming the set
-- ----------------------------------------------------------------------------
