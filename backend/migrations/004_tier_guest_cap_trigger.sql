-- ═══════════════════════════════════════════════════════════════
-- Fancy RSVP — Phase 4 Database Migration
-- Enforce events.tier_max_guests as a hard cap on the `guests` table
-- ═══════════════════════════════════════════════════════════════
--
-- Context: tier_max_guests was already being stored on `events` (set at
-- checkout/manual-payment fulfillment and by the admin's "Grant Free Event"
-- action) and displayed in the dashboard ("Up to X guests"), but nothing in
-- the application layer actually rejected new guests once the cap was
-- reached — it was a display-only number.
--
-- All guest-creation paths (public RSVP submission, organizer manual add,
-- CSV/Excel import) go through Postgres RPCs (submit_rsvp_v2,
-- add_guest_to_party) that ultimately insert into the `guests` table. A
-- BEFORE INSERT trigger on `guests` enforces the cap at the lowest level,
-- inside the same transaction as the insert — so it's atomic and immune to
-- the race-condition problem a JS-side pre-check would have (the same
-- reason table/seating capacity is checked inside its own RPC rather than
-- pre-checked in Node).
--
-- NULL or <= 0 tier_max_guests means "unlimited" — matches how the value is
-- already treated everywhere else in the app (adminController.js,
-- eventController.js, EventsTab.js).
--
-- This raises a plain Postgres exception (not the `{success:false,
-- error:'GUEST_LIMIT_REACHED'}` structured-result pattern the RPCs use for
-- other business-rule failures) because we don't have the current RPC
-- bodies to edit them in place. The backend has a matching catch-block
-- mapping (rsvpController.js) that turns this specific error into a clean
-- 409 GUEST_LIMIT_REACHED response — see backend/utils/responseEnvelope.js,
-- which already reserves that exact error code.

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

  -- +1 for the row about to be inserted (BEFORE INSERT — NEW isn't committed yet).
  SELECT COUNT(*) INTO v_count FROM guests WHERE event_id = NEW.event_id;

  IF v_count + 1 > v_cap THEN
    RAISE EXCEPTION 'GUEST_LIMIT_REACHED: This event''s plan allows up to % guests (currently %).', v_cap, v_count
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
