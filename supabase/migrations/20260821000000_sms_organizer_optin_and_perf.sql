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
