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
