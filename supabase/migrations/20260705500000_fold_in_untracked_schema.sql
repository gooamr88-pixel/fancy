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
