-- ════════════════════════════════════════════════════════════════════════
-- update_party_response (the one-click email RSVP link) never enforced the
-- paid tier's guest cap (events.tier_max_guests) when growing a party's size
-- via p_party_size — only submit_rsvp_v2 (the full wizard) did. A guest could
-- reply "Attending, party of 20" from the email button and bypass the cap
-- entirely. This mirrors submit_rsvp_v2's BIZ-1 check: same advisory-lock
-- key (so both paths serialise against each other), same demo-event bypass,
-- same 0/NULL = unlimited semantics.
-- ════════════════════════════════════════════════════════════════════════

-- Adding the trailing p_additional_guests param still changes the function's
-- argument-type signature as far as Postgres/PostgREST overload resolution
-- is concerned, so the old 6-arg signature is dropped explicitly first (same
-- convention as 20260714000000_guest_side_tagging.sql) to avoid two
-- ambiguous overloads of the same function name.
DROP FUNCTION IF EXISTS public.update_party_response(UUID, UUID, TEXT, INTEGER, TEXT, TEXT);

CREATE FUNCTION public.update_party_response(
  p_event_id    UUID,
  p_party_id    UUID,
  p_response    TEXT,
  p_party_size  INTEGER DEFAULT NULL,
  p_actor       TEXT DEFAULT 'guest',
  p_source      TEXT DEFAULT NULL,
  p_additional_guests JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_resp rsvp_response_type;
  v_current_count INTEGER;
  v_target_size   INTEGER;
  v_event         events%ROWTYPE;
  v_committed     INTEGER;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Event not found.');
  END IF;

  SELECT response INTO v_existing_resp FROM rsvp_parties WHERE id = p_party_id AND event_id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'RSVP_NOT_FOUND', 'message', 'The RSVP record was not found.');
  END IF;

  IF p_actor = 'guest' AND v_existing_resp IN ('yes', 'no', 'maybe') THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_RESPONDED',
      'message', 'You have already responded to this invitation.');
  END IF;

  -- BIZ-1: enforce the paid tier's guest cap (0/NULL = unlimited). The
  -- resulting party size is p_party_size if provided, else whatever the
  -- party's guest count already is (this RPC doesn't touch guest rows unless
  -- p_party_size is supplied — see below).
  IF p_response IN ('yes', 'maybe') AND v_event.slug <> 'demo' AND COALESCE(v_event.tier_max_guests, 0) > 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext('rsvp_submit:' || p_event_id::text));
    SELECT COUNT(*) INTO v_current_count FROM guests WHERE party_id = p_party_id;
    v_target_size := CASE WHEN p_party_size IS NOT NULL
      THEN LEAST(GREATEST(p_party_size, 1), 20)
      ELSE GREATEST(v_current_count, 1)
    END;
    SELECT COALESCE(SUM(gc.cnt), 0) INTO v_committed
    FROM rsvp_parties p
    JOIN LATERAL (SELECT COUNT(*) AS cnt FROM guests g WHERE g.party_id = p.id) gc ON true
    WHERE p.event_id = p_event_id AND p.response IN ('yes', 'maybe') AND p.id <> p_party_id;
    IF v_committed + v_target_size > v_event.tier_max_guests THEN
      RETURN jsonb_build_object('success', false, 'code', 'GUEST_LIMIT_REACHED',
        'message', 'This event has reached its guest limit. Please contact the host.');
    END IF;
  END IF;

  UPDATE rsvp_parties SET
    response = p_response::rsvp_response_type,
    response_source = COALESCE(p_source, response_source),
    responded_at = now(),
    updated_at = now()
  WHERE id = p_party_id AND event_id = p_event_id;

  IF p_response = 'yes' AND p_party_size IS NOT NULL THEN
    v_target_size := LEAST(GREATEST(p_party_size, 1), 20);
    SELECT COUNT(*) INTO v_current_count FROM guests WHERE party_id = p_party_id;

    IF v_target_size > v_current_count THEN
      -- QuickConfirm (the one-click email-link flow) optionally collects a
      -- name-only list for the extra party members instead of the fully
      -- detailed companion form the public wizard uses — fall back to the
      -- generic "Guest N" placeholder for any slot it didn't provide a name for.
      INSERT INTO guests (party_id, event_id, full_name, is_primary_contact)
      SELECT p_party_id, p_event_id,
             COALESCE(NULLIF(btrim(g.elem ->> 'fullName'), ''), 'Guest ' || gs),
             false
      FROM generate_series(v_current_count + 1, v_target_size) gs
      LEFT JOIN LATERAL (
        SELECT elem FROM jsonb_array_elements(COALESCE(p_additional_guests, '[]'::jsonb)) WITH ORDINALITY AS a(elem, ord)
        WHERE a.ord = gs - v_current_count
      ) g ON true;
    ELSIF v_target_size < v_current_count THEN
      DELETE FROM guests WHERE id IN (
        SELECT id FROM guests
        WHERE party_id = p_party_id AND is_primary_contact = false
        ORDER BY created_at DESC
        LIMIT (v_current_count - v_target_size)
      );
    END IF;
  END IF;

  INSERT INTO activity_logs (event_id, action, entity_type, entity_id, metadata)
  VALUES (p_event_id, 'rsvp_responded_via_token', 'rsvp_party', p_party_id,
          jsonb_build_object('response', p_response, 'actor', p_actor));

  RETURN jsonb_build_object('success', true, 'party_id', p_party_id, 'response', p_response);
END;
$$;

REVOKE ALL ON FUNCTION public.update_party_response(UUID, UUID, TEXT, INTEGER, TEXT, TEXT, JSONB) FROM anon, authenticated;
