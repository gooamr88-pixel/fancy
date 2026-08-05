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
