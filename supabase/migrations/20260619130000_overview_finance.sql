-- ════════════════════════════════════════════════════════════════════════
-- EXECUTIVE OVERVIEW RPC + DAILY REVENUE ROLLUP
-- (Master Plan §1 / §22 / §1.12 — fixes B2)
-- ────────────────────────────────────────────────────────────────────────
-- getPlatformOverview previously pulled EVERY event, rsvp, payment and wallet
-- row into Node and aggregated in JS (B2). This computes the same snapshot in a
-- single set-based query inside Postgres, plus a materialized daily-revenue
-- rollup powering the Financial Command Center (§22).
--
-- Ordered after 20260619120000_payment_refunds so refund_amount_cents exists.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Executive overview snapshot (single round trip) ───
CREATE OR REPLACE FUNCTION get_executive_overview()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'events', (
      SELECT jsonb_build_object(
        'total',  count(*),
        'paid',   count(*) FILTER (WHERE is_paid),
        'unpaid', count(*) FILTER (WHERE NOT is_paid),
        'byStatus', jsonb_build_object(
          'draft',          count(*) FILTER (WHERE status = 'draft'),
          'pending_review', count(*) FILTER (WHERE status = 'pending_review'),
          'active',         count(*) FILTER (WHERE status = 'active'),
          'paused',         count(*) FILTER (WHERE status = 'paused'),
          'completed',      count(*) FILTER (WHERE status = 'completed')
        )
      ) FROM events
    ),
    'organizations', (SELECT count(*) FROM organizations),
    'rsvps', (
      SELECT jsonb_build_object(
        'total',            count(*),
        'attendingParties', count(*) FILTER (WHERE response = 'yes'),
        'attendingGuests',  COALESCE(sum(party_size) FILTER (WHERE response = 'yes'), 0),
        'declined',         count(*) FILTER (WHERE response = 'no'),
        'pending',          count(*) FILTER (WHERE response NOT IN ('yes', 'no'))
      ) FROM rsvps
    ),
    'checkIns', (SELECT count(*) FROM check_ins),
    'revenue', jsonb_build_object(
      'grossCents',    (SELECT COALESCE(sum(amount_cents), 0) FROM event_payments WHERE status = 'completed'),
      'pendingCents',  (SELECT COALESCE(sum(amount_cents), 0) FROM event_payments WHERE status = 'pending'),
      'refundedCents', (SELECT COALESCE(sum(amount_cents), 0) FROM event_payments WHERE status = 'refunded'),
      'byMonth', (
        SELECT COALESCE(jsonb_object_agg(m, cents), '{}'::jsonb)
        FROM (
          SELECT to_char(date_trunc('month', COALESCE(completed_at, created_at)), 'YYYY-MM') AS m,
                 sum(amount_cents) AS cents
          FROM event_payments
          WHERE status = 'completed'
            AND COALESCE(completed_at, created_at) >= (now() - interval '12 months')
          GROUP BY 1
        ) t
      )
    ),
    'sms', (
      SELECT jsonb_build_object(
        'purchased', COALESCE(sum(credits_purchased), 0),
        'used',      COALESCE(sum(credits_used), 0),
        'remaining', COALESCE(sum(credits_purchased), 0) - COALESCE(sum(credits_used), 0)
      ) FROM sms_credit_wallets
    ),
    'recentActivity', (
      SELECT COALESCE(jsonb_agg(a ORDER BY a."createdAt" DESC), '[]'::jsonb)
      FROM (
        SELECT al.id,
               al.action,
               al.entity_type AS "entityType",
               al.created_at  AS "createdAt",
               e.title        AS "eventTitle"
        FROM activity_logs al
        LEFT JOIN events e ON e.id = al.event_id
        ORDER BY al.created_at DESC
        LIMIT 12
      ) a
    )
  );
$$;

-- ─── Daily revenue rollup (Financial Command Center §22) ───
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_revenue AS
SELECT
  date_trunc('day', COALESCE(completed_at, created_at))::date AS day,
  COALESCE(sum(amount_cents) FILTER (WHERE status = 'completed'), 0)               AS gross_cents,
  COALESCE(sum(refund_amount_cents) FILTER (WHERE refunded_at IS NOT NULL), 0)     AS refunded_cents,
  COALESCE(sum(amount_cents) FILTER (WHERE status = 'completed'), 0)
    - COALESCE(sum(refund_amount_cents) FILTER (WHERE refunded_at IS NOT NULL), 0) AS net_cents,
  count(*) FILTER (WHERE status = 'completed')                                     AS payment_count
FROM event_payments
GROUP BY 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_revenue_day ON mv_daily_revenue(day);

-- Concurrent refresh helper (callable from the analytics rollup job, F5).
CREATE OR REPLACE FUNCTION refresh_daily_revenue()
RETURNS void
LANGUAGE plpgsql
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
