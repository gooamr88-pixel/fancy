-- ════════════════════════════════════════════════════════════════════════
-- Instant seating reveal for organizer-added guests
-- ────────────────────────────────────────────────────────────────────────
-- Guest-facing seating (table search + seating map) has always been hidden
-- until exactly 24 hours before the event, regardless of who added the
-- guest or when the organizer finished the seating chart. The organizer
-- wants guests they specifically added (via CSV import or the "Add Guest"
-- modal) to see their assigned table immediately, since that party's
-- identity/contact info is already confirmed by the organizer — the 24h
-- wait only makes sense for genuinely self-serve public-link RSVPs.
--
-- Adds an immutable `created_by_organizer` flag, set once at row creation:
--   - true  when the party is created via add_guest_to_party (organizer
--     "Add Guest" modal AND CSV import both call this same RPC)
--   - false (the column default) when the party is created via
--     submit_rsvp_v2 (self-serve public RSVP) — that function needs no
--     changes at all, the DEFAULT already gives the correct value.
-- Deliberately NOT reusing rsvp_parties.response_source ('manual' vs
-- 'web_form') for this — that column reflects how the response was LAST
-- recorded, and gets overwritten to 'web_form' the moment an organizer-
-- added guest submits their own response, which would silently revoke
-- their instant-reveal access the moment they RSVP. This new column is
-- never touched by any UPDATE, so it stays true for the life of the party.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.rsvp_parties ADD COLUMN IF NOT EXISTS created_by_organizer BOOLEAN NOT NULL DEFAULT false;

-- add_guest_to_party: no signature change, only the fresh-party INSERT
-- gains created_by_organizer = true. Body otherwise byte-for-byte identical
-- to 20260714000000_guest_side_tagging.sql's version.
CREATE OR REPLACE FUNCTION public.add_guest_to_party(
  p_event_id  UUID,
  p_actor     UUID,
  p_full_name TEXT,
  p_party_id  UUID DEFAULT NULL,
  p_phone     TEXT DEFAULT NULL,
  p_email     TEXT DEFAULT NULL,
  p_response  TEXT DEFAULT 'pending',
  p_side      TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_party_id   UUID;
  v_guest_id   UUID;
  v_is_primary BOOLEAN;
  v_created_party BOOLEAN := false;
  v_event      events%ROWTYPE;
  v_committed  INTEGER;
BEGIN
  IF NOT public._is_event_authorized(p_event_id, p_actor) THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'You are not authorized to manage guests for this event.');
  END IF;

  IF p_party_id IS NULL AND NULLIF(btrim(COALESCE(p_phone, '')), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'A phone number is required for the primary contact.');
  END IF;

  -- BIZ-1: enforce the paid tier's guest cap (0/NULL = unlimited), mirroring
  -- submit_rsvp_v2 — organizer manual-add/import previously had zero
  -- enforcement here, letting a plan's guest limit be bypassed entirely via
  -- the dashboard. Same advisory-lock key as submit_rsvp_v2 so the two paths
  -- serialise against each other too.
  IF p_response IN ('yes', 'maybe') THEN
    SELECT * INTO v_event FROM events WHERE id = p_event_id;
    IF FOUND AND v_event.slug <> 'demo' AND COALESCE(v_event.tier_max_guests, 0) > 0 THEN
      PERFORM pg_advisory_xact_lock(hashtext('rsvp_submit:' || p_event_id::text));
      SELECT COALESCE(SUM(gc.cnt), 0) INTO v_committed
      FROM rsvp_parties p
      JOIN LATERAL (SELECT COUNT(*) AS cnt FROM guests g WHERE g.party_id = p.id) gc ON true
      WHERE p.event_id = p_event_id AND p.response IN ('yes', 'maybe');
      IF v_committed + 1 > v_event.tier_max_guests THEN
        RETURN jsonb_build_object('success', false, 'error', 'GUEST_LIMIT_REACHED',
          'message', 'This event has reached its plan''s guest limit.');
      END IF;
    END IF;
  END IF;

  IF p_party_id IS NULL THEN
    INSERT INTO rsvp_parties (event_id, label, response, response_source, side, created_by_organizer)
    VALUES (p_event_id, p_full_name, p_response::rsvp_response_type, 'manual',
            CASE WHEN p_side IN ('partner1', 'partner2') THEN p_side END, true)
    RETURNING id INTO v_party_id;
    v_is_primary := true;
    v_created_party := true;
  ELSE
    SELECT id INTO v_party_id FROM rsvp_parties WHERE id = p_party_id AND event_id = p_event_id;
    IF v_party_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'RSVP_NOT_FOUND', 'message', 'Party not found.');
    END IF;
    v_is_primary := false;
  END IF;

  BEGIN
    INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact)
    VALUES (v_party_id, p_event_id, p_full_name, NULLIF(lower(btrim(COALESCE(p_email, ''))), ''), p_phone, v_is_primary)
    RETURNING id INTO v_guest_id;
  EXCEPTION WHEN unique_violation THEN
    IF v_created_party THEN
      DELETE FROM rsvp_parties WHERE id = v_party_id;
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_GUEST', 'message', 'A guest with this email or phone already exists for this event.');
  END;

  INSERT INTO activity_logs (event_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (p_event_id, p_actor, 'guest_added_manually', 'guest', v_guest_id,
          jsonb_build_object('party_id', v_party_id, 'full_name', p_full_name));

  RETURN jsonb_build_object('success', true, 'party_id', v_party_id, 'guest_id', v_guest_id);
END;
$$;
