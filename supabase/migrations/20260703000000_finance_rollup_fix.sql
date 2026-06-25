-- ════════════════════════════════════════════════════════════════════════
-- FINANCIAL COMMAND CENTER — ROLLUP CORRECTNESS FIX (Master Plan §22)
-- ────────────────────────────────────────────────────────────────────────
-- Fixes two real defects in the daily-revenue rollup that backs
-- GET /admin/finance/summary:
--
--   1) REFRESH OWNERSHIP. refresh_daily_revenue() was SECURITY INVOKER, but
--      `REFRESH MATERIALIZED VIEW` requires ownership of the view. The backend
--      calls it with the service_role (not the owner), so every refresh failed
--      — meaning the rollup was NEVER updated after creation and the Financial
--      Command Center showed stale/empty numbers. Now SECURITY DEFINER, so it
--      runs as the owning (migration) role. Mirrors record_sms_purchase /
--      approve_event_cash.
--
--   2) NET REVENUE WENT NEGATIVE ON FULL REFUNDS. gross_cents only counted
--      status='completed', so a fully-refunded payment (status='refunded') was
--      dropped from gross entirely while its refund_amount_cents was still
--      subtracted — yielding gross 0 / refunded X / net -X for a sale that
--      should net to 0. Gross now counts money that was actually collected
--      (completed OR refunded), and refunded_cents robustly covers both refund
--      code paths (admin stripeRefundService AND the charge.refunded webhook)
--      plus legacy rows written before refund_amount_cents/refunded_at existed.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- A materialized view cannot be CREATE OR REPLACE'd — drop and recreate. This
-- also drops idx_mv_daily_revenue_day, recreated below.
DROP MATERIALIZED VIEW IF EXISTS mv_daily_revenue;

CREATE MATERIALIZED VIEW mv_daily_revenue AS
SELECT
  date_trunc('day', COALESCE(completed_at, created_at))::date AS day,

  -- Gross = money successfully collected. A refunded payment WAS collected, so
  -- it belongs in gross; the refund is accounted for separately below.
  COALESCE(sum(amount_cents) FILTER (WHERE status IN ('completed', 'refunded')), 0) AS gross_cents,

  -- Refunded = money returned. Covers every shape a refunded row can take:
  --   • new rows  → refunded_at set, use refund_amount_cents (partial or full)
  --   • legacy rows → status 'refunded' but no amount/date, fall back to full amount
  COALESCE(sum(
    CASE
      WHEN refunded_at IS NOT NULL THEN COALESCE(refund_amount_cents, 0)
      WHEN status = 'refunded'     THEN COALESCE(refund_amount_cents, amount_cents)
      ELSE 0
    END
  ), 0) AS refunded_cents,

  -- Net = collected - returned.
  COALESCE(sum(amount_cents) FILTER (WHERE status IN ('completed', 'refunded')), 0)
    - COALESCE(sum(
        CASE
          WHEN refunded_at IS NOT NULL THEN COALESCE(refund_amount_cents, 0)
          WHEN status = 'refunded'     THEN COALESCE(refund_amount_cents, amount_cents)
          ELSE 0
        END
      ), 0) AS net_cents,

  count(*) FILTER (WHERE status IN ('completed', 'refunded')) AS payment_count
FROM event_payments
GROUP BY 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_revenue_day ON mv_daily_revenue(day);

-- SECURITY DEFINER so the service_role can trigger a refresh even though it does
-- not own the view (REFRESH MATERIALIZED VIEW requires ownership).
CREATE OR REPLACE FUNCTION refresh_daily_revenue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_revenue;
EXCEPTION WHEN OTHERS THEN
  -- CONCURRENTLY requires a prior populate; fall back on first run.
  REFRESH MATERIALIZED VIEW mv_daily_revenue;
END;
$$;

COMMIT;
