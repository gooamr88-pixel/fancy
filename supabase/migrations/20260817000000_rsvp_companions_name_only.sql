-- ══════════════════════════════════════════════════════════════════════════
-- RSVP: the main guest owns the details; a companion is a NAME
--
-- THREE product decisions, one function.
--
-- 1. COMPANIONS ARE NAMES ONLY.
--    The public form used to ask for an email, a phone, a meal and dietary
--    notes for every companion, and REQUIRED the email and phone. Guest emails
--    are unique per event (idx_guests_event_email_unique), so a family sharing
--    one inbox collides -- and the old step 6 "handled" that by re-inserting the
--    companion with the email stripped, then with the phone stripped too. The
--    guest saw a success screen and was never told anything had been dropped.
--    Now that the QR entry pass is delivered by email, a silently-discarded
--    address is a guest with nothing to show at the door.
--
--    The person who opened the invitation gives their own contact details and
--    answers the form. Anyone they bring is recorded as a name, against their
--    party, so the organizer can seat them, count them and check them in. One
--    party, one contact, one pass that admits the whole group -- which is how
--    getQRTicketTemplate already renders it ("Admits N").
--
--    This is why the fix needs no index change: with no email and no phone on a
--    companion row there is nothing left to collide. The failure mode is gone
--    rather than handled.
--
-- 2. COMPANION MEALS ARE COUNTS FOR THE GROUP.
--    A companion has no name-to-meal mapping any more, so the caterer would
--    have counted every one of them as "No Selection" (events.getEventStats
--    builds its breakdown from guests.meal_selection). The main guest now gives
--    a tally instead -- "of my 3 guests: 2 fish, 1 beef" -- stored on the party
--    in `companion_meal_counts`. The main guest keeps their own named
--    meal_selection, so their place card and the door app are unaffected.
--
--    Companions have no individual meal ANYWHERE, including the organizer's
--    edit modal: exactly one source per person, nothing to reconcile, and no
--    way to double-count a party.
--
-- 3. AN ALREADY-REGISTERED CONTACT IS ANNOUNCED, NEVER OVERWRITTEN.
--    Both auto-merge lookups (email and phone) used to silently UPDATE a party
--    that had already answered whenever the host had allow_guest_edits on --
--    so anyone who knew a guest's address could replace that guest's response
--    without either of them being told. Both now stop dead and return
--    EMAIL_ALREADY_REGISTERED / PHONE_ALREADY_REGISTERED plus `canUpdate`.
--
--    Changing an answered RSVP requires arriving with a p_party_id: the guest's
--    own link, or the short-lived one emailed to that address by
--    POST /public/events/:slug/rsvp/claim. That branch already proves ownership
--    (the submitted email must match the party's primary contact) and already
--    honours allow_guest_edits, so this function needs no "confirm" flag -- an
--    unverified click is not proof of anything.
--
--    A still-'pending' party (organizer-imported, never answered) merges
--    exactly as before: that is a guest claiming their own invitation.
--
--    The reply names nobody. Whoever typed the address may not be its owner, so
--    confirming WHO responded would leak the guest list one address at a time.
--
-- DATA: nothing is dropped or backfilled. guests.email / phone /
-- meal_selection / dietary_notes all stay -- the primary contact still uses
-- them, and every companion detail already on file is left exactly as it is.
--
-- SIGNATURE: p_companion_meal_counts is a new trailing parameter, so this is a
-- DROP + CREATE. CREATE OR REPLACE would leave the 16-argument version in place
-- beside the new 17-argument one and every call would become ambiguous. Deploy
-- this BEFORE the backend that passes the new argument.
--
-- Everything else is byte-for-byte the function from
-- 20260725000000_fix_declined_guest_rematch.sql.
-- ══════════════════════════════════════════════════════════════════════════

-- Per-party tally of the meals chosen for companions, e.g. {"Beef": 2, "Fish": 1}.
-- Deliberately NOT per-guest: the form no longer asks who is who, so attributing
-- a dish to a named companion would be inventing data. NULL for any party that
-- is not attending, and for a party of one.
ALTER TABLE public.rsvp_parties
  ADD COLUMN IF NOT EXISTS companion_meal_counts jsonb;

COMMENT ON COLUMN public.rsvp_parties.companion_meal_counts IS
  'Meal tally for this party''s companions, {option: count}. The primary contact''s own meal stays on guests.meal_selection. Sum must equal party_size - 1 when the event''s meal field is required.';

DROP FUNCTION IF EXISTS public.submit_rsvp_v2(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, BOOLEAN, TEXT);

CREATE FUNCTION public.submit_rsvp_v2(p_slug text, p_party_id uuid, p_guest_name text, p_email text, p_phone text, p_response text, p_party_size integer, p_notes text, p_primary_meal text, p_additional_guests jsonb, p_custom_answers jsonb, p_decline_reason text, p_maybe_confirm_by text, p_side text DEFAULT NULL, p_sms_consent boolean DEFAULT false, p_primary_dietary_notes text DEFAULT NULL, p_companion_meal_counts jsonb DEFAULT NULL) RETURNS jsonb
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
  v_a               JSONB;
  v_bad_field_id    TEXT;
  v_committed       INTEGER;
  v_org_email       TEXT;
  v_org_name        TEXT;
  v_org_phone       TEXT;
  v_side            TEXT;
  v_field           RECORD;
  v_party_answer    TEXT;
  v_primary_guest_id UUID;
  v_meal_key        TEXT;
  v_meal_qty        TEXT;
  v_counts_total    INTEGER := 0;
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

  -- Validate every custom-answer fieldId up front. Runs for EVERY response now
  -- that 'always'-condition answers persist even when not attending — surface a
  -- clear error instead of silently dropping the answer at INSERT time.
  IF jsonb_typeof(p_custom_answers) = 'array' THEN
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

  -- Custom-question requiredness. The primary guest's own answer (both scopes
  -- share p_custom_answers) is enforced for every required field that APPLIES to
  -- this response: 'always' fields apply to every response; 'attending' fields
  -- apply only when p_response = 'yes'. Companions exist only when attending, so
  -- their guest-scoped checks stay gated on that. The dedicated meal field
  -- (is_meal_field) is excluded — it has its own check above with a clearer code.
  FOR v_field IN
    SELECT id, scope, field_label, condition FROM custom_form_fields
    WHERE event_id = v_event.id AND is_required = true AND is_meal_field = false
  LOOP
    -- Skip attending-only questions when the guest isn't attending.
    CONTINUE WHEN v_field.condition <> 'always' AND p_response <> 'yes';

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
  END LOOP;

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

        -- Companions are names, so their meals arrive as COUNTS for the group
        -- ("of my 3 guests: 2 fish, 1 beef") with nothing tied to a person. The
        -- caterer gets an exact total; place cards for companions do not exist,
        -- which is the accepted cost of not asking who is who.
        IF v_party_size > 1 THEN
          v_counts_total := 0;
          IF jsonb_typeof(p_companion_meal_counts) = 'object' THEN
            FOR v_meal_key, v_meal_qty IN SELECT key, value FROM jsonb_each_text(p_companion_meal_counts) LOOP
              IF v_opt_count > 0 AND NOT (v_meal_options ? v_meal_key) THEN
                RETURN jsonb_build_object('success', false, 'code', 'MEAL_INVALID',
                  'message', format('Meal selection ''%s'' is invalid.', v_meal_key));
              END IF;
              -- Text-matched rather than cast: a bad value must come back as
              -- MEAL_INVALID, not as an uncaught invalid_text_representation.
              IF COALESCE(v_meal_qty, '') !~ '^[0-9]+$' THEN
                RETURN jsonb_build_object('success', false, 'code', 'MEAL_INVALID',
                  'message', format('Meal count for ''%s'' must be a whole number.', v_meal_key));
              END IF;
              v_counts_total := v_counts_total + v_meal_qty::INTEGER;
            END LOOP;
          END IF;
          IF v_counts_total > v_party_size - 1 THEN
            RETURN jsonb_build_object('success', false, 'code', 'MEAL_INVALID',
              'message', format('You have chosen %s meals for %s guests.', v_counts_total, v_party_size - 1));
          END IF;
          IF v_meal_required AND v_counts_total <> v_party_size - 1 THEN
            RETURN jsonb_build_object('success', false, 'code', 'MEAL_REQUIRED',
              'message', format('Please choose a meal for each of your %s guests.', v_party_size - 1));
          END IF;
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
      side = COALESCE(v_side, side),
      sms_consent = p_sms_consent, sms_consent_at = now(),
      companion_meal_counts = CASE WHEN p_response = 'yes' THEN p_companion_meal_counts ELSE NULL END
    WHERE id = p_party_id AND event_id = v_event.id;

    v_party_id := p_party_id;
    v_is_update := true;

    DELETE FROM guests WHERE party_id = v_party_id;
    DELETE FROM custom_answers WHERE party_id = v_party_id;
    -- Seating cleanup on response != 'yes' is handled by trg_party_response_change.

    INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection, dietary_notes)
    VALUES (v_party_id, v_event.id, p_guest_name, v_norm_email, p_phone, true,
            CASE WHEN p_response = 'yes' THEN NULLIF(p_primary_meal, '') ELSE NULL END,
            CASE WHEN p_response = 'yes' THEN NULLIF(btrim(p_primary_dietary_notes), '') ELSE NULL END)
    RETURNING id INTO v_primary_guest_id;
  ELSE
    -- INSERT path: duplicate-email + duplicate-phone auto-merge guards.
    -- Instead of rejecting with DUPLICATE_RSVP, find the existing party and
    -- switch to the UPDATE path (auto-merge) — but only if that party's
    -- response isn't already locked in (same rule as the explicit-id path).
    --
    -- FIX (this migration): no `response <> 'no'` filter here anymore — a
    -- previously-declined party is matched exactly like 'yes'/'maybe' ones,
    -- so it goes through the SAME allow_guest_edits gate below instead of
    -- silently duplicating (blank/mismatched contact info) or falsely
    -- colliding with the unconditional unique index (matching contact info).

    -- INSERT path: duplicate-email auto-merge
    IF v_norm_email IS NOT NULL THEN
      SELECT p.id, p.response INTO v_party_id, v_existing_resp FROM guests g JOIN rsvp_parties p ON p.id = g.party_id
        WHERE p.event_id = v_event.id AND g.is_primary_contact AND lower(g.email) = v_norm_email
        LIMIT 1;
      IF v_party_id IS NOT NULL THEN
        -- This address already belongs to a party that has ANSWERED, so this
        -- path stops here — always. It used to UPDATE that party in place
        -- whenever the host allowed guest edits, which meant anyone who knew a
        -- guest's address could replace their response, unannounced.
        --
        -- Changing an answered RSVP now requires arriving with a p_party_id: the
        -- guest's own link, or the short-lived one emailed to this address by
        -- POST /public/events/:slug/rsvp/claim. That branch already proves
        -- ownership (the submitted email must match the party's primary contact)
        -- and already honours allow_guest_edits, so nothing here needs to.
        --
        -- A still-'pending' party falls through and merges as before: that is a
        -- guest claiming their own invitation, not one response landing on top
        -- of another.
        --
        -- The reply deliberately names nobody. Whoever typed the address may not
        -- be its owner, and confirming WHO responded (or how) to a stranger
        -- would leak the guest list one address at a time. `canUpdate` only says
        -- whether offering to email them a link is worth the guest's time.
        IF v_existing_resp IN ('yes', 'no', 'maybe') THEN
          RETURN jsonb_build_object('success', false, 'code', 'EMAIL_ALREADY_REGISTERED',
            'canUpdate', COALESCE(v_event.allow_guest_edits, false),
            'message', 'This email is already registered for this event.');
        END IF;
        -- Auto-merge: treat as an update of the existing record.
        UPDATE rsvp_parties SET
          label = p_guest_name, response = p_response::rsvp_response_type, notes = p_notes,
          decline_reason = v_decline_reason, maybe_confirm_by = v_maybe_confirm,
          response_source = 'web_form', responded_at = now(), updated_at = now(),
          side = COALESCE(v_side, side),
          sms_consent = p_sms_consent, sms_consent_at = now(),
        companion_meal_counts = CASE WHEN p_response = 'yes' THEN p_companion_meal_counts ELSE NULL END
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
        WHERE p.event_id = v_event.id AND g.is_primary_contact AND g.phone = p_phone
        LIMIT 1;
      IF v_party_id IS NOT NULL THEN
        -- Same rule as the email lookup above, and for the same reason: matching
        -- an answered party by phone used to overwrite it without a word.
        IF v_existing_resp IN ('yes', 'no', 'maybe') THEN
          RETURN jsonb_build_object('success', false, 'code', 'PHONE_ALREADY_REGISTERED',
            'canUpdate', COALESCE(v_event.allow_guest_edits, false),
            'message', 'This phone number is already registered for this event.');
        END IF;
        -- Auto-merge: treat as an update of the existing record.
        UPDATE rsvp_parties SET
          label = p_guest_name, response = p_response::rsvp_response_type, notes = p_notes,
          decline_reason = v_decline_reason, maybe_confirm_by = v_maybe_confirm,
          response_source = 'web_form', responded_at = now(), updated_at = now(),
          side = COALESCE(v_side, side),
          sms_consent = p_sms_consent, sms_consent_at = now(),
        companion_meal_counts = CASE WHEN p_response = 'yes' THEN p_companion_meal_counts ELSE NULL END
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
      INSERT INTO rsvp_parties (event_id, label, response, notes, decline_reason, maybe_confirm_by, response_source, responded_at, side, sms_consent, sms_consent_at, companion_meal_counts)
      VALUES (v_event.id, p_guest_name, p_response::rsvp_response_type, p_notes, v_decline_reason, v_maybe_confirm, 'web_form', now(), v_side, p_sms_consent, now(),
              CASE WHEN p_response = 'yes' THEN p_companion_meal_counts ELSE NULL END)
      RETURNING id INTO v_party_id;

      BEGIN
        INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection, dietary_notes)
        VALUES (v_party_id, v_event.id, p_guest_name, v_norm_email, p_phone, true,
                CASE WHEN p_response = 'yes' THEN NULLIF(p_primary_meal, '') ELSE NULL END,
                CASE WHEN p_response = 'yes' THEN NULLIF(btrim(p_primary_dietary_notes), '') ELSE NULL END)
        RETURNING id INTO v_primary_guest_id;
      EXCEPTION WHEN unique_violation THEN
        -- A concurrent first-time RSVP with the same email/phone won the race.
        DELETE FROM rsvp_parties WHERE id = v_party_id;
        RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_RSVP',
          'message', 'An RSVP with this email or phone already exists for this event.');
      END;
    ELSE
      -- Auto-merged: re-insert the primary guest row for the updated party.
      INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection, dietary_notes)
      VALUES (v_party_id, v_event.id, p_guest_name, v_norm_email, p_phone, true,
              CASE WHEN p_response = 'yes' THEN NULLIF(p_primary_meal, '') ELSE NULL END,
              CASE WHEN p_response = 'yes' THEN NULLIF(btrim(p_primary_dietary_notes), '') ELSE NULL END)
      RETURNING id INTO v_primary_guest_id;
    END IF;
  END IF;

  -- ── 6. Additional guests (attending only) — HARD CAPPED (RF-1) ──
  -- A companion is a NAME. The person who opened the invitation gives their own
  -- contact details and answers the form; anyone they bring is recorded so the
  -- organizer can seat them, count them and check them in, and nothing else.
  --
  -- This is what retired the retry ladder that used to live here: companions
  -- carried an email and a phone, those collide with idx_guests_event_email_unique
  -- (one household inbox across a family is completely normal), and the recovery
  -- was to re-insert the row with the email stripped, then with the phone
  -- stripped too. The guest saw a success screen and was never told their
  -- companion's address had been discarded - which, now that the QR entry pass
  -- is delivered by email, is somebody with nothing to show at the door. With no
  -- email and no phone on the row there is nothing left to collide, so the whole
  -- failure mode is gone rather than handled.
  IF p_response = 'yes' THEN
    INSERT INTO guests (party_id, event_id, full_name, is_primary_contact)
    SELECT v_party_id, v_event.id, btrim(g.elem ->> 'fullName'), false
    FROM jsonb_array_elements(COALESCE(p_additional_guests, '[]'::jsonb)) WITH ORDINALITY AS g(elem, ord)
    WHERE COALESCE(btrim(g.elem ->> 'fullName'), '') <> ''
      AND g.ord <= GREATEST(v_party_size - 1, 0);
  END IF;

  -- Custom answers (primary + party-scoped). Stored for EVERY response, but when
  -- the guest isn't attending only 'always'-condition questions are kept —
  -- 'attending'-only questions aren't asked in that case, so the WHERE clause
  -- keeps this a straight write. Joins custom_form_fields to attribute
  -- guest-scoped answers to the primary guest's own row (guest_id); party-scoped
  -- answers keep guest_id NULL. Ordinality cap 200 matches the validation cap.
  INSERT INTO custom_answers (party_id, guest_id, field_id, answer_value)
  SELECT v_party_id,
         CASE WHEN cff.scope = 'guest' THEN v_primary_guest_id ELSE NULL END,
         (a.elem ->> 'fieldId')::uuid, a.elem -> 'value'
  FROM jsonb_array_elements(COALESCE(p_custom_answers, '[]'::jsonb)) WITH ORDINALITY AS a(elem, ord)
  JOIN custom_form_fields cff ON cff.id = (a.elem ->> 'fieldId')::uuid
  WHERE a.ord <= 200 AND (p_response = 'yes' OR cff.condition = 'always');

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
    'side', (SELECT side FROM rsvp_parties WHERE id = v_party_id),
    'sms_consent', (SELECT sms_consent FROM rsvp_parties WHERE id = v_party_id)
  );
END;
$_$;


-- Callable only by the service role (the API), never directly by a browser
-- session -- same posture as every prior revision of this function.
REVOKE ALL ON FUNCTION public.submit_rsvp_v2(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, BOOLEAN, TEXT, JSONB) FROM anon, authenticated;
