-- ==========================================================================
-- THE WHOLE SMS MIGRATION CHAIN, IN ORDER, AS ONE SCRIPT
--
-- Generated from the six migration files verbatim - not retyped. Paste the
-- whole thing into the Supabase SQL Editor and run it once.
--
-- SAFE TO RUN WHEN SOME ARE ALREADY APPLIED. Every statement in the chain was
-- checked for this: tables are CREATE TABLE IF NOT EXISTS, columns are ADD
-- COLUMN IF NOT EXISTS, indexes are IF NOT EXISTS, functions are CREATE OR
-- REPLACE, both policies are preceded by DROP POLICY IF EXISTS, and every data
-- UPDATE is guarded on the state it is changing.
--
-- ONE TRANSACTION on purpose. Half an applied chain is the worst outcome here:
-- the backend reads columns from step 1 and rows written by step 6, so a
-- failure partway leaves the API live against a schema it does not expect. If
-- anything raises, EVERYTHING rolls back and you are exactly where you started.
--
-- ORDER IS LOAD-BEARING. Step 6 writes to the column step 1 creates, and step 5
-- reads the keys step 1 seeds. Do not reorder or run pieces separately.
-- ==========================================================================

BEGIN;

-- ==========================================================================
-- STEP 1 of 6  ·  20260818000000_sms_addon.sql
-- ==========================================================================

-- ─── SMS AS A PAID ADD-ON, AND A LIFECYCLE CHANNEL ───────────────────────────
--
-- Two changes that belong together.
--
-- 1. SMS STOPS BEING A TIER FEATURE AND BECOMES A PURCHASE.
--    Until now the ability to send was gated on the pricing tier
--    (`sms_campaigns` in the feature registry) while the message allowance was
--    bought separately, later, from a page most organizers never reached. That
--    split meant a paying customer on the right tier could still have no way to
--    send, and a customer who wanted only SMS had to buy a tier for it.
--
--    `sms_addon_purchased_at` replaces the tier check outright: any tier may buy
--    the add-on at event checkout, and buying it unlocks every SMS capability.
--    The message allowance itself continues to live in sms_credit_wallets —
--    which already provides atomic debiting, idempotency, refund-on-failure and
--    delivery reconciliation. Rebuilding that would be risk without reward.
--
-- 2. SMS BECOMES SEVEN MESSAGE TYPES, NOT ONE.
--    The only outbound SMS was a campaign the organizer typed by hand. Every
--    automated moment in an event's life — RSVP confirmation, reminders, entry
--    pass, organizer report — was email-only, even though the consent sentence
--    guests agree to explicitly promises them by text.
--
--    `sms_settings` gives the organizer a switch per type, so the allowance can
--    be spent where it matters to them. `sms_log` gives every automated send the
--    same (kind, ref) idempotency and audit trail that email_log has given email
--    since the lifecycle scheduler was written.

/* ── 1. Add-on state on the event ─────────────────────────────────────────── */

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS sms_addon_purchased_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_settings JSONB NOT NULL DEFAULT '{
    "rsvp_confirmation": true,
    "rsvp_reminder": true,
    "event_reminder": true,
    "qr_ticket": true,
    "decline_ack": false,
    "organizer_report": true,
    "campaign": true
  }'::jsonb;

COMMENT ON COLUMN events.sms_addon_purchased_at IS
  'When the SMS add-on was paid for. NULL = never purchased; every SMS capability is gated on this being set (middleware/smsAddonGate.js). Independent of pricing tier by design.';
COMMENT ON COLUMN events.sms_settings IS
  'Per-message-type switches, keyed by backend/config/smsMessageTypes.js. A disabled type falls back to its email equivalent rather than being dropped. decline_ack defaults OFF: acknowledging a decline by text is the one type that reliably reads as unwanted.';

-- Events that already bought credits under the old model keep everything: their
-- wallet balance is untouched and the add-on is treated as already purchased, so
-- nothing they paid for stops working the moment this migration lands.
UPDATE events e
SET sms_addon_purchased_at = COALESCE(e.sms_addon_purchased_at, w.created_at, now())
FROM sms_credit_wallets w
WHERE w.event_id = e.id
  AND e.sms_addon_purchased_at IS NULL;

/* ── 2. Per-send log: idempotency + "why didn't it arrive?" ───────────────── */

-- Deliberately mirrors email_log's (kind, ref) contract so the lifecycle
-- scheduler can treat both channels identically, and so a re-run of a job can
-- never double-charge a wallet for the same logical message.
CREATE TABLE IF NOT EXISTS sms_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         TEXT NOT NULL,          -- a key from smsMessageTypes.js
  ref          TEXT,                   -- 'rsvp:<partyId>' | 'event:<eventId>'
  recipient    TEXT,                   -- E.164 as dispatched
  event_id     UUID REFERENCES events(id) ON DELETE SET NULL,
  party_id     UUID,
  segments     INTEGER,
  credits      INTEGER,                -- charged; 0 for a skip
  ledger_id    UUID,                   -- sms_credit_ledger row, when billed
  sms_sid      TEXT,
  status       TEXT NOT NULL,          -- sent | failed | skipped
  skip_reason  TEXT,                   -- ADDON_INACTIVE | TYPE_DISABLED | NO_CONSENT
                                       -- | OPTED_OUT | NO_ALLOWANCE | NO_PHONE
                                       -- | SMS_TRANSPORT_DISABLED | DUPLICATE
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sms_log IS
  'One row per automated SMS attempt, including the ones that were skipped. The skip reason is the point: without it a half-delivered lifecycle is unexplainable, and "why did my guest not get a reminder?" has no answer.';
COMMENT ON COLUMN sms_log.skip_reason IS
  'Why no message was sent. Distinguishes a compliance block (NO_CONSENT / OPTED_OUT) from an organizer choice (TYPE_DISABLED) from a billing state (NO_ALLOWANCE) from a misconfiguration (SMS_TRANSPORT_DISABLED).';

-- The idempotency contract. Partial (ref IS NOT NULL) so ad-hoc sends without a
-- natural key are still loggable without colliding.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_log_kind_ref
  ON sms_log (kind, ref) WHERE ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_log_event   ON sms_log (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_log_party   ON sms_log (party_id);
CREATE INDEX IF NOT EXISTS idx_sms_log_skipped ON sms_log (event_id, skip_reason)
  WHERE skip_reason IS NOT NULL;

-- Service-role only: RLS enabled with no policies, matching sms_opt_outs and
-- sms_consent_log.
ALTER TABLE sms_log ENABLE ROW LEVEL SECURITY;

/* ── 3. The organizer's own consent ───────────────────────────────────────── */

-- The organizer_report type texts the ORGANIZER, not a guest. That is a different
-- relationship — they are our customer and gave us the number themselves — but it
-- is not a licence to text them unasked. They get their own explicit opt-in,
-- their own dated record, and the same global STOP suppression as everyone else.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sms_consent    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_phone      TEXT;

COMMENT ON COLUMN organizations.sms_consent IS
  'Whether this organizer opted in to receive operational texts about their own events (reports, alerts). Separate from every guest consent record; a STOP reply still suppresses the number globally via sms_opt_outs.';
COMMENT ON COLUMN organizations.sms_phone IS
  'E.164 number for organizer-directed SMS. Kept distinct from any billing/contact phone so opting in to texts never silently repurposes a number given for another reason.';

/* ── 4. Consent-log vocabulary ────────────────────────────────────────────── */

-- sms_consent_log.method gained a third value alongside guest_optin/host_attested.
--
-- Guarded, because this is DOCUMENTATION and documentation must never be able to
-- fail a migration. sms_consent_log is created by 20260811010000 and gains
-- `method` in 20260812010000; on a database where those have not been applied,
-- an unguarded COMMENT aborts this entire migration — taking the add-on columns,
-- sms_log and the organizer-consent columns down with it, none of which depend on
-- that table at all. A comment is worth exactly zero of that.
--
-- The apply order remains 20260811010000 → 20260812010000 → this file. The guard
-- only means running them out of order costs a comment, not the migration.
DO $outer$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sms_consent_log' AND column_name = 'method'
  ) THEN
    -- Nested dollar-quoting rather than doubled apostrophes: the text contains
    -- "party's", and an escaping slip in a statement whose only job is to carry a
    -- comment would fail the migration for the very reason this guard exists.
    COMMENT ON COLUMN public.sms_consent_log.method IS
      $c$guest_optin (the guest ticked our box) | host_attested (an organizer attested on their behalf) | system_revoked (the platform withdrew consent because what it rested on changed — today: the party's phone number was edited, so the recorded consent no longer belongs to the number we would now text).$c$;
  ELSE
    RAISE NOTICE 'sms_consent_log.method not present — skipping its comment. Apply 20260811010000_sms_consent_log.sql then 20260812010000_host_sms_consent_attestation.sql to create the SMS consent audit trail.';
  END IF;
END $outer$;

-- ==========================================================================
-- STEP 2 of 6  ·  20260819000000_sms_pricing_config.sql
-- ==========================================================================

-- ─── SUPER-ADMIN CONTROL OVER SMS PRICING ────────────────────────────────────
--
-- Until now only two SMS numbers were admin-editable — the base rate and the
-- markup. Everything else that determines what an organizer is quoted and what
-- Fancy earns was a constant compiled into the code:
--
--   • the volume discount (a single hard-coded tier: 12.5% off at 500+)
--   • the purchase floor, ceiling and step (50 / 50,000 / 50)
--   • every assumption in the allowance estimator — guests per party, average
--     segments per message in Latin and Arabic, the size assumed for unlimited
--     plans
--   • how many messages of each type an average party receives, which is what
--     the recommended bundle is actually built from
--
-- That meant changing a price required a deploy, and the recommendation shown to
-- customers could not be tuned against real usage at all. This column makes the
-- whole pricing model editable from the super-admin dashboard.
--
-- ── Why one jsonb column instead of a dozen scalars ──
-- These values are one cohesive model that is read together, written together,
-- and will grow (a third discount tier, a new message type). A column per knob
-- would mean a migration per pricing experiment. The trade-off — no per-field
-- database constraints — is covered by backend/config/smsPricing.js, which
-- normalizes and clamps every field on read AND on write, so a malformed or
-- partial object can never reach Stripe.
--
-- ── The defaults are not a new pricing decision ──
-- Every value below reproduces exactly what the code did before this migration.
-- Applying it changes no customer's price by a single cent; it only moves the
-- numbers from source control into the dashboard.
--
-- sms_rate_cents_per_credit and sms_markup_percentage deliberately stay as their
-- own columns: they are the two headline figures, they are referenced directly
-- across the payment and campaign controllers, and folding them in here would be
-- churn without benefit.

ALTER TABLE public.super_admin_config
  ADD COLUMN IF NOT EXISTS sms_pricing_config JSONB NOT NULL DEFAULT '{
    "volume_discounts": [
      { "min_segments": 500, "discount_pct": 12.5 }
    ],
    "bounds": {
      "min": 50,
      "max": 50000,
      "step": 50
    },
    "estimator": {
      "guests_per_party": 2.2,
      "segments_per_message_latin": 1.4,
      "segments_per_message_arabic": 2.6,
      "unlimited_tier_assumed_guests": 500
    },
    "type_frequencies": {
      "rsvp_confirmation": 1,
      "rsvp_reminder": 0.6,
      "event_reminder": 0.7,
      "qr_ticket": 0.7,
      "decline_ack": 0.2,
      "organizer_report": 3,
      "campaign": 2
    },
    "limits": {
      "ramp_up": [
        { "delivered_min": 0,    "max_per_send": 50 },
        { "delivered_min": 200,  "max_per_send": 500 },
        { "delivered_min": 1000, "max_per_send": 0 }
      ]
    },
    "alerts": {
      "low_balance_pct": 20
    }
  }'::jsonb;

COMMENT ON COLUMN public.super_admin_config.sms_pricing_config IS
  'Admin-editable SMS pricing model. volume_discounts: tiered discounts, best matching tier wins (not cumulative). bounds: min/max/step for a single purchase. estimator: the assumptions behind the recommended allowance shown at checkout. type_frequencies: messages per party for each message type (per EVENT for organizer_report). Normalized and clamped by backend/config/smsPricing.js on every read and write — see that file before changing this shape.';

-- The singleton row predates this column, so DEFAULT alone would not populate it.
UPDATE public.super_admin_config
SET sms_pricing_config = DEFAULT
WHERE sms_pricing_config IS NULL
   OR sms_pricing_config = '{}'::jsonb;

-- ==========================================================================
-- STEP 3 of 6  ·  20260820000000_sms_usage_and_limits.sql
-- ==========================================================================

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

-- ==========================================================================
-- STEP 4 of 6  ·  20260821000000_sms_organizer_optin_and_perf.sql
-- ==========================================================================

-- ─── ORGANIZER OPT-IN, GUEST LANGUAGE, AND A GROUPED SKIP COUNT ──────────────
--
-- Three fixes found reviewing the finished SMS subsystem.
--
-- 1. organizer_report COULD NEVER SEND. resolveRecipient gates organizer-audience
--    messages on organizations.sms_consent and reads the number from
--    organizations.sms_phone. Both columns existed (20260818000000) and both were
--    only ever READ — nothing in the codebase wrote either one. So the flag was
--    permanently false and every organizer report skipped with NO_CONSENT, while
--    the type was switched ON by default, shown as a toggle, and billed at three
--    messages per event in the purchase estimate. Customers were being charged
--    for capacity that could not be used.
--
--    The columns are fine; what was missing was a way to set them. That arrives
--    with this migration's endpoint (controllers/campaignController.js). Added
--    here: the provenance columns that make an organizer's opt-in as auditable as
--    a guest's, since a text to an organizer is subject to the same rules.
--
-- 2. SCHEDULED REMINDERS WERE ALWAYS ENGLISH. A guest picks their language on the
--    RSVP page and it was never stored, so the lifecycle scheduler had nothing to
--    read and hardcoded 'en'. An Arabic guest received their confirmation in
--    Arabic (the controller has the value in hand) and then their reminder in
--    English. preferred_lang closes that gap.
--
-- 3. THE MESSAGES PAGE READ UP TO 5,000 ROWS TO SHOW SIX NUMBERS. The skip
--    summary pulled every skipped sms_log row and tallied it in JavaScript on
--    every page load. That is a GROUP BY, and it belongs in the database.

/* ── 1. Make the organizer's own opt-in auditable ─────────────────────────── */

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS sms_consent_text_version TEXT,
  ADD COLUMN IF NOT EXISTS sms_consent_ip           TEXT;

COMMENT ON COLUMN public.organizations.sms_consent_text_version IS
  'Which version of the canonical consent wording the organizer was shown when they opted in (frontend SmsConsentText.js). Same record-keeping standard as a guest opt-in: being our customer is not a reason to hold weaker evidence.';
COMMENT ON COLUMN public.organizations.sms_consent_ip IS
  'Capture context for the organizer opt-in, matching the convention used by sms_optin_submissions.';

/* ── 2. Remember the language a guest actually chose ──────────────────────── */

ALTER TABLE public.rsvp_parties
  ADD COLUMN IF NOT EXISTS preferred_lang TEXT;

COMMENT ON COLUMN public.rsvp_parties.preferred_lang IS
  'The language the guest used on the RSVP form (''en'' | ''ar''). Captured so SCHEDULED messages — reminders sent days later, by a job with no request context — reach them in the same language their confirmation did. NULL means never recorded; callers fall back to English.';

/* ── 3. Let a bank transfer buy messages too ──────────────────────────────── */

-- The SMS add-on was card-only. On the manual path the card was hidden, so an
-- organizer paying by bank transfer — the ONLY path available while card payments
-- are switched off — simply could not buy text messaging at all, and the amount
-- they were told to transfer covered the licence alone.
--
-- Recorded on the payment itself rather than on the event: a manual payment is
-- approved by a human later, and the approval has to know what the transfer was
-- actually FOR. Without it the messages would either never be credited or be
-- credited from a number nobody verified.
ALTER TABLE public.event_payments
  ADD COLUMN IF NOT EXISTS sms_addon_segments INTEGER;

COMMENT ON COLUMN public.event_payments.sms_addon_segments IS
  'Messages bought alongside the licence on this payment, credited when a Super Admin approves it. NULL = licence only. amount_cents already includes their price, so the approver verifies one figure.';

/* ── 4. Count skips in the database, not in Node ──────────────────────────── */

-- Returns { "<skip_reason>": <count>, ... } for one event.
--
-- STABLE and SECURITY DEFINER to match the other read RPCs. Event scoping is the
-- caller's responsibility exactly as it is for get_event_parties: the route is
-- already behind requireAuth + verifyEventOwner.
CREATE OR REPLACE FUNCTION public.sms_skip_summary(p_event_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    jsonb_object_agg(reason, n),
    '{}'::jsonb
  )
  FROM (
    SELECT skip_reason AS reason, COUNT(*)::int AS n
    FROM sms_log
    WHERE event_id = p_event_id
      AND skip_reason IS NOT NULL
    GROUP BY skip_reason
  ) s;
$$;

REVOKE ALL ON FUNCTION public.sms_skip_summary(UUID) FROM anon, authenticated;

-- The index the aggregate above rides on already exists from 20260820000000
-- (idx_sms_log_skipped on (event_id, skip_reason) WHERE skip_reason IS NOT NULL),
-- which turns this from a scan into an index-only aggregate.

-- ==========================================================================
-- STEP 5 of 6  ·  20260822000000_sms_rebuild.sql
-- ==========================================================================

-- ─── SMS REBUILD: SEVEN MESSAGE TYPES DOWN TO FOUR, AND A COST THAT IS REAL ───
--
-- The SMS subsystem worked, but nobody could hold it in their head. Seven message
-- types, a free-text campaign composer with audience segmentation and scheduling,
-- a separate send-invitations modal, and per-guest resend buttons all overlapped,
-- and the organizer — frequently an older, non-technical person planning one
-- wedding — could not tell what would be sent, to whom, or what it would cost.
--
-- This migration lands the database half of the rebuild. Four things change.
--
-- 1. THE COST FIGURE WAS WRONG BY ROUGHLY NINE TIMES, AND SILENTLY SO.
--    super_admin_config.sms_rate_cents_per_credit is INTEGER, defaulting to 8.
--    The real all-in carrier cost is 1.1 cents per segment (Vonage US outbound
--    $0.00809 plus roughly $0.002-0.003 of carrier pass-through fees). The admin
--    form has always OFFERED fractional input — step="0.1", parseFloat on save —
--    so an admin typing the true 1.1 had it rounded to 1 by the column on the way
--    in, with no error and no warning. Every margin number on the admin dashboard
--    has therefore been computed against a cost about 9% too low for the entire
--    life of the feature. The column has to hold fractions; nothing else fixes it.
--
-- 2. THE ALLOWANCE ESTIMATE DID NOT SCALE. It multiplied a flat per-type frequency
--    by party count, so a 3,000-guest event was quoted almost exactly ten times a
--    300-guest one. Large events are precisely where SMS has to feel affordable,
--    and precisely where the old model made it look ruinous. guest_bands replaces
--    the flat multiplier with a ladder that falls as the guest list grows.
--
-- 3. SEVEN TYPES BECOME FOUR: invitation, seating_reminder, event_update,
--    organizer_report. See the mapping in section 3 — it is an OR, not an AND,
--    and the comment there explains why that matters.
--
-- 4. THERE WAS NO WAY TO CANCEL AN EVENT. status allowed draft/active/paused/
--    completed, and deleteEvent hard-deleted the row without telling a single
--    guest. An organizer whose venue floods has no honest option today. Section 4
--    adds a real cancelled state so "we have to call it off" is a first-class
--    action that notifies people, instead of a DELETE that does not.
--
-- Balances are NOT touched. Every message an organizer already paid for stays
-- spendable at face value; nobody is re-charged and nobody is re-credited.


/* ── 1. The rate column must be able to hold a fraction of a cent ──────────── */

ALTER TABLE public.super_admin_config
  ALTER COLUMN sms_rate_cents_per_credit TYPE NUMERIC(10,4)
    USING sms_rate_cents_per_credit::numeric,
  ALTER COLUMN sms_rate_cents_per_credit SET DEFAULT 1.1;

COMMENT ON COLUMN public.super_admin_config.sms_rate_cents_per_credit IS
  'What ONE segment costs US, in cents. NUMERIC, not INTEGER: the true figure is 1.1 (Vonage US outbound $0.00809 + ~$0.002-0.003 carrier pass-through), and an integer column silently rounded it to 1 — understating cost, and overstating every margin on the admin dashboard, by about 9%. Multiplied by (1 + sms_markup_percentage/100), then discounted by the best matching volume tier, to produce the price an organizer pays.';

-- Rewrite ONLY the untouched shipped default.
--
-- A deployment where somebody deliberately set a rate keeps whatever they set.
-- Overwriting a hand-chosen price from inside a migration is how a live platform
-- silently starts charging a number nobody agreed to, and it is unrecoverable
-- because the old value is gone. Matching on the old default of exactly 8 is the
-- narrowest possible test for "still factory-configured".
UPDATE public.super_admin_config
   SET sms_rate_cents_per_credit = 1.1,
       -- 1.1 x 2.7273 = 3.00 cents list price, ~63% gross margin on revenue.
       sms_markup_percentage     = 172.73
 WHERE id = '00000000-0000-0000-0000-000000000000'
   AND sms_rate_cents_per_credit = 8;


/* ── 2. The new pricing model ─────────────────────────────────────────────── */

-- Merged with || rather than replaced, so limits.ramp_up (the anti-abuse send
-- ladder) and alerts.low_balance_pct survive untouched. Those two are unrelated
-- to this change and an admin may well have tuned them.
--
-- guest_bands is the new idea. Messages per invitation falls as the guest list
-- grows — 3 for an intimate wedding, 1.5 for a 3,000-person gala — because the
-- marginal value of the third text drops with scale while its cost does not. Run
-- alongside deeper volume discounts, the per-guest price falls about 47% from a
-- 200-guest event to a 3,000-guest one, which is what makes SMS defensible at
-- the top of the range instead of merely expensive.
--
-- type_weights and type_frequencies are deliberately SEPARATE keys with separate
-- meanings, and must stay that way:
--   type_weights     — guest-audience types. RELATIVE shares of the band budget.
--                      Only the ratios matter; scaling all three changes nothing.
--   type_frequencies — organizer-audience types. ABSOLUTE messages per EVENT.
--                      An organizer gets the same few reports whether they invite
--                      20 people or 2,000, so this must never be multiplied by
--                      party count.
-- Overloading one key to mean both is the kind of thing that reads fine today and
-- produces a wrong invoice in two years.
UPDATE public.super_admin_config
   SET sms_pricing_config = COALESCE(sms_pricing_config, '{}'::jsonb) || jsonb_build_object(
     'volume_discounts', jsonb_build_array(
        jsonb_build_object('min_segments', 10000, 'discount_pct', 30),
        jsonb_build_object('min_segments',  5000, 'discount_pct', 25),
        jsonb_build_object('min_segments',  2000, 'discount_pct', 18),
        jsonb_build_object('min_segments',   500, 'discount_pct', 10)
     ),
     'guest_bands', jsonb_build_array(
        jsonb_build_object('max_guests',  300, 'messages_per_party', 3),
        jsonb_build_object('max_guests', 1000, 'messages_per_party', 2.5),
        jsonb_build_object('max_guests', 3000, 'messages_per_party', 2),
        -- max_guests NULL = the open band. There must always be exactly one, last,
        -- or an event above every threshold prices at zero messages.
        jsonb_build_object('max_guests', NULL, 'messages_per_party', 1.5)
     ),
     'type_weights', jsonb_build_object(
        'invitation',       1.0,
        'seating_reminder', 1.2,
        'event_update',     0.3
     ),
     'type_frequencies', jsonb_build_object('organizer_report', 3),
     -- (estimator merge follows)
     -- Merged over whatever estimator block is already there, so guests_per_party
     -- and unlimited_tier_assumed_guests survive if an admin tuned them.
     --
     -- These two numbers were 1.4 and 2.6, and both were WRONG — not stale, wrong
     -- from the day they were written. A GSM-7 segment holds 160 characters, the
     -- mandatory compliance footer is 78 of them, and a link is another 32; there
     -- is no room left for a name and an event title inside one segment. Measured
     -- across a realistic spread of guest names and event titles, not one English
     -- message fits in a single segment.
     --
     -- The consequence was not academic: every allowance this platform ever sold
     -- was quoted about 40% short, so organizers ran out of messages partway
     -- through their own event and were told they had bought enough.
     'estimator', COALESCE(sms_pricing_config->'estimator', '{}'::jsonb) || jsonb_build_object(
        'segments_per_message_latin',  2.0,
        'segments_per_message_arabic', 3.0
     )
   )
 WHERE id = '00000000-0000-0000-0000-000000000000'
   -- RUN ONCE. `guest_bands` exists only after this migration, so its absence is
   -- the marker for "not yet rebuilt".
   --
   -- Without this, re-applying the file — which is entirely plausible here, since
   -- these are routinely pasted into the SQL editor by hand — would overwrite an
   -- admin's tuned discount tiers, ladder and weights with the shipped defaults.
   -- That is the same mistake the rate column above is explicitly guarded against,
   -- and it deserves the same guard.
   AND NOT (COALESCE(sms_pricing_config, '{}'::jsonb) ? 'guest_bands');

COMMENT ON COLUMN public.super_admin_config.sms_pricing_config IS
  'The whole editable SMS pricing model. guest_bands = messages per invitation, laddered down by guest count. type_weights = relative shares of that budget across GUEST message types. type_frequencies = absolute messages per EVENT for ORGANIZER types. volume_discounts = tiered and never cumulative. Interpreted only by backend/config/smsPricing.js, which normalizes and clamps on both read and write.';


/* ── 3. Seven message types become four ───────────────────────────────────── */

-- The mapping is an OR across the three merged types, not an AND.
--
-- rsvp_confirmation, event_reminder and qr_ticket all defaulted ON and all now
-- live inside seating_reminder. An AND would mean an organizer who had turned off
-- exactly one of the three — say the confirmation, because they found it chatty —
-- silently lost ALL automated guest texting the moment this shipped. An OR keeps
-- texting on for anyone who wanted any of it, which is the safe direction to be
-- wrong in: the worst case is a message they can switch off in one click, versus
-- a silence they would never think to go looking for.
--
-- campaign carries to invitation because both are the organizer deliberately
-- reaching their guest list, and an organizer who switched campaigns off was
-- expressing exactly the preference invitation now represents.
--
-- rsvp_reminder and decline_ack have no successor and are dropped. Their history
-- in sms_log stays — see section 6.
UPDATE public.events
   SET sms_settings = jsonb_build_object(
     'invitation',       COALESCE((sms_settings->>'campaign')::boolean, true),
     'seating_reminder', COALESCE((sms_settings->>'rsvp_confirmation')::boolean, true)
                      OR COALESCE((sms_settings->>'event_reminder')::boolean,    true)
                      OR COALESCE((sms_settings->>'qr_ticket')::boolean,         true),
     -- New type, no predecessor. ON: a guest who is not told their event moved or
     -- was cancelled is the single worst failure this product can have.
     'event_update',     true,
     'organizer_report', COALESCE((sms_settings->>'organizer_report')::boolean, true)
   )
 -- ONLY rows that still carry a pre-rebuild key.
 --
 -- Re-running this file without the guard would be actively destructive: on the
 -- second pass every `sms_settings->>'campaign'` lookup returns NULL (those keys
 -- are gone), every COALESCE falls through to `true`, and EVERY organizer's
 -- switches are silently reset to all-on — including the ones they had
 -- deliberately turned off. A migration that quietly undoes customer settings
 -- when re-applied is worse than one that fails loudly.
 -- `rsvp_confirmation` is deliberately NOT in this list, and leaving it in was a
 -- latent bug rather than a harmless extra.
 --
 -- 20260823000000 REVIVES that key. So once both files have run, a correctly
 -- migrated post-rebuild row carries `rsvp_confirmation` again — and this guard
 -- would match it, on a marker that no longer means "pre-rebuild". Re-running this
 -- file at that point does exactly what the paragraph above calls actively
 -- destructive: every lookup for `campaign`/`event_reminder`/`qr_ticket` returns
 -- NULL, every COALESCE falls through to true, and each organizer's switches are
 -- reset to all-on — while also dropping the revived key back out of the object.
 --
 -- Nothing is lost by removing it. The column is NOT NULL with a DEFAULT carrying
 -- all seven pre-rebuild keys (20260818000000), so every genuine pre-rebuild row
 -- still matches on one of the five below. The five are unambiguous: no key in the
 -- post-rebuild vocabulary shares a name with any of them.
 WHERE sms_settings ?| array[
   'rsvp_reminder', 'event_reminder',
   'qr_ticket', 'decline_ack', 'campaign'
 ];

ALTER TABLE public.events
  ALTER COLUMN sms_settings SET DEFAULT
    '{"invitation":true,"seating_reminder":true,"event_update":true,"organizer_report":true}'::jsonb;

COMMENT ON COLUMN public.events.sms_settings IS
  'Per-event on/off switch for each of the four SMS types (backend/config/smsMessageTypes.js). An absent key falls back to the registry default rather than to false — treating "absent" as "off" would silently disable a newly-shipped type for every existing event.';


/* ── 4. A real cancellation, instead of a silent DELETE ───────────────────── */

-- Two traps here, and the second one is the dangerous one.
--
-- FIRST: the status CHECK was written inline in CREATE TABLE (20260607000000_
-- init_schema line 20), so its name is auto-generated and not guaranteed across
-- environments that were built by different routes. Guessing 'events_status_check'
-- and being wrong aborts this entire migration, so look it up instead.
--
-- SECOND: the CHECK is NOT the four values that init_schema created. A later
-- migration added 'pending_review', which is the state a paid event sits in
-- between Stripe confirming payment and a Super Admin approving it — the busiest
-- non-terminal state on the platform. Re-stating the constraint from init_schema's
-- list would silently delete it, and then either abort here (if any event is
-- currently awaiting review) or, worse, apply cleanly on a quiet database and
-- break every future payment the moment paymentFulfillment writes that status.
--
-- So the list below is ADDITIVE to the live one, and the guard that follows makes
-- any status we failed to anticipate fail loudly and readably rather than as a
-- bare constraint violation with no clue what value caused it.
DO $$
DECLARE
  con_name text;
  stray    text;
BEGIN
  SELECT string_agg(DISTINCT status, ', ') INTO stray
    FROM public.events
   WHERE status IS NOT NULL
     AND status NOT IN ('draft','pending_review','active','paused','completed','cancelled');
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION
      'events.status holds value(s) this migration does not know about: %. Add them to the CHECK in 20260822000000_sms_rebuild.sql before re-running, or the new constraint will reject existing rows.', stray;
  END IF;

  SELECT conname INTO con_name
    FROM pg_constraint
   WHERE conrelid = 'public.events'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%status%'
     AND pg_get_constraintdef(oid) ILIKE '%paused%'
   LIMIT 1;
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.events DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.events
  ADD CONSTRAINT events_status_check
    CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'completed', 'cancelled'));

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

COMMENT ON COLUMN public.events.cancelled_at IS
  'When the organizer called the event off. Distinct from paused (temporarily hidden, resumable) and completed (it happened). Most behaviour follows for free: isEventLive() returns false so RSVPs close, and every scheduler job filters on status = ''active'' so reminders and reports stop.';
COMMENT ON COLUMN public.events.cancellation_reason IS
  'The organizer''s own words, shown to guests. Optional — a cancellation must never be blocked on someone finding the right sentence during a bad day.';

-- A guest holding an old link must be TOLD the event was called off, not shown a
-- dead page. The backend reads events with the service role and bypasses RLS, so
-- this policy is not on the hot path today — but it is the rule an anon-key read
-- would obey, and leaving it saying 'active' encodes the wrong intent for whoever
-- adds that read later.
DROP POLICY IF EXISTS guest_select_events ON public.events;
CREATE POLICY guest_select_events ON public.events
    FOR SELECT TO public
    USING (status IN ('active', 'cancelled'));


/* ── 5. Collapse a seating session into one message per guest ─────────────── */

-- Seating a guest now texts them their table and entry-pass link. Fired directly
-- from the seating endpoints, that would be a disaster: one drag-and-drop session
-- on a 200-guest chart issues one reassign per drop, so an organizer tidying their
-- layout for twenty minutes would spend hundreds of messages, and a guest moved
-- four times would receive four texts, three of them naming the wrong table.
--
-- So seating endpoints do not send. They UPSERT here, keyed on (event_id,
-- party_id), and every subsequent move overwrites the row — last table wins. A
-- scheduler job then sweeps rows that have sat still for a quiet period and sends
-- once, with the final answer.
--
-- Why a table and not an in-memory timer: smsDispatch already uses an in-process
-- Map to batch usage bookkeeping, and that is right there, because its worst case
-- is a slightly stale timestamp after a restart. Here the worst case is spending
-- an organizer's money twice, or losing a notification entirely, when pm2 restarts
-- or a second worker wakes up. Anything that spends money belongs in the database.
CREATE TABLE IF NOT EXISTS public.seating_notify_queue (
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  party_id    UUID NOT NULL,
  table_id    UUID,
  queued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ,
  PRIMARY KEY (event_id, party_id)
);

COMMENT ON TABLE public.seating_notify_queue IS
  'Debounce buffer for seating notifications. One row per party per event; every seat change upserts and overwrites it, so a guest moved five times is texted once, about their final table. Rows are swept by emailScheduler.jobSeatingNotices after a quiet period. Unseating a guest DELETES their row — never text someone about a table they no longer have.';
COMMENT ON COLUMN public.seating_notify_queue.notified_at IS
  'Stamped once swept, whatever the outcome. The outcome itself lives in sms_log; a guest with no phone must not be retried every fifteen minutes forever.';

-- Partial index: the sweep only ever asks for unsent rows, and on a busy platform
-- the sent ones will outnumber them by orders of magnitude.
CREATE INDEX IF NOT EXISTS idx_seating_notify_due
  ON public.seating_notify_queue (queued_at)
  WHERE notified_at IS NULL;

-- Service-role only, like every other SMS-side table. Enabled with no policies is
-- deliberate and matches sms_log / sms_opt_outs / sms_consent_log: there is no
-- organizer-facing read of this buffer, and RLS-on-with-no-policy denies by
-- default rather than relying on nobody ever pointing an anon key at it.
ALTER TABLE public.seating_notify_queue ENABLE ROW LEVEL SECURITY;


/* ── 6. Short links, because a URL is the most expensive word in an SMS ───── */

-- The RSVP link is https://<host>/<slug>/rsvp?g=<uuid> — about 89 characters,
-- most of it a UUID nobody reads. Against a 160-character GSM-7 segment, of which
-- the compliance footer already takes 78, that URL alone guarantees a second
-- segment before the message says anything.
--
-- Measured over a realistic spread of names and titles, replacing it with a
-- 32-character short link takes an Arabic message from 4 segments to 3. That is a
-- permanent 25% cut on every Arabic event, paid once in a redirect table.
--
-- It also just looks better. An 89-character URL wraps across four lines in a
-- text message and reads like phishing; fancyrsvp.com/i/k7m2xq4p does not.
CREATE TABLE IF NOT EXISTS public.short_links (
  -- The code IS the primary key. Lookup on the hot path (a guest tapping a link)
  -- is then a single index probe with no join and no secondary index to maintain.
  code        TEXT PRIMARY KEY,
  target_url  TEXT NOT NULL,
  event_id    UUID REFERENCES public.events(id) ON DELETE CASCADE,
  party_id    UUID,
  kind        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Cheap popularity signal. Deliberately NOT a full click-analytics table: this
  -- exists to shorten links, and a guest tapping their invitation is not an event
  -- worth a row.
  hits        INTEGER NOT NULL DEFAULT 0,
  last_hit_at TIMESTAMPTZ
);

COMMENT ON TABLE public.short_links IS
  'Redirect targets for /i/:code. Exists to keep SMS inside a segment boundary: the raw RSVP URL is ~89 characters against a 160-character segment whose footer already claims 78. One row per (party, kind) — regenerating a link for the same purpose reuses the existing code so a guest''s link never changes under them.';
COMMENT ON COLUMN public.short_links.kind IS
  'What this link is FOR (''rsvp'', ''ticket'', ''event''). Combined with party_id it makes link creation idempotent, so re-sending an invitation does not mint a second code pointing at the same page.';

-- Idempotency: one link per party per purpose. Partial, because platform-level
-- links (no party) are legitimately allowed to repeat.
CREATE UNIQUE INDEX IF NOT EXISTS idx_short_links_party_kind
  ON public.short_links (party_id, kind)
  WHERE party_id IS NOT NULL AND kind IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_short_links_event
  ON public.short_links (event_id)
  WHERE event_id IS NOT NULL;

-- Public SELECT, and only SELECT.
--
-- The redirect is served to anonymous guests who have nothing but the code, so
-- reads must work without auth. Writes never happen from a client — links are
-- minted server-side at send time with the service role — so there is no INSERT
-- or UPDATE policy, and RLS denies both by default.
--
-- What a code exposes if guessed is exactly what the link it replaces exposes,
-- which is why the code must be long enough not to be enumerable: see
-- utils/shortLinks.js for the alphabet and length.
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_select_short_links ON public.short_links;
CREATE POLICY public_select_short_links ON public.short_links
    FOR SELECT TO public
    USING (true);

-- Counting a tap must never be able to fail a redirect, and must never deadlock
-- two guests opening the same link at once. A single UPDATE with no read-back is
-- both, and keeping it in the database means the redirect path stays one round
-- trip for the lookup and one fire-and-forget for the count.
CREATE OR REPLACE FUNCTION public.bump_short_link(p_code TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE short_links
     SET hits = hits + 1,
         last_hit_at = now()
   WHERE code = p_code;
$$;

-- Anonymous guests are exactly who calls this, via the public resolve endpoint.
GRANT EXECUTE ON FUNCTION public.bump_short_link(TEXT) TO anon, authenticated;


/* ── 7. Retire the campaign queue ─────────────────────────────────────────── */

-- Free-text campaigns are gone, so the async worker that drained them is gone.
-- These three RPCs existed only to feed it.
DROP FUNCTION IF EXISTS public.claim_next_sms_campaign();
DROP FUNCTION IF EXISTS public.claim_sms_recipients(uuid, integer);
DROP FUNCTION IF EXISTS public.requeue_stale_sms_recipients(uuid, integer);

-- sms_campaign_progress is deliberately NOT dropped. reconcile_sms_delivery still
-- returns campaign_id when a carrier reports late on a historic send, and those
-- delivery receipts keep arriving for days after the send that caused them.

-- The tables are kept with their rows. They are the record of what was sent to
-- whom under a consent regime we may have to prove years from now, and the
-- consumption rows in sms_credit_ledger point at the same sends. Dropping them to
-- tidy up would be destroying evidence to save a few megabytes.
COMMENT ON TABLE public.sms_campaigns IS
  'RETIRED 2026-08-22. Free-text campaigns were removed in the four-type rebuild. Nothing writes here any more; the rows are kept as the compliance record of what was sent, to whom, and under which attestation.';
COMMENT ON TABLE public.sms_campaign_recipients IS
  'RETIRED 2026-08-22. See sms_campaigns. Read-only history; late carrier delivery receipts may still update delivery_status via reconcile_sms_delivery.';

-- ==========================================================================
-- STEP 6 of 6  ·  20260823000000_sms_rsvp_confirmation.sql
-- ==========================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- A FIFTH SMS TYPE: rsvp_confirmation, with the guest's details in it
--
-- This key is not new — it is REVIVED. 20260822000000 retired it, on the
-- reasoning that it "told the guest something they had just done themselves, and
-- charged for it". That was a fair description of what it used to send: a bare
-- "thanks, you're confirmed".
--
-- What it sends now is the thing the guest cannot already know at the moment they
-- reply: the date, the venue, their table, who is sitting with them, what was
-- ordered for each of them, and the link to their own entry pass and seating map.
-- It replaces an organizer answering those questions by hand, one guest at a time.
--
-- Cost, measured with backend/utils/smsSegments and the real 78-character
-- compliance footer rather than estimated:
--
--     full detail  EN   3 segments    9c/guest    200 guests = $18.00
--     full detail  AR   6 segments   18c/guest    200 guests = $36.00
--
-- Hence the 1.6 weight below — the heaviest guest type, because it is the longest
-- message and it fires for everyone who accepts. The estimator has to quote for
-- that up front instead of the organizer discovering it mid-event.
-- ════════════════════════════════════════════════════════════════════════════


/* ── 1. Switch it on for existing events ──────────────────────────────────────
 *
 * `||` MERGES, so this adds the key and leaves every other switch exactly as the
 * organizer left it. Writing a fresh jsonb_build_object here instead would reset
 * their four existing choices to all-on — the mistake 20260822000000's own
 * comment warns about at length.
 *
 * Guarded on the key being ABSENT, which makes the statement idempotent: re-running
 * this file cannot switch the type back on for an organizer who has since turned
 * it off. A migration that quietly undoes a customer setting when re-applied is
 * worse than one that fails loudly.
 */
UPDATE public.events
   SET sms_settings = COALESCE(sms_settings, '{}'::jsonb)
                   || jsonb_build_object('rsvp_confirmation', true)
 WHERE NOT (COALESCE(sms_settings, '{}'::jsonb) ? 'rsvp_confirmation');


/* ── 2. …and for events created from now on ── */
ALTER TABLE public.events
  ALTER COLUMN sms_settings SET DEFAULT
    '{"invitation":true,"rsvp_confirmation":true,"seating_reminder":true,"event_update":true,"organizer_report":true}'::jsonb;

COMMENT ON COLUMN public.events.sms_settings IS
  'Per-event on/off switch for each of the FIVE SMS types (backend/config/smsMessageTypes.js). An absent key falls back to the registry default rather than to false — treating "absent" as "off" would silently disable a newly-shipped type for every existing event.';


/* ── 3. Price it ──────────────────────────────────────────────────────────────
 *
 * jsonb_set on the type_weights object rather than rebuilding it, for the same
 * reason as above: an admin may have tuned the other three weights, and this
 * migration has no business resetting them.
 *
 * `true` as the create_missing argument adds the key when absent. The COALESCE
 * chain covers a deployment where sms_pricing_config or type_weights does not
 * exist yet, which is the state of any environment that has not run
 * 20260819000000 — there, this seeds a usable object instead of erroring.
 */
-- ORDER MATTERS, and getting it backwards silently loses three weights.
--
-- Seed the whole object FIRST, where it is missing entirely. If the single-key
-- update below ran first, its jsonb_set(create_missing => true) would CREATE
-- type_weights containing nothing but rsvp_confirmation — and this statement's
-- "is it empty?" guard would then be false, so the other three would never be
-- written. The estimator would fall back to its JS defaults and appear to work,
-- which is exactly why it would go unnoticed.
UPDATE public.super_admin_config
   SET sms_pricing_config = jsonb_set(
         COALESCE(sms_pricing_config, '{}'::jsonb),
         '{type_weights}',
         jsonb_build_object(
           'invitation',        1.0,
           'rsvp_confirmation', 1.6,
           'seating_reminder',  1.2,
           'event_update',      0.3
         ),
         true
       )
 WHERE COALESCE(sms_pricing_config -> 'type_weights', '{}'::jsonb) = '{}'::jsonb;

-- Then add just the new key where an admin already has tuned weights we must not
-- touch.
UPDATE public.super_admin_config
   SET sms_pricing_config = jsonb_set(
         sms_pricing_config,
         '{type_weights,rsvp_confirmation}',
         '1.6'::jsonb,
         true
       )
 WHERE NOT (
   COALESCE(sms_pricing_config -> 'type_weights', '{}'::jsonb) ? 'rsvp_confirmation'
 );


-- ==========================================================================
-- Done. Verify before trusting it:
--
--   SELECT count(*) AS events,
--          count(*) FILTER (WHERE sms_settings ? 'rsvp_confirmation') AS have_new_key,
--          count(*) FILTER (WHERE sms_settings ? 'campaign')          AS still_pre_rebuild
--     FROM public.events;
--
-- have_new_key must equal events, and still_pre_rebuild must be 0.
-- ==========================================================================

COMMIT;
