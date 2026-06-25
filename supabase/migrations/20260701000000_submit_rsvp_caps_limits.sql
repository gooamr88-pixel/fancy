-- ════════════════════════════════════════════════════════════════════════
-- submit_rsvp() — row caps, guest-limit enforcement, status gating,
--                 field scoping, and optional guest self-edit
-- ────────────────────────────────────────────────────────────────────────
-- Supersedes 20260629000000_submit_rsvp_reject_resubmit.sql. Adds:
--   RF-1  Cap child-row inserts (additional guests → party_size-1; custom
--         answers → 50) and reject grossly oversized arrays. Closes an
--         unbounded-insert / storage-DoS vector on the public endpoint.
--   BIZ-1 Enforce the paid tier's guest cap (events.tier_max_guests; 0/NULL =
--         unlimited). Rejects the RSVP that would push committed headcount
--         (yes + maybe) past the cap with GUEST_LIMIT_REACHED.
--   INV-1 Gate guest RSVPs on status='active' (demo bypasses). A paused or
--         completed ("closed") event no longer silently accepts RSVPs.
--   SEC-8 custom_answers.field_id must belong to THIS event.
--   RF-2  events.allow_guest_edits: when true (and within deadline), a guest
--         may overwrite their own already-answered record via the web form.
-- Everything else is unchanged from the prior version.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- Host-controlled switch that re-opens the web-form update path for guests
-- who have already answered. Default false preserves the strict one-shot lock.
ALTER TABLE events ADD COLUMN IF NOT EXISTS allow_guest_edits BOOLEAN DEFAULT false;

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
  v_existing_resp   TEXT;
  v_found           BOOLEAN;
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
  v_committed       INTEGER;        -- BIZ-1: current yes+maybe headcount
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

  -- ── 2. Gating: payment / review / status / deadline (demo bypasses pay+review) ──
  IF NOT v_is_demo AND NOT COALESCE(v_event.is_paid, false) THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_REQUIRED',
      'message', 'This event page is inactive because payment has not been completed.');
  END IF;

  IF NOT v_is_demo AND v_event.status = 'pending_review' THEN
    RETURN jsonb_build_object('success', false, 'code', 'EVENT_UNDER_REVIEW',
      'message', 'This event is awaiting review and is not accepting RSVPs yet.');
  END IF;

  -- INV-1: a single "live for guests" rule — only an active (or demo) event
  -- accepts RSVPs. paused / completed ("Close Event") now truly closes RSVPs.
  IF NOT v_is_demo AND v_event.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'code', 'EVENT_CLOSED',
      'message', 'This event is no longer accepting RSVPs.');
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

  -- RF-1: reject grossly oversized arrays outright (defence-in-depth; the child
  -- inserts below are also hard-capped). Party size tops out at 20, so a sane
  -- additional-guests array is < 20 and custom answers < ~50.
  IF jsonb_typeof(p_additional_guests) = 'array' AND jsonb_array_length(p_additional_guests) > 100 THEN
    RETURN jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Too many additional guests submitted.');
  END IF;
  IF jsonb_typeof(p_custom_answers) = 'array' AND jsonb_array_length(p_custom_answers) > 200 THEN
    RETURN jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Too many custom answers submitted.');
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

  -- ── 4b. BIZ-1: enforce the paid tier's guest cap (0/NULL = unlimited) ──
  -- Only attending/tentative responses consume headcount. On the update path we
  -- exclude this RSVP's current contribution so editing one's own party doesn't
  -- false-trip the cap.
  IF NOT v_is_demo AND COALESCE(v_event.tier_max_guests, 0) > 0 AND p_response IN ('yes', 'maybe') THEN
    SELECT COALESCE(SUM(party_size), 0) INTO v_committed
      FROM rsvps
     WHERE event_id = v_event.id
       AND response IN ('yes', 'maybe')
       AND (p_rsvp_id IS NULL OR id <> p_rsvp_id);
    IF v_committed + v_party_size > v_event.tier_max_guests THEN
      RETURN jsonb_build_object('success', false, 'code', 'GUEST_LIMIT_REACHED',
        'message', 'This event has reached its guest limit. Please contact the host.');
    END IF;
  END IF;

  -- ── 5. Insert or update the RSVP ──
  IF p_rsvp_id IS NOT NULL THEN
    -- UPDATE path: ownership check by email match.
    SELECT email, response INTO v_existing_email, v_existing_resp
    FROM rsvps WHERE id = p_rsvp_id AND event_id = v_event.id;
    v_found := FOUND;
    IF NOT v_found THEN
      RETURN jsonb_build_object('success', false, 'code', 'RSVP_NOT_FOUND', 'message', 'The RSVP record was not found.');
    END IF;

    -- Strict, state-aware lock: once answered, the record is closed to further
    -- public submissions — UNLESS the host enabled guest self-edits (RF-2), in
    -- which case the guest may overwrite their own response while RSVPs are open.
    IF v_existing_resp IN ('yes', 'no', 'maybe') AND NOT COALESCE(v_event.allow_guest_edits, false) THEN
      RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_RSVP',
        'message', 'You have already responded to this invitation.');
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
      RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_RSVP',
        'message', 'An RSVP with this email already exists for this event.');
    END;
  END IF;

  -- ── 6. Child rows (attending only) — HARD CAPPED (RF-1) ──
  IF p_response = 'yes' THEN
    INSERT INTO rsvp_guests (rsvp_id, full_name, is_primary, meal_selection)
    VALUES (v_rsvp_id, p_guest_name, true, NULLIF(p_primary_meal, ''));

    -- Only the first (party_size - 1) named additional guests are persisted, no
    -- matter how many the payload carried.
    INSERT INTO rsvp_guests (rsvp_id, full_name, is_primary, meal_selection, dietary_notes)
    SELECT v_rsvp_id, g.elem ->> 'fullName', false,
           NULLIF(g.elem ->> 'mealSelection', ''), NULLIF(g.elem ->> 'dietaryNotes', '')
    FROM jsonb_array_elements(COALESCE(p_additional_guests, '[]'::jsonb)) WITH ORDINALITY AS g(elem, ord)
    WHERE COALESCE(btrim(g.elem ->> 'fullName'), '') <> ''
      AND g.ord <= GREATEST(v_party_size - 1, 0);

    -- Custom answers: capped to 50, and each field_id must belong to THIS event (SEC-8).
    INSERT INTO custom_answers (rsvp_id, field_id, answer_value)
    SELECT v_rsvp_id, (a.elem ->> 'fieldId')::uuid, a.elem ->> 'value'
    FROM jsonb_array_elements(COALESCE(p_custom_answers, '[]'::jsonb)) WITH ORDINALITY AS a(elem, ord)
    WHERE COALESCE(a.elem ->> 'fieldId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND a.ord <= 50
      AND EXISTS (
        SELECT 1 FROM rsvp_form_fields f
         WHERE f.id = (a.elem ->> 'fieldId')::uuid AND f.event_id = v_event.id
      );
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
