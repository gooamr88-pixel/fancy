-- ════════════════════════════════════════════════════════════════════════
-- Groom's Side / Bride's Side guest tagging (opt-in, per event)
-- ────────────────────────────────────────────────────────────────────────
-- Lets an organizer tag each invited party (the whole family/party, not
-- each companion individually) as belonging to one side of the couple —
-- labeled "Groom's/Bride's Side" for weddings, "Partner 1/2's Side"
-- otherwise, mirroring the existing partner1/partner2 naming already used
-- for the couple's own names (templateData.partner1/partner2).
--
-- Lives on rsvp_parties (the invited-unit table), not guests, because a
-- side applies to the whole invited family, not to each companion
-- independently — consistent with label/response/notes already living here.
--
-- Off by default per event via events.track_guest_side — when off, the
-- frontend/backend simply don't surface the field; this migration never
-- touches existing `side` values based on the toggle.
--
-- add_guest_to_party and submit_rsvp_v2 both gain a new trailing p_side
-- parameter (default NULL). Unlike the companion-detail-fields migration
-- (20260711, which threaded age_group/gender/relationship through the
-- existing p_additional_guests JSONB with no signature change), this DOES
-- change each function's argument-type signature — so the old-signature
-- overloads are explicitly dropped first to avoid PostgREST/Postgres ever
-- seeing two ambiguous overloads of the same function name.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.rsvp_parties ADD COLUMN IF NOT EXISTS side TEXT;

ALTER TABLE public.rsvp_parties DROP CONSTRAINT IF EXISTS rsvp_parties_side_check;
ALTER TABLE public.rsvp_parties ADD CONSTRAINT rsvp_parties_side_check
  CHECK (side IS NULL OR side IN ('partner1', 'partner2'));

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS track_guest_side BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_rsvp_parties_event_side ON public.rsvp_parties(event_id, side);


-- ════════════════════════════════════════════════════════════════════════
-- Meal field flag (unrelated to guest-side tagging, bundled here purely so
-- submit_rsvp_v2 below — which now reads it — never runs before the column
-- exists).
-- ────────────────────────────────────────────────────────────────────────
-- The meal picker was previously "found" by guessing: the frontend matched
-- any custom_form_fields row whose field_key was one of a handful of
-- synonyms (meal_selection/meal/meal_choice/meal_preference/meal_option) AND
-- field_type was select/radio (frontend/src/app/utils/mealField.js), while
-- submit_rsvp_v2 matched ONLY the literal key 'meal_selection' with no type
-- check at all. These two heuristics could disagree — an organizer using the
-- free-text "+ Add Custom Question" flow (rather than the dedicated "Add
-- Meal Options" shortcut) could create a field the frontend treats as the
-- meal picker but the backend never finds (required-ness silently
-- unenforced), or a same-named field of the wrong type that the backend
-- WOULD find and enforce as required even though no meal UI ever collected
-- an answer for it (every "yes" RSVP hard-rejected).
--
-- is_meal_field is the single source of truth going forward: set explicitly
-- by the organizer's "Add Meal Options" shortcut (fieldController.saveField),
-- read directly by both the frontend (mealField.js) and submit_rsvp_v2 below
-- — no more guessing by key/type. Backfilled here for existing events using
-- the same old heuristic (picking at most one match per event, oldest
-- first) so already-configured meal fields keep working. The partial unique
-- index guarantees at most one flagged field per event, so there's never
-- ambiguity about which row is "the" meal field.
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.custom_form_fields ADD COLUMN IF NOT EXISTS is_meal_field BOOLEAN NOT NULL DEFAULT false;

WITH ranked AS (
  SELECT id, event_id,
         ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY created_at ASC) AS rn
  FROM public.custom_form_fields
  WHERE lower(field_key) IN ('meal_selection', 'meal', 'meal_choice', 'meal_preference', 'meal_option')
    AND field_type IN ('select', 'radio')
)
UPDATE public.custom_form_fields f
SET is_meal_field = true
FROM ranked
WHERE f.id = ranked.id AND ranked.rn = 1;

DROP INDEX IF EXISTS public.idx_custom_form_fields_one_meal_per_event;
CREATE UNIQUE INDEX idx_custom_form_fields_one_meal_per_event
  ON public.custom_form_fields(event_id) WHERE is_meal_field = true;


-- ════════════════════════════════════════════════════════════════════════
-- add_guest_to_party: organizer manual-add (AddGuestModal) gains p_side.
-- Body is byte-for-byte identical to 20260705000000_guest_experience_rebuild
-- .sql's version except the new-party INSERT now also writes `side`.
-- ════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.add_guest_to_party(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT);

CREATE FUNCTION public.add_guest_to_party(
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
    INSERT INTO rsvp_parties (event_id, label, response, response_source, side)
    VALUES (p_event_id, p_full_name, p_response::rsvp_response_type, 'manual',
            CASE WHEN p_side IN ('partner1', 'partner2') THEN p_side END)
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

REVOKE ALL ON FUNCTION public.add_guest_to_party(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) FROM anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- submit_rsvp_v2: public RSVP submit gains p_side, drops the age_group/
-- relationship/gender companion fields (20260711000000_companion_detail_
-- fields.sql — never actually collected by the public form, removed per
-- product decision; see 20260715000000_remove_companion_detail_fields.sql
-- for the column drop), and makes the companion insert loop-based instead
-- of one bulk INSERT...SELECT so a companion's email colliding with another
-- guest already on file for this event no longer fails the whole RSVP.
--   • v_side local: p_side coerced to NULL unless it's 'partner1'/'partner2'
--   • both UPDATE rsvp_parties SET blocks (explicit-id path + email
--     auto-merge path + phone auto-merge path) now set
--     side = COALESCE(v_side, side) — a resubmission that doesn't carry a
--     side (e.g. the toggle was off when the guest edited) never wipes a
--     previously-set value
--   • the fresh-party INSERT INTO rsvp_parties writes `side`
--   • the RETURN payload gains 'event_type' and 'side' so the controller
--     can build the organizer email without an extra round-trip
-- ════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.submit_rsvp_v2(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT);

CREATE FUNCTION public.submit_rsvp_v2(p_slug text, p_party_id uuid, p_guest_name text, p_email text, p_phone text, p_response text, p_party_size integer, p_notes text, p_primary_meal text, p_additional_guests jsonb, p_custom_answers jsonb, p_decline_reason text, p_maybe_confirm_by text, p_side text DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
  v_side            TEXT;
  v_companion_email TEXT;
  v_field           RECORD;
  v_party_answer    TEXT;
  v_companion_answer TEXT;
  v_new_guest_id    UUID;
BEGIN
  -- ── 1. Resolve the event by slug ──
  SELECT * INTO v_event FROM events WHERE slug = p_slug;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Event not found.');
  END IF;

  v_is_demo := (v_event.slug = 'demo');
  v_side := CASE WHEN p_side IN ('partner1', 'partner2') THEN p_side END;

  -- Per-event transactional advisory lock: serialises concurrent public
  -- RSVP submissions for the same event so the guest-cap check below is
  -- check-and-act atomically. Auto-released on commit or rollback.
  PERFORM pg_advisory_xact_lock(hashtext('rsvp_submit:' || v_event.id::text));

  -- ── 2. Gating: payment / review / status / deadline (demo bypasses pay+review) ──
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

  -- RF-1: reject grossly oversized arrays outright (defence-in-depth; the
  -- child inserts below are also hard-capped).
  IF jsonb_typeof(p_additional_guests) = 'array' AND jsonb_array_length(p_additional_guests) > 100 THEN
    RETURN jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Too many additional guests submitted.');
  END IF;
  IF jsonb_typeof(p_custom_answers) = 'array' AND jsonb_array_length(p_custom_answers) > 200 THEN
    RETURN jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Too many custom answers submitted.');
  END IF;

  -- Validate every custom-answer fieldId up front (only matters when attending,
  -- since step 6 below only persists answers for p_response = 'yes') — surface
  -- a clear error instead of silently dropping the answer at INSERT time.
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

  -- Same fieldId validation for each companion's guest-scoped answers (this is
  -- the only place these ever get checked — see step 6 for why they were
  -- previously collected by the wizard but silently discarded server-side).
  IF p_response = 'yes' AND v_party_size > 1 AND jsonb_typeof(p_additional_guests) = 'array' THEN
    FOR i IN 0..(v_party_size - 2) LOOP
      v_g := p_additional_guests -> i;
      IF jsonb_typeof(v_g -> 'customAnswers') = 'object' THEN
        FOR v_bad_field_id IN SELECT jsonb_object_keys(v_g -> 'customAnswers') LOOP
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
    END LOOP;
  END IF;

  -- Custom-question requiredness: party-scoped fields are asked once (must
  -- have a non-blank answer in p_custom_answers); guest-scoped fields are
  -- asked per companion (every companion 0..party_size-2 must answer). The
  -- dedicated meal field (is_meal_field) is excluded — it already has its own
  -- requiredness check above with a clearer error code.
  IF p_response = 'yes' THEN
    FOR v_field IN
      SELECT id, scope, field_label FROM custom_form_fields
      WHERE event_id = v_event.id AND is_required = true AND is_meal_field = false
    LOOP
      IF v_field.scope = 'guest' THEN
        IF v_party_size > 1 THEN
          FOR i IN 0..(v_party_size - 2) LOOP
            v_g := p_additional_guests -> i;
            v_companion_answer := NULLIF(btrim(COALESCE((v_g -> 'customAnswers') ->> v_field.id::text, '')), '');
            IF v_companion_answer IS NULL THEN
              RETURN jsonb_build_object('success', false, 'code', 'CUSTOM_ANSWER_REQUIRED',
                'message', format('"%s" is required for Guest #%s.', v_field.field_label, i + 2));
            END IF;
          END LOOP;
        END IF;
      ELSE
        v_party_answer := NULL;
        IF jsonb_typeof(p_custom_answers) = 'array' THEN
          FOR v_a IN SELECT * FROM jsonb_array_elements(p_custom_answers) LOOP
            IF (v_a ->> 'fieldId')::uuid = v_field.id THEN
              v_party_answer := NULLIF(btrim(COALESCE(v_a ->> 'value', '')), '');
              EXIT;
            END IF;
          END LOOP;
        END IF;
        IF v_party_answer IS NULL THEN
          RETURN jsonb_build_object('success', false, 'code', 'CUSTOM_ANSWER_REQUIRED',
            'message', format('"%s" is required.', v_field.field_label));
        END IF;
      END IF;
    END LOOP;
  END IF;

  v_norm_email := NULLIF(lower(btrim(COALESCE(p_email, ''))), '');
  v_decline_reason := CASE WHEN p_response = 'no'    THEN NULLIF(p_decline_reason, '')   ELSE NULL END;
  v_maybe_confirm  := CASE WHEN p_response = 'maybe' THEN NULLIF(p_maybe_confirm_by, '') ELSE NULL END;

  -- ── 4. Meal validation (attending only), against the organizer's flagged meal field ──
  -- is_meal_field is the single source of truth (see migration header) — no more
  -- guessing by field_key/field_type, so this always agrees with whatever the
  -- frontend rendered as the dedicated meal picker.
  IF p_response = 'yes' THEN
    SELECT options, COALESCE(is_required, false)
      INTO v_meal_options, v_meal_required
      FROM custom_form_fields
     WHERE event_id = v_event.id AND is_meal_field = true
     LIMIT 1;
    v_has_meal_field := FOUND;

    IF v_has_meal_field THEN
      v_opt_count := jsonb_array_length(COALESCE(v_meal_options, '[]'::jsonb));

      IF v_opt_count > 0 OR v_meal_required THEN
        IF v_meal_required AND NULLIF(btrim(COALESCE(p_primary_meal, '')), '') IS NULL THEN
          RETURN jsonb_build_object('success', false, 'code', 'MEAL_REQUIRED',
            'message', 'Meal selection is required for the primary guest.');
        END IF;
        IF NULLIF(p_primary_meal, '') IS NOT NULL AND v_opt_count > 0
           AND NOT (v_meal_options ? p_primary_meal) THEN
          RETURN jsonb_build_object('success', false, 'code', 'MEAL_INVALID',
            'message', format('Meal selection ''%s'' is invalid.', p_primary_meal));
        END IF;

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
  -- Safe under concurrency: the advisory lock above serialises all
  -- submissions for this event, so this check-then-act is now atomic.
  IF NOT v_is_demo AND COALESCE(v_event.tier_max_guests, 0) > 0 AND p_response IN ('yes', 'maybe') THEN
    SELECT COALESCE(SUM(gc.cnt), 0) INTO v_committed
    FROM rsvp_parties p
    JOIN LATERAL (SELECT COUNT(*) AS cnt FROM guests g WHERE g.party_id = p.id) gc ON true
    WHERE p.event_id = v_event.id
      AND p.response IN ('yes', 'maybe')
      AND (p_party_id IS NULL OR p.id <> p_party_id);
    IF v_committed + v_party_size > v_event.tier_max_guests THEN
      RETURN jsonb_build_object('success', false, 'code', 'GUEST_LIMIT_REACHED',
        'message', 'This event has reached its guest limit. Please contact the host.');
    END IF;
  END IF;

  -- ── 5. Insert or update the party + its primary guest row ──
  IF p_party_id IS NOT NULL THEN
    -- UPDATE path: ownership check by email match against the primary contact.
    SELECT response INTO v_existing_resp FROM rsvp_parties WHERE id = p_party_id AND event_id = v_event.id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'code', 'RSVP_NOT_FOUND', 'message', 'The RSVP record was not found.');
    END IF;

    SELECT email INTO v_existing_email FROM guests WHERE party_id = p_party_id AND is_primary_contact = true;

    -- Strict, state-aware lock: once answered, the record is closed to
    -- further public submissions — UNLESS the host enabled guest self-edits
    -- (RF-2), in which case the guest may overwrite their own response.
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

    UPDATE rsvp_parties SET
      label = p_guest_name, response = p_response::rsvp_response_type, notes = p_notes,
      decline_reason = v_decline_reason, maybe_confirm_by = v_maybe_confirm,
      response_source = 'web_form', responded_at = now(), updated_at = now(),
      side = COALESCE(v_side, side)
    WHERE id = p_party_id AND event_id = v_event.id;

    v_party_id := p_party_id;
    v_is_update := true;

    DELETE FROM guests WHERE party_id = v_party_id;
    DELETE FROM custom_answers WHERE party_id = v_party_id;
    -- Seating cleanup on response != 'yes' is handled by trg_party_response_change.

    INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection)
    VALUES (v_party_id, v_event.id, p_guest_name, v_norm_email, p_phone, true,
            CASE WHEN p_response = 'yes' THEN NULLIF(p_primary_meal, '') ELSE NULL END);
  ELSE
    -- INSERT path: duplicate-email + duplicate-phone auto-merge guards.
    -- Instead of rejecting with DUPLICATE_RSVP, find the existing party and
    -- switch to the UPDATE path (auto-merge) — but only if that party's
    -- response isn't already locked in (same rule as the explicit-id path).

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
        -- Auto-merge: treat as an update of the existing record.
        UPDATE rsvp_parties SET
          label = p_guest_name, response = p_response::rsvp_response_type, notes = p_notes,
          decline_reason = v_decline_reason, maybe_confirm_by = v_maybe_confirm,
          response_source = 'web_form', responded_at = now(), updated_at = now(),
          side = COALESCE(v_side, side)
        WHERE id = v_party_id AND event_id = v_event.id;
        v_is_update := true;
        DELETE FROM guests WHERE party_id = v_party_id;
        DELETE FROM custom_answers WHERE party_id = v_party_id;
        IF p_response = 'no' THEN
          DELETE FROM seating_assignments WHERE party_id = v_party_id;
        END IF;
        -- Skip the INSERT below (jump to primary guest + child rows section)
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
        -- Auto-merge: treat as an update of the existing record.
        UPDATE rsvp_parties SET
          label = p_guest_name, response = p_response::rsvp_response_type, notes = p_notes,
          decline_reason = v_decline_reason, maybe_confirm_by = v_maybe_confirm,
          response_source = 'web_form', responded_at = now(), updated_at = now(),
          side = COALESCE(v_side, side)
        WHERE id = v_party_id AND event_id = v_event.id;
        v_is_update := true;
        DELETE FROM guests WHERE party_id = v_party_id;
        DELETE FROM custom_answers WHERE party_id = v_party_id;
        IF p_response = 'no' THEN
          DELETE FROM seating_assignments WHERE party_id = v_party_id;
        END IF;
        -- Skip the INSERT below (jump to primary guest + child rows section)
      END IF;
    END IF;

    -- Only create a brand-new party if no existing record was found by email or phone.
    IF v_party_id IS NULL THEN
      INSERT INTO rsvp_parties (event_id, label, response, notes, decline_reason, maybe_confirm_by, response_source, responded_at, side)
      VALUES (v_event.id, p_guest_name, p_response::rsvp_response_type, p_notes, v_decline_reason, v_maybe_confirm, 'web_form', now(), v_side)
      RETURNING id INTO v_party_id;

      BEGIN
        INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection)
        VALUES (v_party_id, v_event.id, p_guest_name, v_norm_email, p_phone, true,
                CASE WHEN p_response = 'yes' THEN NULLIF(p_primary_meal, '') ELSE NULL END);
      EXCEPTION WHEN unique_violation THEN
        -- A concurrent first-time RSVP with the same email/phone won the race.
        DELETE FROM rsvp_parties WHERE id = v_party_id;
        RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_RSVP',
          'message', 'An RSVP with this email or phone already exists for this event.');
      END;
    ELSE
      -- Auto-merged: re-insert the primary guest row for the updated party.
      INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection)
      VALUES (v_party_id, v_event.id, p_guest_name, v_norm_email, p_phone, true,
              CASE WHEN p_response = 'yes' THEN NULLIF(p_primary_meal, '') ELSE NULL END);
    END IF;
  END IF;

  -- ── 6. Additional guests + custom answers (attending only) — HARD CAPPED (RF-1) ──
  -- Each companion is inserted individually (not one bulk INSERT...SELECT) so
  -- that one companion's email colliding with another guest already on file
  -- for this event (idx_guests_event_email_unique — a shared household email
  -- across companions, or with the host, is common) can't roll back the
  -- ENTIRE RSVP submission. On a duplicate-email conflict we keep the
  -- companion and just drop the colliding email instead of failing the whole
  -- request.
  IF p_response = 'yes' THEN
    FOR v_g, i IN
      SELECT g.elem, g.ord
      FROM jsonb_array_elements(COALESCE(p_additional_guests, '[]'::jsonb)) WITH ORDINALITY AS g(elem, ord)
      WHERE COALESCE(btrim(g.elem ->> 'fullName'), '') <> ''
        AND g.ord <= GREATEST(v_party_size - 1, 0)
    LOOP
      v_companion_email := NULLIF(lower(btrim(COALESCE(v_g ->> 'email', ''))), '');
      BEGIN
        INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection, dietary_notes)
        VALUES (
          v_party_id, v_event.id, v_g ->> 'fullName', v_companion_email,
          NULLIF(btrim(v_g ->> 'phone'), ''), false,
          NULLIF(v_g ->> 'mealSelection', ''), NULLIF(v_g ->> 'dietaryNotes', '')
        ) RETURNING id INTO v_new_guest_id;
      EXCEPTION WHEN unique_violation THEN
        BEGIN
          -- Retry without email first — the most common collision is a shared
          -- household email across companions (or with the host).
          INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection, dietary_notes)
          VALUES (
            v_party_id, v_event.id, v_g ->> 'fullName', NULL,
            NULLIF(btrim(v_g ->> 'phone'), ''), false,
            NULLIF(v_g ->> 'mealSelection', ''), NULLIF(v_g ->> 'dietaryNotes', '')
          ) RETURNING id INTO v_new_guest_id;
        EXCEPTION WHEN unique_violation THEN
          -- Still colliding — the phone was the actual conflict (or both were).
          -- Drop it too rather than fail the whole RSVP submission.
          INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection, dietary_notes)
          VALUES (
            v_party_id, v_event.id, v_g ->> 'fullName', NULL, NULL, false,
            NULLIF(v_g ->> 'mealSelection', ''), NULLIF(v_g ->> 'dietaryNotes', '')
          ) RETURNING id INTO v_new_guest_id;
        END;
      END;

      -- Persist this companion's guest-scoped custom-question answers. These
      -- were already collected by the wizard (and validated/required-checked
      -- above) but previously had no INSERT at all here — silently discarded.
      IF jsonb_typeof(v_g -> 'customAnswers') = 'object' THEN
        INSERT INTO custom_answers (party_id, guest_id, field_id, answer_value)
        SELECT v_party_id, v_new_guest_id, ca.key::uuid, to_jsonb(ca.value)
        FROM jsonb_each_text(v_g -> 'customAnswers') AS ca(key, value)
        WHERE NULLIF(btrim(ca.value), '') IS NOT NULL;
      END IF;
    END LOOP;

    -- Custom answers: already validated above (every fieldId is a real UUID
    -- belonging to this event), so this insert is now a straight write rather
    -- than a silent filter. The ordinality cap (50) remains as defence-in-depth.
    INSERT INTO custom_answers (party_id, field_id, answer_value)
    SELECT v_party_id, (a.elem ->> 'fieldId')::uuid, a.elem -> 'value'
    FROM jsonb_array_elements(COALESCE(p_custom_answers, '[]'::jsonb)) WITH ORDINALITY AS a(elem, ord)
    WHERE a.ord <= 50;
  END IF;

  -- ── 7. Activity log (public submit — no actor) ──
  INSERT INTO activity_logs (event_id, action, entity_type, entity_id, metadata)
  VALUES (v_event.id, 'rsvp_submitted', 'rsvp_party', v_party_id,
          jsonb_build_object('guest_name', p_guest_name, 'response', p_response, 'party_size', v_party_size));

  -- ── 8. Org contact for the caller's notification/email (no extra round-trip) ──
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
    'org_phone', v_org_phone,
    'event_type', v_event.event_type,
    'side', (SELECT side FROM rsvp_parties WHERE id = v_party_id)
  );
END;
$_$;

REVOKE ALL ON FUNCTION public.submit_rsvp_v2(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT) FROM anon, authenticated;
