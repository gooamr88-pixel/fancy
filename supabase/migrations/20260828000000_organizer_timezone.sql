-- ════════════════════════════════════════════════════════════════════════
-- EVERY CLOCK IN THE PLATFORM GETS AN OWNER.
--
-- Until now the platform had no timezone at all — it had two conventions
-- quietly disagreeing with each other, and the disagreement was visible to
-- organizers as dates that changed depending on which screen they were on.
--
--   1. Event dates were a "floating wall clock". An organizer typing 18:30
--      produced the literal digits 18:30 stored as 18:30 UTC, and the guest
--      pages printed them back with timeZone:'UTC' so the digits survived.
--      That convention works ONLY if every reader honours it — and several
--      readers never did. The email templates, the dashboard event cards,
--      the admin event list and the Android check-in app all formatted the
--      same column in whatever zone the reader's machine happened to be in,
--      so one event advertised two different times.
--
--   2. Worse, nothing that had to ACT on an event date honoured it either.
--      The lifecycle scheduler and the seating reveal both treat the stored
--      value as a real instant and compute "24 hours before" against it. A
--      wall-clock 18:30 is not an instant, so those jobs fired hours away
--      from the moment the organizer meant. That is not a display bug; the
--      messages genuinely went out at the wrong time.
--
-- The fix is to give the platform a real answer to "whose clock is this?".
-- It is the ORGANIZER's clock, resolved once from the IP they signed up on
-- and then frozen — an account opened in San Diego keeps San Diego time even
-- when its owner later signs in from Cairo. Freezing is the whole point: a
-- timezone that follows the traveller would rewrite the advertised start
-- time of a wedding because the planner took a holiday.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
--
-- It does not backfill, and it does not touch a single event_date. Both of
-- those are destructive-by-nature: reinterpreting stored digits under the
-- wrong zone silently moves real events by real hours, and existing accounts
-- carry no signup IP to reinterpret them under. Those values are proposed by
-- scripts/proposeOrganizerTimezones.js from the evidence in `sessions.ip`,
-- reviewed as a table by a human, and applied by a SEPARATE migration. This
-- one only opens the columns, so it is safe to run on its own and safe to
-- run before anybody has decided anything.
--
-- Consequently every column here is NULLABLE with no DEFAULT. Null carries
-- real meaning — "nobody has established this yet" — and the application
-- falls back to PLATFORM_TIMEZONE at read time. A DEFAULT would erase the
-- difference between an account whose zone was genuinely resolved and one
-- that was never looked at, which is exactly the distinction the backfill
-- review depends on.
--
-- DEPLOY ORDER IS NOT OPTIONAL: apply this migration BEFORE shipping the
-- code that selects these columns. PostgREST fails the WHOLE select when one
-- listed column is missing, so a code-first deploy does not degrade the
-- timezone feature — it breaks sign-in and the guest pages outright.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── The organizer's clock ───────────────────────────────────────────────

ALTER TABLE organizations
    -- An IANA zone name ('America/Los_Angeles'), never a UTC offset. Offsets
    -- cannot express daylight saving, and San Diego is UTC-8 for four months
    -- of the year and UTC-7 for the other eight. Storing '-08:00' would put
    -- every summer event an hour out. Not length-constrained and not CHECKed
    -- against a fixed list: the IANA database gains and renames zones, and a
    -- CHECK written today becomes a migration blocker the first time that
    -- happens. Validity is enforced in the application, which resolves names
    -- against the runtime's own tz database via Intl.
    ADD COLUMN IF NOT EXISTS timezone text,

    -- How `timezone` came to hold what it holds. This is not decoration —
    -- it is what makes the value auditable and safely re-runnable:
    --   'ip'      resolved from the signup IP, the intended path
    --   'manual'  a human set it (organizer settings, or admin correction)
    --   'default' resolution failed and the platform default was recorded
    -- A later pass may re-resolve 'default' rows as geo data improves, but
    -- must never overwrite 'manual' — a human decision outranks a lookup.
    ADD COLUMN IF NOT EXISTS timezone_source text,

    -- ISO-3166-1 alpha-2 from the signup lookup, kept beside the zone as the
    -- evidence for it. When an organizer disputes their times, this answers
    -- "what did we actually see when the account was created?" without
    -- retaining the IP address itself, which is personal data we have no
    -- reason to keep once it has been turned into a zone.
    ADD COLUMN IF NOT EXISTS signup_ip_country text;

-- The three states are enumerated rather than free text so a typo ('IP',
-- 'auto') cannot quietly create a fourth category that the re-resolution
-- pass then skips. NOT VALID would let existing rows escape the check, but
-- there are no existing values to grandfather — the column is new and empty
-- — so the constraint is validated immediately and means what it says.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'organizations_timezone_source_check'
    ) THEN
        ALTER TABLE organizations
            ADD CONSTRAINT organizations_timezone_source_check
            CHECK (timezone_source IS NULL OR timezone_source IN ('ip', 'manual', 'default'));
    END IF;
END $$;

-- ─── The event's clock ───────────────────────────────────────────────────

-- Snapshotted from the owning organization when the event is created, NOT
-- read through the FK at display time. An event is a physical thing that
-- happens at a fixed hour in a fixed place: once invitations quote 6:30pm,
-- that 6:30pm belongs to the event and must not move because the organizer's
-- own record was later corrected. Reading org.timezone live would rewrite
-- the advertised start time of every past event the moment an admin fixed a
-- single misdetected account.
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS timezone text;

COMMENT ON COLUMN organizations.timezone IS
    'IANA zone resolved once from the signup IP and frozen thereafter. Null = never established; readers fall back to PLATFORM_TIMEZONE.';
COMMENT ON COLUMN organizations.timezone_source IS
    'Provenance of organizations.timezone: ip | manual | default. Never overwrite a ''manual'' row from a lookup.';
COMMENT ON COLUMN organizations.signup_ip_country IS
    'ISO-3166-1 alpha-2 seen at signup, kept as evidence for the resolved zone. The IP itself is not retained.';
COMMENT ON COLUMN events.timezone IS
    'Snapshot of the owning org''s zone at creation. Deliberately not read live through org_id — a corrected account must not move events that already have invitations out.';

COMMIT;
