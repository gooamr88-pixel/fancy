-- ════════════════════════════════════════════════════════════════════════
-- Companion detail fields
-- ────────────────────────────────────────────────────────────────────────
-- The public RSVP form distinguishes the host (primary contact) from their
-- companions and collects extra per-companion details so the organizer can
-- plan seating, catering and arrivals: age group (adult/teen/child/infant),
-- per-person phone, relationship to the host (spouse/child/parent/...),
-- and gender. Phone already existed on guests — we add the other three and
-- thread them through submit_rsvp_v2's companion-insert path.
--
-- Backwards compatibility: all three columns are nullable, so existing rows
-- and any older clients that still POST without these keys keep working.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS age_group   TEXT,
  ADD COLUMN IF NOT EXISTS relationship TEXT,
  ADD COLUMN IF NOT EXISTS gender      TEXT;

-- Lightweight value guards. Free text is rejected so we always get clean
-- segmentation buckets in the dashboard exports/charts, but the buckets are
-- intentionally broad so they cover every real-world wedding/event need.
ALTER TABLE public.guests
  DROP CONSTRAINT IF EXISTS guests_age_group_check;
ALTER TABLE public.guests
  ADD CONSTRAINT guests_age_group_check
  CHECK (age_group IS NULL OR age_group IN ('adult', 'teen', 'child', 'infant'));

ALTER TABLE public.guests
  DROP CONSTRAINT IF EXISTS guests_gender_check;
ALTER TABLE public.guests
  ADD CONSTRAINT guests_gender_check
  CHECK (gender IS NULL OR gender IN ('male', 'female'));

-- Relationship stays free-text (UI provides a curated dropdown + "other"),
-- but cap the length so a runaway client can't store essays.
ALTER TABLE public.guests
  DROP CONSTRAINT IF EXISTS guests_relationship_length_check;
ALTER TABLE public.guests
  ADD CONSTRAINT guests_relationship_length_check
  CHECK (relationship IS NULL OR length(relationship) <= 60);


-- ────────────────────────────────────────────────────────────────────────
-- Relax the (event_id, phone) unique index to primary contacts only.
-- The dedup story it was protecting (no two RSVPs for the same person) is
-- about primary contacts (auto-merge in step 5 already uses is_primary_contact
-- + phone). Companions can legitimately share a phone with the host (a parent
-- adding a child whose only contact number IS the parent's), and two minors
-- inside a single party often have no phone or share a household number — so
-- the global uniqueness was producing false-positive insert failures that
-- would roll back the entire RSVP submission. Now scoped to primary contacts.
-- ────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_guests_event_phone_unique;
CREATE UNIQUE INDEX idx_guests_event_phone_unique
  ON public.guests USING btree (event_id, phone)
  WHERE (phone IS NOT NULL AND is_primary_contact = true);


-- ════════════════════════════════════════════════════════════════════════
-- submit_rsvp_v2: persist the new fields for each additional guest.
-- Everything else in the function is byte-for-byte identical to the
-- 20260710 migration — only the companion INSERT in step 6 changes.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.submit_rsvp_v2(
  p_slug              TEXT,
  p_party_id          UUID,
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
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event           events%ROWTYPE;
  v_is_demo         BOOLEAN;
  v_party_size      INTEGER;
  v_norm_email      TEXT;
  v_existing_email  TEXT;
  v_existing_resp   rsvp_response_type;
  v_party_id        UUID;
  v_is_update       BOOLEAN := false;
  v_decline_reason  TEXT;
  v_maybe_confirm   TEXT;
  v_meal_options    JSONB;
  v_meal_required   BOOLEAN;
  v_has_meal_field  BOOLEAN := false;
  v_opt_count       INTEGER := 0;
  v_meal            TEXT;
  v_g               JSONB;
  v_a               JSONB;
  v_bad_field_id    TEXT;
  i                 INTEGER;
  v_committed       INTEGER;
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

  PERFORM pg_advisory_xact_lock(hashtext('rsvp_submit:' || v_event.id::text));

  -- ── 2. Gating: payment / review / status / deadline ──
  IF NOT v_is_demo AND NOT COALESCE(v_event.is_paid, false) THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_REQUIRED',
      'message', 'This event page is inactive because payment has not been completed.');
  END IF;
  IF NOT v_is_demo AND v_event.status = 'pending_review' THEN
    RETURN jsonb_build_object('success', false, 'code', 'EVENT_UNDER_REVIEW',
      'message', 'This event is awaiting review and is not accepting RSVPs yet.');
  END IF;
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

  IF jsonb_typeof(p_additional_guests) = 'array' AND jsonb_array_length(p_additional_guests) > 100 THEN
    RETURN jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Too many additional guests submitted.');
  END IF;
  IF jsonb_typeof(p_custom_answers) = 'array' AND jsonb_array_length(p_custom_answers) > 200 THEN
    RETURN jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Too many custom answers submitted.');
  END IF;

  IF p_response = 'yes' AND jsonb_typeof(p_custom_answers) = 'array' THEN
    FOR v_a IN SELECT * FROM jsonb_array_elements(p_custom_answers) LOOP
      v_bad_field_id := v_a ->> 'fieldId';
      IF COALESCE(v_bad_field_id, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN jsonb_build_object('success', false, 'code', 'CUSTOM_ANSWER_INVALID',
          'message', 'One of your answers could not be matched to a question on this form. Please refresh the page and try again.');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM custom_form_fields f WHERE f.id = v_bad_field_id::uuid AND f.event_id = v_event.id) THEN
        RETURN jsonb_build_object('success', false, 'code', 'CUSTOM_ANSWER_INVALID',
          'message', 'One of your answers could not be matched to a question on this form. Please refresh the page and try again.');
      END IF;
    END LOOP;
  END IF;

  v_norm_email     := NULLIF(lower(btrim(COALESCE(p_email, ''))), '');
  v_decline_reason := CASE WHEN p_response = 'no'    THEN NULLIF(p_decline_reason, '')   ELSE NULL END;
  v_maybe_confirm  := CASE WHEN p_response = 'maybe' THEN NULLIF(p_maybe_confirm_by, '') ELSE NULL END;

  -- ── 4. Meal field gating (yes-path only) ──
  SELECT
    options, COALESCE(is_required, false)
  INTO v_meal_options, v_meal_required
  FROM custom_form_fields
   WHERE event_id = v_event.id AND field_key = 'meal_selection'
   LIMIT 1;
  v_has_meal_field := FOUND;

  IF v_has_meal_field AND v_meal_options IS NOT NULL AND jsonb_typeof(v_meal_options) = 'array' THEN
    v_opt_count := jsonb_array_length(v_meal_options);
  END IF;

  IF p_response = 'yes' AND v_has_meal_field AND v_meal_required THEN
    IF v_opt_count > 0 AND COALESCE(btrim(p_primary_meal), '') = '' THEN
      RETURN jsonb_build_object('success', false, 'code', 'MEAL_REQUIRED',
        'message', 'Please choose a meal for the primary guest.');
    END IF;

    IF v_opt_count > 0 AND jsonb_typeof(p_additional_guests) = 'array' THEN
      i := 0;
      FOR v_g IN SELECT * FROM jsonb_array_elements(p_additional_guests) LOOP
        i := i + 1;
        IF i > v_party_size - 1 THEN EXIT; END IF;
        IF COALESCE(btrim(v_g ->> 'mealSelection'), '') = '' THEN
          RETURN jsonb_build_object('success', false, 'code', 'MEAL_REQUIRED',
            'message', 'Please choose a meal for every guest.');
        END IF;
      END LOOP;
    END IF;
  END IF;

  IF p_response = 'yes' AND v_has_meal_field AND v_opt_count > 0 THEN
    IF COALESCE(btrim(p_primary_meal), '') <> ''
       AND NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(v_meal_options) o WHERE o = p_primary_meal
       )
    THEN
      RETURN jsonb_build_object('success', false, 'code', 'INVALID_MEAL',
        'message', 'The selected meal option is not available for this event.');
    END IF;

    IF jsonb_typeof(p_additional_guests) = 'array' THEN
      i := 0;
      FOR v_g IN SELECT * FROM jsonb_array_elements(p_additional_guests) LOOP
        i := i + 1;
        IF i > v_party_size - 1 THEN EXIT; END IF;
        v_meal := v_g ->> 'mealSelection';
        IF COALESCE(btrim(v_meal), '') <> ''
           AND NOT EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(v_meal_options) o WHERE o = v_meal
           )
        THEN
          RETURN jsonb_build_object('success', false, 'code', 'INVALID_MEAL',
            'message', 'One of the selected meal options is not available for this event.');
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- ── 5. Capacity check (attending only, INSERT path only) ──
  IF p_response = 'yes' AND p_party_id IS NULL AND v_event.guest_limit IS NOT NULL THEN
    SELECT COALESCE(SUM(
        CASE WHEN p.response = 'yes' THEN COALESCE((SELECT COUNT(*) FROM guests gg WHERE gg.party_id = p.id), 1)
             ELSE 0 END
      ), 0)
      INTO v_committed
      FROM rsvp_parties p
     WHERE p.event_id = v_event.id;

    IF v_committed + v_party_size > v_event.guest_limit THEN
      RETURN jsonb_build_object('success', false, 'code', 'GUEST_LIMIT_EXCEEDED',
        'message', 'This event has reached its guest capacity.');
    END IF;
  END IF;

  -- ── 6. UPSERT party row ──
  IF p_party_id IS NOT NULL THEN
    -- UPDATE path
    SELECT response INTO v_existing_resp FROM rsvp_parties WHERE id = p_party_id AND event_id = v_event.id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'RSVP record not found.');
    END IF;
    IF v_existing_resp IN ('yes', 'no', 'maybe') AND NOT COALESCE(v_event.allow_guest_edits, false) THEN
      RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_RSVP',
        'message', 'You have already responded to this invitation.');
    END IF;

    SELECT email INTO v_existing_email FROM guests WHERE party_id = p_party_id AND is_primary_contact = true;

    UPDATE rsvp_parties SET
      label = p_guest_name, response = p_response::rsvp_response_type, notes = p_notes,
      decline_reason = v_decline_reason, maybe_confirm_by = v_maybe_confirm,
      response_source = 'web_form', responded_at = now(), updated_at = now()
    WHERE id = p_party_id AND event_id = v_event.id;
    v_is_update := true;
    v_party_id := p_party_id;

    DELETE FROM guests WHERE party_id = v_party_id;
    DELETE FROM custom_answers WHERE party_id = v_party_id;
    IF p_response = 'no' THEN
      DELETE FROM seating_assignments WHERE party_id = v_party_id;
    END IF;

    INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection)
    VALUES (v_party_id, v_event.id, p_guest_name, COALESCE(v_norm_email, v_existing_email), p_phone, true,
            CASE WHEN p_response = 'yes' THEN NULLIF(p_primary_meal, '') ELSE NULL END);
  ELSE
    -- INSERT path: duplicate-email auto-merge
    IF v_norm_email IS NOT NULL THEN
      SELECT p.id, p.response INTO v_party_id, v_existing_resp FROM guests g JOIN rsvp_parties p ON p.id = g.party_id
        WHERE p.event_id = v_event.id AND g.is_primary_contact AND lower(g.email) = v_norm_email AND p.response <> 'no'
        LIMIT 1;
      IF v_party_id IS NOT NULL THEN
        IF v_existing_resp IN ('yes', 'no', 'maybe') AND NOT COALESCE(v_event.allow_guest_edits, false) THEN
          RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_RSVP',
            'message', 'You have already responded to this invitation.');
        END IF;
        UPDATE rsvp_parties SET
          label = p_guest_name, response = p_response::rsvp_response_type, notes = p_notes,
          decline_reason = v_decline_reason, maybe_confirm_by = v_maybe_confirm,
          response_source = 'web_form', responded_at = now(), updated_at = now()
        WHERE id = v_party_id AND event_id = v_event.id;
        v_is_update := true;
        DELETE FROM guests WHERE party_id = v_party_id;
        DELETE FROM custom_answers WHERE party_id = v_party_id;
        IF p_response = 'no' THEN
          DELETE FROM seating_assignments WHERE party_id = v_party_id;
        END IF;
      END IF;
    END IF;

    -- INSERT path: duplicate-phone auto-merge
    IF v_party_id IS NULL AND p_phone IS NOT NULL AND btrim(p_phone) <> '' THEN
      SELECT p.id, p.response INTO v_party_id, v_existing_resp FROM guests g JOIN rsvp_parties p ON p.id = g.party_id
        WHERE p.event_id = v_event.id AND g.is_primary_contact AND g.phone = p_phone AND p.response <> 'no'
        LIMIT 1;
      IF v_party_id IS NOT NULL THEN
        IF v_existing_resp IN ('yes', 'no', 'maybe') AND NOT COALESCE(v_event.allow_guest_edits, false) THEN
          RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_RSVP',
            'message', 'You have already responded to this invitation.');
        END IF;
        UPDATE rsvp_parties SET
          label = p_guest_name, response = p_response::rsvp_response_type, notes = p_notes,
          decline_reason = v_decline_reason, maybe_confirm_by = v_maybe_confirm,
          response_source = 'web_form', responded_at = now(), updated_at = now()
        WHERE id = v_party_id AND event_id = v_event.id;
        v_is_update := true;
        DELETE FROM guests WHERE party_id = v_party_id;
        DELETE FROM custom_answers WHERE party_id = v_party_id;
        IF p_response = 'no' THEN
          DELETE FROM seating_assignments WHERE party_id = v_party_id;
        END IF;
      END IF;
    END IF;

    IF v_party_id IS NULL THEN
      INSERT INTO rsvp_parties (event_id, label, response, notes, decline_reason, maybe_confirm_by, response_source, responded_at)
      VALUES (v_event.id, p_guest_name, p_response::rsvp_response_type, p_notes, v_decline_reason, v_maybe_confirm, 'web_form', now())
      RETURNING id INTO v_party_id;

      BEGIN
        INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection)
        VALUES (v_party_id, v_event.id, p_guest_name, v_norm_email, p_phone, true,
                CASE WHEN p_response = 'yes' THEN NULLIF(p_primary_meal, '') ELSE NULL END);
      EXCEPTION WHEN unique_violation THEN
        DELETE FROM rsvp_parties WHERE id = v_party_id;
        RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_RSVP',
          'message', 'An RSVP with this email or phone already exists for this event.');
      END;
    ELSE
      INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection)
      VALUES (v_party_id, v_event.id, p_guest_name, v_norm_email, p_phone, true,
              CASE WHEN p_response = 'yes' THEN NULLIF(p_primary_meal, '') ELSE NULL END);
    END IF;
  END IF;

  -- ── 7. Additional guests + custom answers (attending only) ──
  -- The companion insert now carries the new per-person detail fields. We
  -- silently coerce out-of-vocab age_group/gender values to NULL so a stale
  -- client can't trip the CHECK constraint mid-submit and lose the row.
  IF p_response = 'yes' THEN
    INSERT INTO guests (
      party_id, event_id, full_name, phone, is_primary_contact,
      meal_selection, dietary_notes, age_group, relationship, gender
    )
    SELECT
      v_party_id, v_event.id, g.elem ->> 'fullName',
      NULLIF(btrim(g.elem ->> 'phone'), ''),
      false,
      NULLIF(g.elem ->> 'mealSelection', ''),
      NULLIF(g.elem ->> 'dietaryNotes', ''),
      CASE WHEN (g.elem ->> 'ageGroup') IN ('adult', 'teen', 'child', 'infant')
           THEN g.elem ->> 'ageGroup' END,
      NULLIF(btrim(LEFT(COALESCE(g.elem ->> 'relationship', ''), 60)), ''),
      CASE WHEN (g.elem ->> 'gender') IN ('male', 'female')
           THEN g.elem ->> 'gender' END
    FROM jsonb_array_elements(COALESCE(p_additional_guests, '[]'::jsonb)) WITH ORDINALITY AS g(elem, ord)
    WHERE COALESCE(btrim(g.elem ->> 'fullName'), '') <> ''
      AND g.ord <= GREATEST(v_party_size - 1, 0);

    INSERT INTO custom_answers (party_id, field_id, answer_value)
    SELECT v_party_id, (a.elem ->> 'fieldId')::uuid, a.elem -> 'value'
    FROM jsonb_array_elements(COALESCE(p_custom_answers, '[]'::jsonb)) WITH ORDINALITY AS a(elem, ord)
    WHERE a.ord <= 50;
  END IF;

  -- ── 8. Activity log ──
  INSERT INTO activity_logs (event_id, action, entity_type, entity_id, metadata)
  VALUES (v_event.id, 'rsvp_submitted', 'rsvp_party', v_party_id,
          jsonb_build_object('guest_name', p_guest_name, 'response', p_response, 'party_size', v_party_size));

  -- ── 9. Org contact for the caller's notification/email ──
  SELECT email, name, phone INTO v_org_email, v_org_name, v_org_phone
  FROM organizations WHERE id = v_event.org_id;

  RETURN jsonb_build_object(
    'success', true,
    'party_id', v_party_id,
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
