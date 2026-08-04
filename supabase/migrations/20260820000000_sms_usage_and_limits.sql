-- ─── SMS USAGE VISIBILITY, EARLY WARNINGS, AND ABUSE LIMITS ──────────────────
--
-- Three gaps this closes, all of which are invisible in the current schema.
--
-- 1. THERE IS NO P&L. sms_credit_ledger records what an organizer PAID
--    (amount_cents on purchase rows) but never what the carrier charged US. So
--    "is text messaging actually profitable?" cannot be answered from data —
--    only estimated by multiplying today's rate by historic volume, which is
--    wrong the moment the rate changes. cost_cents records the real cost at the
--    moment of each send.
--
-- 2. RUNNING OUT IS ONLY VISIBLE AFTER IT HAPPENS. The organizer finds out when
--    guests stop receiving texts. The notification stamps below let the platform
--    warn once while there is still time to act, and once when it is empty,
--    without re-sending the same email on every subsequent failed message.
--
-- 3. A NEW ACCOUNT CAN BLAST ITS ENTIRE BALANCE IN ONE REQUEST. There is no
--    ramp-up, so the first thing a fraudulent signup can do is exactly the thing
--    we would least like them to do. sms_delivered_total is the trust signal the
--    per-send cap reads: it rises with genuine use, so a real organizer's limit
--    lifts itself while a throwaway account's never does.

/* ── 1. Real carrier cost, per send ───────────────────────────────────────── */

-- NUMERIC, not INTEGER: a single message can cost a fraction of a cent, and
-- rounding each row to a whole cent would drift by more than the profit on a
-- large campaign.
ALTER TABLE public.sms_credit_ledger
  ADD COLUMN IF NOT EXISTS cost_cents NUMERIC;

COMMENT ON COLUMN public.sms_credit_ledger.cost_cents IS
  'What the carrier charged US for this send, captured at send time from the rate then in force. Consumption rows only. Paired with amount_cents on purchase rows, this is what makes SMS profit measurable rather than estimated.';

-- Analytics scans consumption rows by date; without this it is a seq scan over
-- every message ever sent.
CREATE INDEX IF NOT EXISTS idx_sms_credit_ledger_consumption_date
  ON public.sms_credit_ledger (created_at DESC)
  WHERE transaction_type = 'consumption';

/* ── 2. Usage state on the wallet ─────────────────────────────────────────── */

ALTER TABLE public.sms_credit_wallets
  ADD COLUMN IF NOT EXISTS last_used_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS low_balance_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS empty_notified_at       TIMESTAMPTZ;

COMMENT ON COLUMN public.sms_credit_wallets.last_used_at IS
  'When a message was last sent for this event. Powers "last message sent 2 hours ago" without scanning the ledger.';
COMMENT ON COLUMN public.sms_credit_wallets.low_balance_notified_at IS
  'Set when the "running low" email was sent. Its presence is what stops that email repeating on every subsequent send. Cleared on top-up so the next depletion warns again.';
COMMENT ON COLUMN public.sms_credit_wallets.empty_notified_at IS
  'Set when the "ran out" email was sent. Same one-shot contract as low_balance_notified_at.';

/* ── 3. The trust signal behind the per-send cap ───────────────────────────── */

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS sms_delivered_total INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.organizations.sms_delivered_total IS
  'Lifetime messages successfully delivered by this organization, across all its events. Read by the ramp-up limit (config/smsPricing.js → limits.ramp_up): the per-send cap rises as this grows, so a genuine organizer''s limit lifts itself through ordinary use while a throwaway account''s never does. Monotonic — never decremented, including on refund, because a refunded message was still dispatched and the counter measures behaviour, not billing.';

-- Existing organizations start at their real historical figure rather than zero,
-- so a long-standing customer is not suddenly capped at the newcomer limit the
-- moment this ships.
UPDATE public.organizations o
SET sms_delivered_total = COALESCE(sub.total, 0)
FROM (
  SELECT e.org_id, COUNT(*)::int AS total
  FROM public.sms_credit_ledger l
  JOIN public.events e ON e.id = l.event_id
  WHERE l.transaction_type = 'consumption'
  GROUP BY e.org_id
) sub
WHERE sub.org_id = o.id
  AND o.sms_delivered_total = 0;

/* ── 4. Atomic delivered-counter increment ────────────────────────────────── */

-- A read-modify-write from the app would lose increments whenever two messages
-- for the same organization complete at once — which is the normal case during a
-- campaign, i.e. exactly when the counter moves fastest.
--
-- Takes a COUNT because the app batches: writing one row per delivered message
-- would cost a query per message on a 20,000-recipient campaign, to maintain a
-- counter whose only consumer is a cap that steps at 200 and 1,000.
CREATE OR REPLACE FUNCTION public.increment_sms_delivered(
    p_org_id UUID,
    p_count  INTEGER DEFAULT 1
) RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE organizations
  SET sms_delivered_total = COALESCE(sms_delivered_total, 0) + GREATEST(COALESCE(p_count, 1), 0)
  WHERE id = p_org_id;
$$;

REVOKE ALL ON FUNCTION public.increment_sms_delivered(UUID, INTEGER) FROM anon, authenticated;

/* ── 5. Re-arm the balance warnings on top-up ─────────────────────────────── */

-- Without this, an organizer who is warned once, tops up, and later runs low
-- again is never warned a second time — the stamp is still set from the first
-- occasion. Clearing it on purchase makes the warning a per-depletion event
-- rather than a once-per-lifetime one.
CREATE OR REPLACE FUNCTION public.reset_sms_balance_alerts(p_event_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE sms_credit_wallets
  SET low_balance_notified_at = NULL,
      empty_notified_at       = NULL
  WHERE event_id = p_event_id;
$$;

REVOKE ALL ON FUNCTION public.reset_sms_balance_alerts(UUID) FROM anon, authenticated;

/* ── 6. Admin analytics, in one round trip ────────────────────────────────── */

-- Mirrors get_executive_overview: a single SECURITY DEFINER function returning
-- one jsonb document, rather than the dashboard issuing six aggregate queries.
CREATE OR REPLACE FUNCTION public.sms_admin_analytics(
    p_from TIMESTAMPTZ DEFAULT NULL,
    p_to   TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH bounds AS (
    SELECT COALESCE(p_from, now() - INTERVAL '90 days') AS lo,
           COALESCE(p_to,   now())                      AS hi
  ),
  purchases AS (
    SELECT COALESCE(SUM(l.amount_cents), 0)::bigint AS revenue_cents,
           COALESCE(SUM(l.credits), 0)::bigint      AS messages_bought
    FROM sms_credit_ledger l, bounds b
    WHERE l.transaction_type = 'purchase'
      AND l.created_at BETWEEN b.lo AND b.hi
  ),
  consumption AS (
    -- credits are stored NEGATIVE on consumption rows; ABS makes the count read
    -- as "messages sent" rather than a negative quantity.
    SELECT COALESCE(SUM(ABS(l.credits)), 0)::bigint AS messages_sent,
           COALESCE(SUM(l.cost_cents), 0)::numeric  AS cost_cents
    FROM sms_credit_ledger l, bounds b
    WHERE l.transaction_type = 'consumption'
      AND l.created_at BETWEEN b.lo AND b.hi
  ),
  per_event AS (
    SELECT l.event_id,
           COALESCE(e.title, 'Untitled event')      AS title,
           SUM(ABS(l.credits))::bigint              AS messages_sent,
           COALESCE(SUM(l.cost_cents), 0)::numeric  AS cost_cents
    FROM sms_credit_ledger l
    LEFT JOIN events e ON e.id = l.event_id
    CROSS JOIN bounds b
    WHERE l.transaction_type = 'consumption'
      AND l.created_at BETWEEN b.lo AND b.hi
    GROUP BY l.event_id, e.title
  )
  SELECT jsonb_build_object(
    'from',            (SELECT lo FROM bounds),
    'to',              (SELECT hi FROM bounds),
    'revenueCents',    (SELECT revenue_cents   FROM purchases),
    'messagesBought',  (SELECT messages_bought FROM purchases),
    'messagesSent',    (SELECT messages_sent   FROM consumption),
    -- Rounded only here, at the end: summing already-rounded per-message costs
    -- would drift by more than the margin on a large campaign.
    'costCents',       ROUND((SELECT cost_cents FROM consumption)),
    'profitCents',     (SELECT revenue_cents FROM purchases) - ROUND((SELECT cost_cents FROM consumption)),
    'eventsWithSends', (SELECT COUNT(*) FROM per_event),
    'avgMessagesPerEvent',
      COALESCE(ROUND((SELECT AVG(messages_sent) FROM per_event), 1), 0),
    'avgRevenuePerEventCents',
      CASE WHEN (SELECT COUNT(*) FROM per_event) > 0
           THEN ROUND((SELECT revenue_cents FROM purchases)::numeric / (SELECT COUNT(*) FROM per_event))
           ELSE 0 END,
    'topEvents', COALESCE((
      SELECT jsonb_agg(x ORDER BY x.messages_sent DESC)
      FROM (
        SELECT event_id, title, messages_sent, ROUND(cost_cents) AS cost_cents
        FROM per_event
        ORDER BY messages_sent DESC
        LIMIT 10
      ) x
    ), '[]'::jsonb)
  );
$$;

-- Server-side only (invoked by the admin API with the service role).
REVOKE ALL ON FUNCTION public.sms_admin_analytics(TIMESTAMPTZ, TIMESTAMPTZ) FROM anon, authenticated;
