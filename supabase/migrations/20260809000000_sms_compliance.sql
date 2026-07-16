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
