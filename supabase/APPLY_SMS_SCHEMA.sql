-- ═══════════════════════════════════════════════════════════════════════════
-- FANCY RSVP — COMPLETE SMS SCHEMA, IN ONE SCRIPT
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Paste this whole file into the Supabase SQL editor and run it once.
--
-- It is the seven SMS migrations concatenated IN APPLY ORDER. Running them one
-- at a time invites exactly the failure that produced this file: an out-of-order
-- apply hits `relation "sms_consent_log" does not exist` and rolls back work that
-- never depended on that table at all.
--
-- SAFE TO RE-RUN. Every statement is IF NOT EXISTS, CREATE OR REPLACE, or guarded
-- by an existence check, and every backfill is conditioned on the value still
-- being unset. Running it twice changes nothing the second time.
--
-- SAFE ON A DATABASE THAT ALREADY HAS SOME OF IT. Whatever is present is left
-- exactly as it is; only what is missing gets created.
--
-- The whole script runs as ONE transaction: if any part fails, nothing is
-- applied and the database is untouched. Scroll to the bottom for a report of
-- what exists afterwards.
--
-- Source of truth remains supabase/migrations/. This file is generated from
-- those seven, unmodified.
-- ═══════════════════════════════════════════════════════════════════════════



-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1 of 7  ·  20260809000000_sms_compliance.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── SMS COMPLIANCE: opt-out suppression, send attestation, consent provenance ───
-- Twilio Toll-Free Verification remediation (see TWILIO_COMPLIANCE_MASTER_AUDIT.md §19,
-- items H1/H2/H4/M5).
--
-- 1. sms_opt_outs — global suppression ledger written by the public inbound-SMS
--    webhook (STOP/UNSUBSCRIBE/CANCEL/END/QUIT) and consulted by every send path
--    (smsDispatch.sendRecipient + the campaign audience filter). A row with
--    opted_back_in_at IS NULL means the number must never be messaged; an
--    opt-back-in (START/UNSTOP/YES) stamps opted_back_in_at but keeps the row
--    for the audit trail.
--
-- 2. sms_campaigns.consent_attested_* — the organizer's recorded attestation,
--    captured at every campaign launch, that they hold prior express consent
--    for every host-supplied number (Terms of Service §5 "Host Consent
--    Obligations"). Sync (inline) sends record the same attestation in
--    activity_logs metadata since they create no sms_campaigns row.
--
-- 3. rsvp_parties.sms_consent_text_version / sms_consent_source — provenance
--    for each guest's own opt-in: which canonical consent text they were shown
--    (backend/utils/smsConsent.js must match frontend SmsConsentText.js) and
--    which surface captured it. Backs the Privacy Policy §3 record-keeping
--    commitment (timestamp + consent language + opt-out status).

CREATE TABLE IF NOT EXISTS sms_opt_outs (
  phone            TEXT PRIMARY KEY,                       -- E.164, exactly as Twilio reports `From`
  opted_out_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  keyword          TEXT,                                   -- keyword that triggered it (stop/quit/…)
  message_sid      TEXT,                                   -- inbound Twilio MessageSid (audit trail)
  opted_back_in_at TIMESTAMPTZ                             -- set on START/UNSTOP/YES; NULL = suppressed
);

COMMENT ON TABLE sms_opt_outs IS
  'Global SMS suppression list (TCPA/CTIA). opted_back_in_at IS NULL = never message this number. Rows are kept after opt-back-in for auditability.';

-- Service-role only: RLS enabled with no policies — the anon/authenticated keys
-- can neither read nor write this table; only the backend (service key) can.
ALTER TABLE sms_opt_outs ENABLE ROW LEVEL SECURITY;

ALTER TABLE sms_campaigns
  ADD COLUMN IF NOT EXISTS consent_attested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_attested_by UUID;

COMMENT ON COLUMN sms_campaigns.consent_attested_at IS
  'When the launching organizer attested they hold prior express consent for every host-supplied recipient number (Terms §5).';
COMMENT ON COLUMN sms_campaigns.consent_attested_by IS
  'Organizer user id who made the consent attestation for this campaign.';

ALTER TABLE rsvp_parties
  ADD COLUMN IF NOT EXISTS sms_consent_text_version TEXT,
  ADD COLUMN IF NOT EXISTS sms_consent_source TEXT;

COMMENT ON COLUMN rsvp_parties.sms_consent_text_version IS
  'Version identifier of the canonical consent language shown at opt-in (SmsConsentText.js / backend utils/smsConsent.js).';
COMMENT ON COLUMN rsvp_parties.sms_consent_source IS
  'Surface that captured the consent: guest_form_wizard | guest_form_template | guest_form.';


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2 of 7  ·  20260810000000_sms_optin_submissions.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── SMS OPT-IN PAGE SUBMISSIONS ─────────────────────────────────────────────
-- Backing store for the public /sms-opt-in form (Twilio TFV remediation). The
-- reviewer must see a LIVE opt-in flow — a phone field + consent checkbox +
-- submit that actually records consent — not a demonstration. Each row is a
-- timestamped, versioned consent record (Privacy Policy §3 record-keeping).
--
-- These records are standalone web-form opt-ins: the person receives event
-- messages only when a host invites them; the row documents that this number's
-- owner affirmatively consented to event-related texts from Fancy RSVP.

CREATE TABLE IF NOT EXISTS sms_optin_submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name             TEXT,
  phone                 TEXT NOT NULL,                 -- E.164 (normalized server-side)
  consent               BOOLEAN NOT NULL,              -- always true (endpoint rejects otherwise); explicit for auditability
  consent_text_version  TEXT NOT NULL,                 -- matches backend/utils/smsConsent.js at capture time
  source                TEXT NOT NULL DEFAULT 'sms_opt_in_page',
  ip                    TEXT,                          -- capture context, same convention as contact_submissions
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sms_optin_submissions IS
  'Consent records captured by the public /sms-opt-in web form (Twilio TFV opt-in URL). Service-role only.';

CREATE INDEX IF NOT EXISTS idx_sms_optin_submissions_phone ON sms_optin_submissions (phone);

-- Service-role only: RLS enabled with no policies.
ALTER TABLE sms_optin_submissions ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3 of 7  ·  20260811010000_sms_consent_log.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── SMS CONSENT LOG (append-only) ───────────────────────────────────────────
-- Twilio Toll-Free Verification remediation for rejection code 30475
-- ("Consent for Messaging Cannot Be Part of Other Agreements").
--
-- Consent state already lives on rsvp_parties (sms_consent, sms_consent_at,
-- sms_consent_text_version, sms_consent_source), but that is CURRENT state on a
-- mutable row: a later RSVP edit overwrites it, and the phone number itself
-- lives on `guests`, where it can change after the fact. Neither answers the
-- question a compliance reviewer or a TCPA claim actually asks — "what exactly
-- did this number's owner agree to, and when?"
--
-- This table is the append-only answer. One row per consent DECISION, capturing
-- the phone number, consent status, timestamp, and event as they stood at the
-- moment it was made, plus the exact consent wording shown and the surface that
-- captured it. Refusals are logged too: a dated decline is itself evidence that
-- consent was asked for separately and freely refused, which is precisely what
-- 30475 review looks for.
--
-- `guest_id` is best-effort and is NULL on the guest-RSVP path: submit_rsvp_v2
-- returns the party, not the individual guest row, and resolving it would cost
-- an extra query in the hot RSVP path for no audit value. `party_id` is the
-- identity that matters — it is the party SMS is addressed to, and the primary
-- contact's number is reachable from it. The column is populated where the id
-- is already in hand (add_guest_to_party returns it).
--
-- Rows are never updated or deleted. A guest who opts out, then back in, has
-- two rows; the newest row for a phone is their current decision, and the
-- history above it is the audit trail.

CREATE TABLE IF NOT EXISTS sms_consent_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID REFERENCES events(id) ON DELETE SET NULL,
  party_id              UUID,                          -- rsvp_parties.id (the party SMS is addressed to)
  guest_id              UUID,                          -- guests.id of the primary contact, when resolvable
  phone                 TEXT NOT NULL,                 -- E.164 as captured at consent time
  consent               BOOLEAN NOT NULL,              -- true = opted in, false = asked and declined
  consent_text_version  TEXT,                          -- canonical wording shown (utils/smsConsent.js)
  source                TEXT,                          -- guest_form_wizard | guest_form_template | guest_form | sms_opt_in_page
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sms_consent_log IS
  'Append-only record of every SMS consent decision (opt-in AND refusal), captured server-side. Never updated or deleted. Service-role only.';
COMMENT ON COLUMN sms_consent_log.consent IS
  'true = the guest ticked the dedicated SMS consent checkbox; false = the guest was shown it and left it unticked.';
COMMENT ON COLUMN sms_consent_log.phone IS
  'The number as captured at consent time — deliberately denormalized, so a later edit to guests.phone cannot rewrite history.';

CREATE INDEX IF NOT EXISTS idx_sms_consent_log_phone ON sms_consent_log (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_consent_log_event ON sms_consent_log (event_id);
CREATE INDEX IF NOT EXISTS idx_sms_consent_log_party ON sms_consent_log (party_id);

-- Service-role only: RLS enabled with no policies — anon/authenticated keys can
-- neither read nor write it; only the backend service key can.
ALTER TABLE sms_consent_log ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4 of 7  ·  20260812010000_host_sms_consent_attestation.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── HOST-ATTESTED SMS CONSENT ───────────────────────────────────────────────
-- Organizers routinely collect phone numbers outside the platform (a wedding
-- list, a corporate roster) and already hold the guest's permission to text
-- them about the event. CTIA/TCPA recognise that consent — it belongs to the
-- guest, not to the channel that captured it — but the platform must be able to
-- prove WHO claimed it, WHEN, and for WHICH guest, rather than assuming it.
--
-- Before this migration a host-supplied number was simply unmessageable: only a
-- guest's own checkbox set rsvp_parties.sms_consent. That is safe but it made
-- "import a guest list → send invitations" impossible. This adds the missing
-- third state — consent obtained by the host and formally attested to us — and
-- makes it auditable per guest instead of per campaign.
--
-- THE PRECEDENCE RULE, enforced in guestService and relied on by every send:
--   A guest's own decision always outranks a host's attestation.
--   An attestation may only ever set consent on a party that has NEVER recorded
--   a guest decision (sms_consent_at IS NULL). A guest who was shown the
--   checkbox and declined can never be re-enabled by a host attesting over the
--   top of them, and a STOP reply still suppresses the number globally
--   regardless of any attestation (sms_opt_outs).

ALTER TABLE rsvp_parties
  ADD COLUMN IF NOT EXISTS sms_consent_method      TEXT,
  ADD COLUMN IF NOT EXISTS sms_consent_attested_by UUID,
  ADD COLUMN IF NOT EXISTS sms_consent_attested_at TIMESTAMPTZ;

COMMENT ON COLUMN rsvp_parties.sms_consent_method IS
  'How consent was obtained: guest_optin (the guest ticked our checkbox) | host_attested (the organizer attested they obtained it). NULL on rows that never recorded a decision.';
COMMENT ON COLUMN rsvp_parties.sms_consent_attested_by IS
  'Organizer user id who attested they hold this guest''s consent. NULL for guest_optin.';
COMMENT ON COLUMN rsvp_parties.sms_consent_attested_at IS
  'When that attestation was made. NULL for guest_optin.';

-- Mirror the same two facts onto the append-only log so a single table answers
-- "who claimed this consent and how" for every decision ever recorded.
ALTER TABLE sms_consent_log
  ADD COLUMN IF NOT EXISTS method      TEXT,
  ADD COLUMN IF NOT EXISTS attested_by UUID;

COMMENT ON COLUMN sms_consent_log.method IS
  'guest_optin | host_attested — whether the guest opted in themselves or an organizer attested on their behalf.';
COMMENT ON COLUMN sms_consent_log.attested_by IS
  'Organizer user id, for host_attested rows only.';

-- Reporting: "which of my SMS-eligible guests are host-attested rather than
-- self-opted-in" is the question a compliance audit asks first.
CREATE INDEX IF NOT EXISTS idx_rsvp_parties_sms_consent_method
  ON rsvp_parties (event_id, sms_consent_method)
  WHERE sms_consent = true;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5 of 7  ·  20260818000000_sms_addon.sql
-- ═══════════════════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 6 of 7  ·  20260819000000_sms_pricing_config.sql
-- ═══════════════════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 7 of 7  ·  20260820000000_sms_usage_and_limits.sql
-- ═══════════════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 8 of 8  ·  Backfill any pricing keys added after a previous apply
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Step 6 only sets sms_pricing_config when it is NULL or {}, so a database that
-- applied an EARLIER version of that migration keeps its stored shape — which
-- predates the sending-limit and low-balance blocks.
--
-- The application never notices (backend/config/smsPricing.js normalizes every
-- read, filling anything absent), but a row that does not reflect the real model
-- is confusing to anyone inspecting it, and the admin screen would be writing
-- keys that appear from nowhere on first save. Merged in only where missing, so
-- an admin's existing values are never overwritten.

UPDATE public.super_admin_config
SET sms_pricing_config = sms_pricing_config || jsonb_build_object(
      'limits', jsonb_build_object('ramp_up', jsonb_build_array(
        jsonb_build_object('delivered_min', 0,    'max_per_send', 50),
        jsonb_build_object('delivered_min', 200,  'max_per_send', 500),
        jsonb_build_object('delivered_min', 1000, 'max_per_send', 0)
      ))
    )
WHERE sms_pricing_config IS NOT NULL
  AND NOT (sms_pricing_config ? 'limits');

UPDATE public.super_admin_config
SET sms_pricing_config = sms_pricing_config || jsonb_build_object(
      'alerts', jsonb_build_object('low_balance_pct', 20)
    )
WHERE sms_pricing_config IS NOT NULL
  AND NOT (sms_pricing_config ? 'alerts');


-- ═══════════════════════════════════════════════════════════════════════════
-- DONE — what exists now
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Every row should read 'ok'. Anything still MISSING names the file that
-- supplies it, and means that part did not apply.

WITH expected(sort_key, object_name, kind, supplied_by) AS (VALUES
  (1,  'sms_credit_wallets',                    'table',    '20260607100000_schema_completion'),
  (2,  'sms_credit_ledger',                     'table',    '20260607100000_schema_completion'),
  (3,  'sms_campaigns',                         'table',    '20260627000000_sms_campaign_jobs'),
  (4,  'sms_campaign_recipients',               'table',    '20260627000000_sms_campaign_jobs'),
  (5,  'sms_opt_outs',                          'table',    'STEP 1'),
  (6,  'sms_optin_submissions',                 'table',    'STEP 2'),
  (7,  'sms_consent_log',                       'table',    'STEP 3'),
  (8,  'sms_consent_log.method',                'column',   'STEP 4'),
  (9,  'rsvp_parties.sms_consent_method',       'column',   'STEP 4'),
  (10, 'sms_log',                               'table',    'STEP 5'),
  (11, 'events.sms_addon_purchased_at',         'column',   'STEP 5'),
  (12, 'events.sms_settings',                   'column',   'STEP 5'),
  (13, 'organizations.sms_consent',             'column',   'STEP 5'),
  (14, 'super_admin_config.sms_pricing_config', 'column',   'STEP 6'),
  (15, 'sms_credit_ledger.cost_cents',          'column',   'STEP 7'),
  (16, 'sms_credit_wallets.last_used_at',       'column',   'STEP 7'),
  (17, 'organizations.sms_delivered_total',     'column',   'STEP 7'),
  (18, 'increment_sms_delivered',               'function', 'STEP 7'),
  (19, 'reset_sms_balance_alerts',              'function', 'STEP 7'),
  (20, 'sms_admin_analytics',                   'function', 'STEP 7')
)
SELECT
  e.object_name,
  e.kind,
  CASE
    WHEN e.kind = 'table' THEN
      CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = e.object_name)
           THEN 'ok' ELSE 'MISSING' END
    WHEN e.kind = 'column' THEN
      CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name  = split_part(e.object_name, '.', 1)
                          AND column_name = split_part(e.object_name, '.', 2))
           THEN 'ok' ELSE 'MISSING' END
    ELSE
      CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                        WHERE n.nspname = 'public' AND p.proname = e.object_name)
           THEN 'ok' ELSE 'MISSING' END
  END AS status,
  e.supplied_by
FROM expected e
ORDER BY e.sort_key;
