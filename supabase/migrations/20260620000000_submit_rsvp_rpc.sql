-- ════════════════════════════════════════════════════════════════════════
-- submit_rsvp() — atomic, single-round-trip public RSVP write
-- ────────────────────────────────────────────────────────────────────────
-- Consolidates what submitPublicRSVP previously did as ~8–12 sequential
-- PostgREST round-trips (event lookup → meal-field lookup → duplicate check →
-- insert/update rsvp → child guest rows → custom answers → seating cleanup →
-- activity log) into ONE function call that runs as a single transaction.
--
-- Concurrency / integrity guarantees:
--   • Two simultaneous first-time RSVPs with the SAME email can't both land:
--     the partial unique index idx_rsvps_event_email_unique (event_id, email)
--     WHERE response <> 'no' makes the loser raise unique_violation, which we
--     translate to a clean DUPLICATE_RSVP result — never a second accepted row.
--   • Parent + child rows commit together or not at all (atomic).
--   • All gating (payment / review / deadline) and meal validation happen
--     inside the same transaction, so they can't be raced past.
--
-- Returns JSONB: on success the event/org context the caller needs to fire
-- emails + the realtime broadcast WITHOUT any extra reads; on failure a
-- { success:false, code, message } the controller maps to an HTTP status.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- These columns are written by the RSVP flow but were never added by a
-- migration (only present on hand-patched databases). Formalise them so a fresh
-- DB — and submit_rsvp — work correctly.
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS decline_reason   TEXT;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS maybe_confirm_by TEXT;

CREATE OR REPLACE FUNCTION public.submit_rsvp(
  p_slug              TEXT,
  p_rsvp_id           UUID,
  p_guest_name        TEXT,
  p_email             TEXT,
  p_phone             TEXT,
  p_response          TEXT,
  p_party_size        INTEGER,
  p_notes             TEXT,
  p_primary_meal      TEXT,
  p_additional_guests JSONB,
  p_custom_answers    JSONB,
  p_decline_reason    TEXT,
  p_maybe_confirm_by  TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event           events%ROWTYPE;
  v_is_demo         BOOLEAN;
  v_party_size      INTEGER;
  v_norm_email      TEXT;
  v_existing_email  TEXT;
  v_rsvp_id         UUID;
  v_is_update       BOOLEAN := false;
  v_decline_reason  TEXT;
  v_maybe_confirm   TEXT;
  v_meal_options    JSONB;
  v_meal_required   BOOLEAN;
  v_has_meal_field  BOOLEAN := false;
  v_opt_count       INTEGER := 0;
  v_meal            TEXT;
  v_g               JSONB;
  i                 INTEGER;
  v_org_email       TEXT;
  v_org_name        TEXT;
  v_org_phone       TEXT;
BEGIN
  -- ── 1. Resolve the event by slug ──
  SELECT * INTO v_event FROM events WHERE slug = p_slug;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Event not found.');
  END IF;

  v_is_demo := (v_event.slug = 'demo');

  -- ── 2. Gating: payment / review / deadline (demo bypasses pay+review) ──
  IF NOT v_is_demo AND NOT COALESCE(v_event.is_paid, false) THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_REQUIRED',
      'message', 'This event page is inactive because payment has not been completed.');
  END IF;

  IF NOT v_is_demo AND v_event.status = 'pending_review' THEN
    RETURN jsonb_build_object('success', false, 'code', 'EVENT_UNDER_REVIEW',
      'message', 'This event is awaiting review and is not accepting RSVPs yet.');
  END IF;

  IF v_event.rsvp_deadline IS NOT NULL AND now() > v_event.rsvp_deadline THEN
    RETURN jsonb_build_object('success', false, 'code', 'DEADLINE_PASSED',
      'message', 'The RSVP deadline for this event has passed.');
  END IF;

  -- ── 3. Normalise inputs ──
  v_party_size := CASE WHEN p_response = 'yes' THEN COALESCE(p_party_size, 1) ELSE 1 END;
  IF v_party_size < 1 OR v_party_size > 20 THEN
    RETURN jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'partySize must be between 1 and 20.');
  END IF;

  v_norm_email := NULLIF(lower(btrim(COALESCE(p_email, ''))), '');
  v_decline_reason := CASE WHEN p_response = 'no'    THEN NULLIF(p_decline_reason, '')   ELSE NULL END;
  v_maybe_confirm  := CASE WHEN p_response = 'maybe' THEN NULLIF(p_maybe_confirm_by, '') ELSE NULL END;

  -- ── 4. Meal validation (attending only), against the meal_selection field ──
  IF p_response = 'yes' THEN
    SELECT options, COALESCE(is_required, false)
      INTO v_meal_options, v_meal_required
      FROM rsvp_form_fields
     WHERE event_id = v_event.id AND field_key = 'meal_selection'
     LIMIT 1;
    v_has_meal_field := FOUND;

    IF v_has_meal_field THEN
      v_opt_count := jsonb_array_length(COALESCE(v_meal_options, '[]'::jsonb));

      IF v_opt_count > 0 OR v_meal_required THEN
        -- primary guest
        IF v_meal_required AND NULLIF(btrim(COALESCE(p_primary_meal, '')), '') IS NULL THEN
          RETURN jsonb_build_object('success', false, 'code', 'MEAL_REQUIRED',
            'message', 'Meal selection is required for the primary guest.');
        END IF;
        IF NULLIF(p_primary_meal, '') IS NOT NULL AND v_opt_count > 0
           AND NOT (v_meal_options ? p_primary_meal) THEN
          RETURN jsonb_build_object('success', false, 'code', 'MEAL_INVALID',
            'message', format('Meal selection ''%s'' is invalid.', p_primary_meal));
        END IF;

        -- additional guests (#2..#party_size)
        IF v_party_size > 1 THEN
          FOR i IN 0..(v_party_size - 2) LOOP
            v_g := p_additional_guests -> i;
            v_meal := NULLIF(btrim(COALESCE(v_g ->> 'mealSelection', '')), '');
            IF v_meal_required AND v_meal IS NULL THEN
              RETURN jsonb_build_object('success', false, 'code', 'MEAL_REQUIRED',
                'message', format('Meal selection is required for Guest #%s.', i + 2));
            END IF;
            IF v_meal IS NOT NULL AND v_opt_count > 0 AND NOT (v_meal_options ? v_meal) THEN
              RETURN jsonb_build_object('success', false, 'code', 'MEAL_INVALID',
                'message', format('Meal selection ''%s'' for Guest #%s is invalid.', v_meal, i + 2));
            END IF;
          END LOOP;
        END IF;
      END IF;
    END IF;
  END IF;

  -- ── 5. Insert or update the RSVP ──
  IF p_rsvp_id IS NOT NULL THEN
    -- UPDATE path: ownership check by email match.
    SELECT email INTO v_existing_email FROM rsvps WHERE id = p_rsvp_id AND event_id = v_event.id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'code', 'RSVP_NOT_FOUND', 'message', 'The RSVP record was not found.');
    END IF;
    IF NULLIF(v_existing_email, '') IS NOT NULL THEN
      IF v_norm_email IS NULL OR lower(v_existing_email) <> v_norm_email THEN
        RETURN jsonb_build_object('success', false, 'code', 'RSVP_OWNERSHIP_FAILED',
          'message', 'Email does not match the original RSVP submission. You cannot modify this RSVP.');
      END IF;
    END IF;

    UPDATE rsvps SET
      guest_name = p_guest_name, email = v_norm_email, phone = p_phone, response = p_response,
      party_size = v_party_size, notes = p_notes, decline_reason = v_decline_reason,
      maybe_confirm_by = v_maybe_confirm, response_source = 'web_form', rsvp_at = now(), updated_at = now()
    WHERE id = p_rsvp_id AND event_id = v_event.id;

    v_rsvp_id := p_rsvp_id;
    v_is_update := true;

    DELETE FROM rsvp_guests   WHERE rsvp_id = v_rsvp_id;
    DELETE FROM custom_answers WHERE rsvp_id = v_rsvp_id;
    IF p_response = 'no' THEN
      DELETE FROM seating_assignments WHERE rsvp_id = v_rsvp_id;
    END IF;
  ELSE
    -- INSERT path: duplicate-email guard + unique-index backstop.
    IF v_norm_email IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM rsvps WHERE event_id = v_event.id AND lower(email) = v_norm_email AND response <> 'no') THEN
        RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_RSVP',
          'message', 'An RSVP with this email already exists for this event.');
      END IF;
    END IF;

    BEGIN
      INSERT INTO rsvps (event_id, guest_name, email, phone, response, party_size, notes,
                         decline_reason, maybe_confirm_by, response_source, rsvp_at)
      VALUES (v_event.id, p_guest_name, v_norm_email, p_phone, p_response, v_party_size, p_notes,
              v_decline_reason, v_maybe_confirm, 'web_form', now())
      RETURNING id INTO v_rsvp_id;
    EXCEPTION WHEN unique_violation THEN
      -- A concurrent first-time RSVP with the same email won the race.
      RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_RSVP',
        'message', 'An RSVP with this email already exists for this event.');
    END;
  END IF;

  -- ── 6. Child rows (attending only) ──
  IF p_response = 'yes' THEN
    INSERT INTO rsvp_guests (rsvp_id, full_name, is_primary, meal_selection)
    VALUES (v_rsvp_id, p_guest_name, true, NULLIF(p_primary_meal, ''));

    INSERT INTO rsvp_guests (rsvp_id, full_name, is_primary, meal_selection, dietary_notes)
    SELECT v_rsvp_id, g ->> 'fullName', false, NULLIF(g ->> 'mealSelection', ''), NULLIF(g ->> 'dietaryNotes', '')
    FROM jsonb_array_elements(COALESCE(p_additional_guests, '[]'::jsonb)) AS g
    WHERE COALESCE(btrim(g ->> 'fullName'), '') <> '';

    INSERT INTO custom_answers (rsvp_id, field_id, answer_value)
    SELECT v_rsvp_id, (a ->> 'fieldId')::uuid, a ->> 'value'
    FROM jsonb_array_elements(COALESCE(p_custom_answers, '[]'::jsonb)) AS a
    WHERE COALESCE(a ->> 'fieldId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  END IF;

  -- ── 7. Activity log (public submit — no actor) ──
  INSERT INTO activity_logs (event_id, action, entity_type, entity_id, metadata)
  VALUES (v_event.id, 'rsvp_submitted', 'rsvp', v_rsvp_id,
          jsonb_build_object('guest_name', p_guest_name, 'response', p_response, 'party_size', v_party_size));

  -- ── 8. Org contact for the caller's notification/email (no extra round-trip) ──
  SELECT email, name, phone INTO v_org_email, v_org_name, v_org_phone
  FROM organizations WHERE id = v_event.org_id;

  RETURN jsonb_build_object(
    'success', true,
    'rsvp_id', v_rsvp_id,
    'is_update', v_is_update,
    'event_id', v_event.id,
    'event_title', v_event.title,
    'event_date', v_event.event_date,
    'event_slug', v_event.slug,
    'response', p_response,
    'party_size', v_party_size,
    'guest_email', v_norm_email,
    'notification_preferences', v_event.notification_preferences,
    'org_email', v_org_email,
    'org_name', v_org_name,
    'org_phone', v_org_phone
  );
END;
$$;

-- Called by the backend with the service role only.
REVOKE ALL ON FUNCTION public.submit_rsvp(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT) FROM anon, authenticated;

COMMIT;
