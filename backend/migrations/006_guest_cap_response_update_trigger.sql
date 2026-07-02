-- ═══════════════════════════════════════════════════════════════
-- Fancy RSVP — Phase 6 Database Migration
-- Close the "decline -> yes via email link" bypass on tier_max_guests
-- ═══════════════════════════════════════════════════════════════
--
-- 004/005 only checked the cap on INSERT into `guests`. A party that had
-- declined (freeing its slot) and later flips its response to 'yes'/'maybe'
-- via the one-click email link (update_party_response RPC) never inserts a
-- new `guests` row — it just UPDATEs rsvp_parties.response — so the cap was
-- never re-checked at that moment, letting a filled event silently exceed
-- its tier_max_guests.
--
-- This adds a second trigger, on `rsvp_parties` (BEFORE UPDATE OF response),
-- that only does work when a party moves OUT of 'no' (i.e. its guests are
-- about to start counting again) — every other transition (yes<->maybe<->
-- pending) doesn't change how many of that party's guests count, so it's a
-- no-op for those.
--
-- Both triggers now share one counting rule via count_reserved_guests(), so
-- the "declines don't count" logic lives in exactly one place instead of
-- being duplicated (and risking drifting out of sync) across two functions.

-- ── Shared counting helper ──
-- Guests that reserve a slot for an event: everyone except those belonging
-- to a party that explicitly declined. `p_exclude_party_id` lets a caller
-- exclude one party's own guests from the count (used by the response-update
-- trigger, since that party's guests are about to be (re)counted separately).
CREATE OR REPLACE FUNCTION count_reserved_guests(p_event_id UUID, p_exclude_party_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM guests g
  LEFT JOIN rsvp_parties p ON p.id = g.party_id
  WHERE g.event_id = p_event_id
    AND (p_exclude_party_id IS NULL OR g.party_id IS DISTINCT FROM p_exclude_party_id)
    AND COALESCE(p.response, 'pending') <> 'no';
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ── Re-point the existing INSERT trigger's function at the shared helper ──
-- (Same behavior as 005 — just refactored so both triggers share one rule.)
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
-- (Trigger trg_enforce_tier_guest_cap on `guests` already exists from 004 — untouched.)

-- ── New trigger: re-check the cap when a party leaves 'no' ──
CREATE OR REPLACE FUNCTION enforce_tier_guest_cap_on_response_update()
RETURNS TRIGGER AS $$
DECLARE
  v_cap INTEGER;
  v_count INTEGER;
  v_party_guest_count INTEGER;
BEGIN
  -- Only relevant when this party is moving OUT of 'no' — any other
  -- transition (yes<->maybe<->pending) doesn't change how many of its
  -- guests count, so there's nothing new to check.
  IF OLD.response IS DISTINCT FROM 'no' OR NEW.response = 'no' THEN
    RETURN NEW;
  END IF;

  SELECT tier_max_guests INTO v_cap FROM events WHERE id = NEW.event_id;
  IF v_cap IS NULL OR v_cap <= 0 THEN
    RETURN NEW;
  END IF;

  -- This party's own guests (all about to start counting again) plus every
  -- other already-reserved guest in the event.
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
