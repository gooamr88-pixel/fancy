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
 WHERE sms_settings ?| array[
   'rsvp_confirmation', 'rsvp_reminder', 'event_reminder',
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
