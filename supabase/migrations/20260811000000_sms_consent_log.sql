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
