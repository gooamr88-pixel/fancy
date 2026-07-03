-- ════════════════════════════════════════════════════════════════════════
-- Admin revenue reporting consistency fix (Master Plan money-audit pass)
-- ────────────────────────────────────────────────────────────────────────
-- Two real defects found in how admin dashboards report revenue:
--
--   1) get_executive_overview()'s 'revenue' block only counted
--      status='completed' in grossCents, excluding status='refunded' rows
--      entirely — the exact gross-revenue bug that 20260703000000_finance_
--      rollup_fix.sql already diagnosed and fixed in mv_daily_revenue (a
--      fully-refunded payment WAS collected, so it belongs in gross; the
--      refund is a separate line), but that fix was never applied here. The
--      "Overview" and "Finance" admin dashboards could show different gross
--      revenue for the same period whenever a refund existed.
--
--   2) SMS credit purchases NEVER touch event_payments — they're recorded
--      only in sms_credit_ledger, which has no amount_cents column at all.
--      That revenue stream was therefore invisible in BOTH mv_daily_revenue
--      and get_executive_overview. This adds amount_cents to the ledger
--      (populated going forward — pre-migration rows stay NULL/0, a known
--      limitation of not having captured it originally) and folds SMS
--      purchase revenue into both revenue surfaces.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.sms_credit_ledger ADD COLUMN IF NOT EXISTS amount_cents INTEGER;

-- record_sms_purchase gains a trailing p_amount_cents (signature change — drop
-- the old 3-arg overload first, same convention used elsewhere in this repo).
DROP FUNCTION IF EXISTS public.record_sms_purchase(UUID, INTEGER, TEXT);

CREATE FUNCTION public.record_sms_purchase(
  p_event_id        UUID,
  p_credits         INTEGER,
  p_payment_intent  TEXT,
  p_amount_cents    INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDITS');
  END IF;

  INSERT INTO sms_credit_wallets (event_id, credits_purchased, credits_used)
  VALUES (p_event_id, 0, 0)
  ON CONFLICT (event_id) DO NOTHING;

  SELECT id INTO v_wallet_id FROM sms_credit_wallets WHERE event_id = p_event_id;
  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'WALLET_NOT_FOUND');
  END IF;

  BEGIN
    INSERT INTO sms_credit_ledger (wallet_id, event_id, transaction_type, credits, stripe_payment_intent_id, amount_cents)
    VALUES (v_wallet_id, p_event_id, 'purchase', p_credits, p_payment_intent, p_amount_cents);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END;

  UPDATE sms_credit_wallets
  SET credits_purchased = credits_purchased + p_credits,
      updated_at = now()
  WHERE id = v_wallet_id;

  RETURN jsonb_build_object('success', true, 'already_processed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.record_sms_purchase(UUID, INTEGER, TEXT, INTEGER) FROM anon, authenticated;

-- ─── mv_daily_revenue: fold in SMS purchase revenue alongside event fees ───

DROP MATERIALIZED VIEW IF EXISTS mv_daily_revenue;

CREATE MATERIALIZED VIEW mv_daily_revenue AS
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_revenue_day ON mv_daily_revenue(day);

-- ─── get_executive_overview: same gross/refunded fix + fold in SMS revenue ───

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
        'total',            (SELECT count(*) FROM rsvp_parties),
        'attendingParties', (SELECT count(*) FROM rsvp_parties WHERE response = 'yes'),
        'attendingGuests',  (SELECT COALESCE(count(*), 0) FROM guests g JOIN rsvp_parties p ON p.id = g.party_id WHERE p.response = 'yes'),
        'declined',         (SELECT count(*) FROM rsvp_parties WHERE response = 'no'),
        'pending',          (SELECT count(*) FROM rsvp_parties WHERE response NOT IN ('yes', 'no'))
      )
    ),
    'checkIns', (SELECT count(*) FROM check_ins),
    'revenue', jsonb_build_object(
      -- Gross now counts money actually collected (completed OR refunded event
      -- fees, PLUS SMS credit purchases) — matches mv_daily_revenue so the
      -- Overview and Finance dashboards agree.
      'grossCents', (
        (SELECT COALESCE(sum(amount_cents), 0) FROM event_payments WHERE status IN ('completed', 'refunded'))
        + (SELECT COALESCE(sum(amount_cents), 0) FROM sms_credit_ledger WHERE transaction_type = 'purchase')
      ),
      'pendingCents', (SELECT COALESCE(sum(amount_cents), 0) FROM event_payments WHERE status = 'pending'),
      'refundedCents', (
        SELECT COALESCE(sum(
          CASE
            WHEN refunded_at IS NOT NULL THEN COALESCE(refund_amount_cents, 0)
            WHEN status = 'refunded'     THEN COALESCE(refund_amount_cents, amount_cents)
            ELSE 0
          END
        ), 0)
        FROM event_payments
      ),
      'byMonth', (
        SELECT COALESCE(jsonb_object_agg(m, cents), '{}'::jsonb)
        FROM (
          SELECT to_char(month, 'YYYY-MM') AS m, sum(cents) AS cents
          FROM (
            SELECT date_trunc('month', COALESCE(completed_at, created_at)) AS month, amount_cents AS cents
            FROM event_payments
            WHERE status IN ('completed', 'refunded')
              AND COALESCE(completed_at, created_at) >= (now() - interval '12 months')
            UNION ALL
            SELECT date_trunc('month', created_at) AS month, COALESCE(amount_cents, 0) AS cents
            FROM sms_credit_ledger
            WHERE transaction_type = 'purchase'
              AND created_at >= (now() - interval '12 months')
          ) monthly
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

COMMIT;
