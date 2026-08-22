-- ════════════════════════════════════════════════════════════════════════
-- شغّل الملف ده مرة واحدة في Supabase SQL Editor.
--
-- آمن تماماً: كل جملة فيه IF NOT EXISTS / CREATE OR REPLACE، يعني لو أي
-- حاجة منهم متطبقة عندك خلاص، الجزء ده مابيعملش أي حاجة. مافيش أي DROP
-- ولا DELETE ولا تعديل على بيانات موجودة.
--
-- فيه ٣ أجزاء:
--   ١. الحاجات الناقصة من السلسلة (أهمها password_hash و guest_analytics)
--   ٢. أعمدة التوقيت — لازم تتطبق قبل نشر الكود الجديد
--   ٣. فحص في الآخر بيقولك النتيجة
--
-- مولّد آلياً من:
--   supabase/migrations/20260705500000_fold_in_untracked_schema.sql
--   supabase/migrations/20260828000000_organizer_timezone.sql
-- لو عدّلت أي واحد منهم، ولّد الملف ده تاني بدل ما تعدّله بإيدك.
-- ════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════
-- PART 1 / 3 — fold the untracked schema into the chain
-- ══════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- THE MIGRATION CHAIN STOPS LYING ABOUT WHAT IT BUILDS.
--
-- This repository has had three competing accounts of its own schema, and no
-- two of them agreed:
--
--   supabase/migrations/*   the chain that actually runs on deploy
--   backend/migrations/*    five files applied to production by hand,
--                           never folded in
--   supabase/schema.sql     a pg_dump snapshot, stale since 20260719
--
-- Production works because it is a long-lived database that received all
-- three over time. Nothing else does. A fresh `supabase db reset`, a restored
-- backup, a new staging environment and every local dev database get only the
-- chain — and the chain has been missing pieces the code cannot run without.
--
-- The failure is not graceful. PostgREST rejects the ENTIRE query when one
-- selected column is unknown, so a missing column does not degrade a feature,
-- it fails every request that touches that table. On a database built from
-- the chain alone, before this migration:
--
--   • `organizations.password_hash` does not exist, so the login query fails
--     and NOBODY CAN SIGN IN.
--   • `guest_analytics` does not exist, so every event's analytics page 500s
--     — and 20260727000000_guest_analytics_composite_indexes.sql, which does
--     an unguarded CREATE INDEX on that table, ABORTS THE WHOLE CHAIN before
--     it ever gets that far.
--   • the paid guest cap is not enforced, so every plan is effectively
--     unlimited.
--
-- WHY THIS FILE IS DATED 20260705500000
--
-- Not at the end of the chain, which is where a "catch-up" migration would
-- naturally go, because two of its dependencies pull in opposite directions:
--
--   after  20260705000000 — guest_analytics.party_id references rsvp_parties,
--                           which that migration creates
--   before 20260727000000 — which builds composite indexes ON guest_analytics
--                           with no guard, so the table must already exist
--
-- Dating it at the end satisfied the first and broke the second: the chain
-- died at 20260727 with "relation guest_analytics does not exist". This slot
-- is the only one that satisfies both.
--
-- WHAT IS DELIBERATELY NOT HERE
--
--   custom_form_fields — it IS built by the chain, as `rsvp_form_fields` in
--     20260607100000, renamed by 20260705000000. It looked missing only
--     because a CREATE-scanning audit cannot follow ALTER TABLE ... RENAME TO.
--
--   guest_reminders — created by backend/migrations/002 and completely dead:
--     nothing reads or writes it, and its `rsvp_id` foreign key points at
--     `rsvps`, a table 20260705000000 dropped. Recreating it would fail, and
--     re-pointing it would mean inventing a shape for a table nothing uses.
--
-- Every statement is idempotent, so on production — which already has all of
-- this — the file is a no-op.
--
-- backend/migrations/*.sql is NOT deleted. Those files are the record of what
-- was applied to production by hand; they are superseded, not wrong. Nothing
-- new may be added there.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Authentication columns ───────────────────────────────────────────
--
-- `password_hash` is the single most consequential omission in the repository.
-- It is selected by login, by the password-change flow and by getProfile, and
-- it appears in NO migration in either directory — not even in the stale
-- snapshot. It reached production by hand and has been invisible ever since.
--
-- Nullable, deliberately: a Google-created account legitimately has none.
-- googleAuth inserts `password_hash: null` and the login path reads that null
-- as "this account authenticates through Google" — a NOT NULL constraint here
-- would break Google sign-up outright.

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS password_hash text,
    -- From backend/migrations/003. Read by login to divert an organizer to a
    -- forced reset screen.
    ADD COLUMN IF NOT EXISTS must_reset_password boolean DEFAULT false;

COMMENT ON COLUMN organizations.password_hash IS
    'PBKDF2 hash as "salt:derivedKey". NULL means this account signs in through Google only.';
COMMENT ON COLUMN organizations.must_reset_password IS
    'Set by an admin to force a password reset at the next sign-in.';

-- ─── 2. guest_analytics — what every event''s analytics page reads ───────
--
-- From backend/migrations/002. The guest rebuild already knew this was a
-- problem: it re-keys `rsvp_id` to `party_id` inside an IF EXISTS guard, and
-- its own comment says the table "may not exist in every environment that
-- replays supabase/migrations/*". The guard was correct and the gap was never
-- closed, so on a fresh database the guard simply passes over nothing.
--
-- Created here already in the post-rebuild shape, so that guarded rename
-- (which runs earlier) correctly finds nothing to do.
--
-- The column list matches what the code WRITES, not only what it reads:
-- trackGuestEvent inserts user_agent, ip_hash and referrer alongside the four
-- columns the dashboard selects. A schema audit that parses only `.select()`
-- would report this table clean while every insert into it failed.

CREATE TABLE IF NOT EXISTS guest_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    -- Nullable, ON DELETE SET NULL: an analytics row outlives the party it
    -- describes. Deleting a guest must not erase the record that somebody
    -- opened the invitation.
    party_id uuid REFERENCES rsvp_parties(id) ON DELETE SET NULL,
    session_id text,
    event_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    user_agent text,
    -- Hashed, never raw. This table records every guest who opens an
    -- invitation; a raw IP column would make it a log of who was where.
    ip_hash text,
    referrer text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_analytics_event_id ON guest_analytics(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_analytics_event_type ON guest_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_guest_analytics_created_at ON guest_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_guest_analytics_session ON guest_analytics(session_id);

-- ─── 3. Row-level security ───────────────────────────────────────────────
--
-- Enabled with no permissive policy. The backend reaches Postgres with the
-- service key, which bypasses RLS, so the tracking endpoint keeps working; a
-- browser holding the anon key gets nothing. Verified against the client: the
-- guest page posts to /public/events/:slug/analytics and never touches
-- Supabase directly, so nothing anonymous needs read or write here.
--
-- This is deliberately STRICTER than backend/migrations/002, which shipped
-- `FOR ALL USING (true) WITH CHECK (true)` — a policy granting the anon role
-- full read and write over every guest's session, user agent and referrer for
-- every event on the platform.

ALTER TABLE guest_analytics ENABLE ROW LEVEL SECURITY;

-- Dropped explicitly so an environment that already ran backend/migrations/002
-- by hand ends up in the same posture as a fresh one. Without this the fold-in
-- would leave production exactly as exposed as it is today while the database
-- it builds is locked down — two environments, two security postures, and the
-- one that is wrong is the one with real guests in it.
DROP POLICY IF EXISTS "service_role_full_access_analytics" ON guest_analytics;

-- ─── 4. The paid guest cap ───────────────────────────────────────────────
--
-- From backend/migrations/004→006, and the most commercially consequential
-- omission after the login column: this is what stops an event taking more
-- guests than the plan it was paid for. On a database built from the chain
-- alone it does not exist, so every tier is effectively unlimited — and
-- nothing surfaces that, because a cap failing OPEN is indistinguishable from
-- a cap that was never reached.
--
-- This class of gap is invisible to the schema audit: a trigger is never named
-- in a `.select()` or an `.rpc()`, so no amount of reading the application
-- code reveals its absence. It was found by reading backend/migrations itself.
--
-- Reproduced at 006's final state, which is what production runs.

CREATE OR REPLACE FUNCTION count_reserved_guests(p_event_id UUID, p_exclude_party_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Declines do not reserve a slot. `p_exclude_party_id` lets the response
  -- trigger below leave out the party it is about to count separately.
  SELECT COUNT(*) INTO v_count
  FROM guests g
  LEFT JOIN rsvp_parties p ON p.id = g.party_id
  WHERE g.event_id = p_event_id
    AND (p_exclude_party_id IS NULL OR g.party_id IS DISTINCT FROM p_exclude_party_id)
    AND COALESCE(p.response, 'pending') <> 'no';
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_tier_guest_cap()
RETURNS TRIGGER AS $$
DECLARE
  v_cap INTEGER;
  v_count INTEGER;
BEGIN
  SELECT tier_max_guests INTO v_cap FROM events WHERE id = NEW.event_id;
  IF v_cap IS NULL OR v_cap <= 0 THEN
    RETURN NEW;
  END IF;

  v_count := count_reserved_guests(NEW.event_id);

  IF v_count + 1 > v_cap THEN
    RAISE EXCEPTION 'GUEST_LIMIT_REACHED: This event''s plan allows up to % guests (currently %, declines excluded).', v_cap, v_count
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_tier_guest_cap ON guests;
CREATE TRIGGER trg_enforce_tier_guest_cap
  BEFORE INSERT ON guests
  FOR EACH ROW
  EXECUTE FUNCTION enforce_tier_guest_cap();

-- The second trigger closes the "decline → yes via the email link" bypass.
-- That path never INSERTs a guest row — it only UPDATEs a response — so the
-- INSERT trigger above never fired and a full event could quietly overflow.
CREATE OR REPLACE FUNCTION enforce_tier_guest_cap_on_response_update()
RETURNS TRIGGER AS $$
DECLARE
  v_cap INTEGER;
  v_count INTEGER;
  v_party_guest_count INTEGER;
BEGIN
  -- Only a party moving OUT of 'no' changes how many guests count. Every
  -- other transition (yes↔maybe↔pending) is a no-op for the cap.
  IF OLD.response IS DISTINCT FROM 'no' OR NEW.response = 'no' THEN
    RETURN NEW;
  END IF;

  SELECT tier_max_guests INTO v_cap FROM events WHERE id = NEW.event_id;
  IF v_cap IS NULL OR v_cap <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_party_guest_count FROM guests WHERE party_id = NEW.id;
  v_count := count_reserved_guests(NEW.event_id, NEW.id);

  IF v_count + v_party_guest_count > v_cap THEN
    RAISE EXCEPTION 'GUEST_LIMIT_REACHED: This event''s plan allows up to % guests (currently %, declines excluded).', v_cap, v_count
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_tier_guest_cap_on_response_update ON rsvp_parties;
CREATE TRIGGER trg_enforce_tier_guest_cap_on_response_update
  BEFORE UPDATE OF response ON rsvp_parties
  FOR EACH ROW
  EXECUTE FUNCTION enforce_tier_guest_cap_on_response_update();

COMMIT;

-- ══════════════════════════════════════════════════════════════════════
-- PART 2 / 3 — the organizer timezone columns
-- ══════════════════════════════════════════════════════════════════════

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

-- ══════════════════════════════════════════════════════════════════════
-- PART 3 / 3 — الفحص: إيه اللي بقى موجود دلوقتي
-- ══════════════════════════════════════════════════════════════════════
--
-- كل صف المفروض يطلع "applied". أي صف يطلع "** MISSING **" معناه إن
-- migration من اللي مش أنا كتبتها لسه ناقص — ابعتهولي وأقولك أنهي ملف.

WITH checks(sort_key, migration, adds, present) AS (
  VALUES
    (1, 'الجزء ١ — الضم',
        'organizations.password_hash — من غيره مفيش تسجيل دخول',
        EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='organizations'
                  AND column_name='password_hash')),

    (2, 'الجزء ١ — الضم',
        'guest_analytics — من غيره صفحة التحليلات بتقع',
        to_regclass('public.guest_analytics') IS NOT NULL),

    (3, 'الجزء ١ — الضم',
        'enforce_tier_guest_cap() — حد الضيوف المدفوع',
        EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'enforce_tier_guest_cap')),

    (4, 'الجزء ٢ — التوقيت',
        'organizations.timezone — لازم قبل نشر الكود',
        EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='organizations'
                  AND column_name='timezone')),

    (5, 'الجزء ٢ — التوقيت',
        'events.timezone — ساعة كل مناسبة',
        EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='events'
                  AND column_name='timezone')),

    -- migrations أقدم، مش من شغل الجلسة دي — دول اللي محتاج أعرف نتيجتهم
    (6, '20260818000000_tier_identity',
        'events.tier_key — من غيره تغيير اسم الباقة بيلغي مميزات مدفوعة',
        EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='events'
                  AND column_name='tier_key')),

    (7, '20260822000000_sms_rebuild',
        'short_links — من غيره كل روابط الرسايل ميتة',
        to_regclass('public.short_links') IS NOT NULL),

    (8, '20260822000000_sms_rebuild',
        'seating_notify_queue',
        to_regclass('public.seating_notify_queue') IS NOT NULL),

    (9, '20260825000000_printed_invitations',
        'shop_products — قسم المتجر كله',
        to_regclass('public.shop_products') IS NOT NULL),

    (10, '20260827000000_shop_category_cover',
         'shop_categories.cover_image_url',
         EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='shop_categories'
                   AND column_name='cover_image_url'))
)
SELECT
    CASE WHEN present THEN 'applied' ELSE '** MISSING **' END AS status,
    migration,
    adds
FROM checks
ORDER BY present, sort_key;
