-- ═══════════════════════════════════════════════════════════════
-- Fancy RSVP — Phase 5 Database Migration
-- Fix tier_max_guests counting: declines free their slot, maybe/pending/yes
-- and waitlist still reserve one.
-- ═══════════════════════════════════════════════════════════════
--
-- 004_tier_guest_cap_trigger.sql counted every row in `guests` unconditionally.
-- That double-counts explicit declines (response = 'no') against the cap:
-- on a 100-guest tier, 100 public-link declines would permanently lock out
-- anyone from ever RSVPing "yes" — the cap never frees up. This patches the
-- SAME function the trigger already calls (CREATE OR REPLACE — no need to
-- touch/recreate the trigger itself, it picks up the new body immediately).
--
-- New rule: a guest's row still counts toward the cap UNLESS their party's
-- response is exactly 'no'. So 'pending' (not yet responded / imported
-- roster), 'maybe', 'yes', and 'waitlist' all still reserve a slot — only a
-- decline frees it. `guests.party_id` is joined to `rsvp_parties.response`
-- (LEFT JOIN + COALESCE so a guest somehow missing its party row is treated
-- as still reserving a slot, never silently exempted from the cap).
--
-- Known residual gap (out of scope for this patch): this only runs on INSERT
-- into `guests`. A party flipping from 'no' -> 'yes' via update_party_response
-- (the one-click email link) doesn't insert a new guests row, so it isn't
-- re-checked against the cap at that moment. Flag if you want that covered
-- too — it would need a second trigger on rsvp_parties' UPDATE of `response`.

CREATE OR REPLACE FUNCTION enforce_tier_guest_cap()
RETURNS TRIGGER AS $$
DECLARE
  v_cap INTEGER;
  v_count INTEGER;
BEGIN
  SELECT tier_max_guests INTO v_cap FROM events WHERE id = NEW.event_id;

  -- NULL or <= 0 => unlimited; nothing to enforce.
  IF v_cap IS NULL OR v_cap <= 0 THEN
    RETURN NEW;
  END IF;

  -- Count existing guests whose party hasn't explicitly declined. A guest
  -- with no matching party row (shouldn't happen, but defensive) is treated
  -- as still reserving a slot via COALESCE(..., 'pending').
  SELECT COUNT(*) INTO v_count
  FROM guests g
  LEFT JOIN rsvp_parties p ON p.id = g.party_id
  WHERE g.event_id = NEW.event_id
    AND COALESCE(p.response, 'pending') <> 'no';

  -- +1 for the row about to be inserted (BEFORE INSERT — NEW isn't committed yet).
  IF v_count + 1 > v_cap THEN
    RAISE EXCEPTION 'GUEST_LIMIT_REACHED: This event''s plan allows up to % guests (currently %, declines excluded).', v_cap, v_count
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger already exists from 004 and points at this function by name —
-- nothing else to recreate.
