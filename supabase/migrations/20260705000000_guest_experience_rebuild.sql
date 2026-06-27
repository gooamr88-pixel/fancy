-- ════════════════════════════════════════════════════════════════════════
-- GUEST EXPERIENCE — COMPLETE REBUILD (Phase 1: Database)
-- ────────────────────────────────────────────────────────────────────────
-- Replaces the rsvps/rsvp_guests model with a party/guest split:
--   rsvp_parties  — the invitation + response unit (was: rsvps)
--   guests        — one row per individual person (was: rsvp_guests, but
--                    now also carries email/phone/contact — the primary
--                    contact's identity used to live on rsvps directly)
--   invitations   — unified delivery ledger for email/sms/qr/public_link,
--                    replacing invitation_sent/qr_email_sent/reminder_*
--                    columns AND the guest_reminders table
--   rsvp_response_history — append-only audit log of response changes
--
-- Clean-slate rebuild: no production guest data to preserve, so this drops
-- and recreates rather than migrating rows. Seating/check-in tables and the
-- seating RPCs (assign_seat/reassign_seat/unassign_seat/get_*) are
-- mechanically re-keyed to the new party_id/guest_id columns — the seating
-- *editor* itself is out of scope for this rebuild, but it cannot keep
-- functioning against tables that no longer exist, so the plumbing here is
-- a rename, not a redesign.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 0. DROP LEGACY OBJECTS ───

-- Drop every overload of the functions being replaced/re-keyed, regardless
-- of which migration last changed their signature.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'submit_rsvp', 'assign_seat', 'reassign_seat', 'unassign_seat',
        'handle_rsvp_modification', 'get_table_occupancy', 'get_seating_summary',
        'get_seating_guests'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE;', r.sig);
  END LOOP;
END $$;

-- guest_reminders' purpose is absorbed into the new `invitations` ledger.
DROP TABLE IF EXISTS guest_reminders CASCADE;

-- These cascade-drop their policies, triggers, and indexes automatically.
DROP TABLE IF EXISTS custom_answers CASCADE;
DROP TABLE IF EXISTS rsvp_guests CASCADE;
DROP TABLE IF EXISTS check_ins CASCADE;
DROP TABLE IF EXISTS seating_assignments CASCADE;
DROP TABLE IF EXISTS rsvps CASCADE;

-- ─── 1. NEW ENUM TYPES ───

DO $$ BEGIN
  CREATE TYPE rsvp_response_type AS ENUM ('pending', 'yes', 'no', 'maybe', 'waitlist');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invitation_channel_type AS ENUM ('email', 'sms', 'qr', 'public_link');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status_type AS ENUM ('queued', 'sent', 'delivered', 'failed', 'opened', 'responded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE form_field_scope_type AS ENUM ('party', 'guest');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE guest_list_visibility_type AS ENUM ('none', 'attending_only', 'all_responses', 'anonymized');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. EVENTS: privacy-scoped guest list disclosure ───

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS guest_list_visibility guest_list_visibility_type NOT NULL DEFAULT 'none';

-- ─── 3. rsvp_parties — the invitation/response unit ───

CREATE TABLE rsvp_parties (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id         UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    label            TEXT NOT NULL,
    response         rsvp_response_type NOT NULL DEFAULT 'pending',
    max_party_size   INTEGER NOT NULL DEFAULT 1 CHECK (max_party_size BETWEEN 1 AND 20),
    notes            TEXT,
    decline_reason   TEXT,
    maybe_confirm_by TEXT,
    response_source  TEXT,
    responded_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rsvp_parties_event_id ON rsvp_parties(event_id);
CREATE INDEX idx_rsvp_parties_event_response ON rsvp_parties(event_id, response);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_rsvp_parties_label_trgm ON rsvp_parties USING gin (label gin_trgm_ops);

-- ─── 4. guests — one row per individual person ───

CREATE TABLE guests (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id           UUID NOT NULL REFERENCES rsvp_parties(id) ON DELETE CASCADE,
    event_id           UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    full_name          TEXT NOT NULL,
    email              TEXT,
    phone              TEXT,
    is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
    meal_selection     TEXT,
    dietary_notes      TEXT,
    created_at         TIMESTAMPTZ DEFAULT now(),
    updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_guests_party_id ON guests(party_id);
CREATE INDEX idx_guests_event_id ON guests(event_id);
CREATE INDEX idx_guests_full_name_trgm ON guests USING gin (full_name gin_trgm_ops);

-- One identity per event: a person (by email, or by phone if no email) can
-- only exist once across all parties in an event. Unconditional (not
-- response-scoped) — replaces the old nullable-email UNIQUE-index gap.
CREATE UNIQUE INDEX idx_guests_event_email_unique ON guests(event_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_guests_event_phone_unique ON guests(event_id, phone) WHERE phone IS NOT NULL;

-- At most one primary contact per party (the old design had no constraint
-- here at all).
CREATE UNIQUE INDEX idx_guests_one_primary_per_party ON guests(party_id) WHERE is_primary_contact = TRUE;

-- ─── 5. invitations — unified delivery ledger (email/sms/qr/public_link) ───

CREATE TABLE invitations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id     UUID NOT NULL REFERENCES rsvp_parties(id) ON DELETE CASCADE,
    event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    channel      invitation_channel_type NOT NULL,
    token        TEXT,
    status       invitation_status_type NOT NULL DEFAULT 'queued',
    sent_at      TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    metadata     JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invitations_party_id ON invitations(party_id);
CREATE INDEX idx_invitations_event_id ON invitations(event_id);
CREATE INDEX idx_invitations_event_channel_status ON invitations(event_id, channel, status);
CREATE UNIQUE INDEX idx_invitations_token_unique ON invitations(token) WHERE token IS NOT NULL;

-- ─── 6. rsvp_response_history — append-only audit log ───

CREATE TABLE rsvp_response_history (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id   UUID NOT NULL REFERENCES rsvp_parties(id) ON DELETE CASCADE,
    event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    response   rsvp_response_type NOT NULL,
    changed_by TEXT NOT NULL DEFAULT 'guest', -- 'guest' | 'organizer' | 'system'
    source     TEXT,
    snapshot   JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rsvp_response_history_party_id ON rsvp_response_history(party_id, created_at DESC);
CREATE INDEX idx_rsvp_response_history_event_id ON rsvp_response_history(event_id, created_at DESC);

-- ─── 7. custom_form_fields (renamed from rsvp_form_fields) + scope ───

ALTER TABLE rsvp_form_fields RENAME TO custom_form_fields;
ALTER TABLE custom_form_fields
  ADD COLUMN IF NOT EXISTS scope form_field_scope_type NOT NULL DEFAULT 'party';

-- ─── 8. custom_answers — re-keyed to party/guest, JSONB-typed, validated ───

CREATE TABLE custom_answers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id     UUID NOT NULL REFERENCES rsvp_parties(id) ON DELETE CASCADE,
    guest_id     UUID REFERENCES guests(id) ON DELETE CASCADE, -- set when field.scope = 'guest'
    field_id     UUID NOT NULL REFERENCES custom_form_fields(id) ON DELETE CASCADE,
    answer_value JSONB,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_custom_answers_party_id ON custom_answers(party_id);
CREATE INDEX idx_custom_answers_guest_id ON custom_answers(guest_id);
CREATE INDEX idx_custom_answers_field_id ON custom_answers(field_id);

-- Validate select/multiselect answers against the field's configured options.
CREATE OR REPLACE FUNCTION validate_custom_answer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field_type TEXT;
  v_options    JSONB;
BEGIN
  SELECT field_type, options INTO v_field_type, v_options
  FROM custom_form_fields WHERE id = NEW.field_id;

  IF NEW.answer_value IS NULL OR v_options IS NULL OR jsonb_array_length(v_options) = 0 THEN
    RETURN NEW;
  END IF;

  IF v_field_type = 'select' THEN
    IF NOT (v_options ? (NEW.answer_value #>> '{}')) THEN
      RAISE EXCEPTION 'Invalid option % for select field %', NEW.answer_value, NEW.field_id;
    END IF;
  ELSIF v_field_type = 'multiselect' AND jsonb_typeof(NEW.answer_value) = 'array' THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(NEW.answer_value) val
      WHERE NOT (v_options ? val)
    ) THEN
      RAISE EXCEPTION 'Invalid option in % for multiselect field %', NEW.answer_value, NEW.field_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_custom_answer
  BEFORE INSERT OR UPDATE ON custom_answers
  FOR EACH ROW EXECUTE FUNCTION validate_custom_answer();

-- ─── 9. seating_assignments — re-keyed to party_id ───

CREATE TABLE seating_assignments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    party_id     UUID NOT NULL REFERENCES rsvp_parties(id) ON DELETE CASCADE,
    table_id     UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    assigned_at  TIMESTAMPTZ DEFAULT now(),
    assigned_by  UUID,
    UNIQUE(event_id, party_id)
);

CREATE INDEX idx_seating_table ON seating_assignments(table_id);
CREATE INDEX idx_seating_event ON seating_assignments(event_id);

-- ─── 10. check_ins — re-keyed to per-guest granularity ───

CREATE TABLE check_ins (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guest_id       UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    party_id       UUID NOT NULL REFERENCES rsvp_parties(id) ON DELETE CASCADE,
    checked_in_at  TIMESTAMPTZ DEFAULT now(),
    checked_in_by  UUID REFERENCES auth.users(id), -- staff who scanned/searched; NULL for self-service
    method         TEXT CHECK (method IN ('qr_scan', 'manual_search', 'self_service')),
    UNIQUE(event_id, guest_id)
);

CREATE INDEX idx_check_ins_event_id ON check_ins(event_id);
CREATE INDEX idx_check_ins_party_id ON check_ins(party_id);

-- ─── 11. guest_analytics — re-key rsvp_id to party_id ───
-- guest_analytics was created by backend/migrations/002_guest_analytics.sql,
-- which lives outside the Supabase CLI's tracked migration chain — it may not
-- exist in every environment that replays supabase/migrations/* (e.g. a fresh
-- `supabase db reset`). Guard accordingly rather than hard-failing.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guest_analytics') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'guest_analytics' AND column_name = 'rsvp_id'
    ) THEN
      ALTER TABLE guest_analytics RENAME COLUMN rsvp_id TO party_id;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'guest_analytics' AND column_name = 'party_id'
    ) THEN
      ALTER TABLE guest_analytics ADD COLUMN party_id UUID;
    END IF;
    ALTER TABLE guest_analytics DROP CONSTRAINT IF EXISTS fk_guest_analytics_party;
    ALTER TABLE guest_analytics
      ADD CONSTRAINT fk_guest_analytics_party FOREIGN KEY (party_id) REFERENCES rsvp_parties(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 12. updated_at triggers for the new tables ───

CREATE TRIGGER set_updated_at BEFORE UPDATE ON rsvp_parties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON guests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON custom_answers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 13. Party response trigger: audit log + seating cleanup ───
-- Fires on every response change regardless of code path (submit_rsvp_v2,
-- update_party_response, or a direct organizer UPDATE) — closes the "RSVP
-- changes aren't logged" gap structurally instead of relying on every
-- caller to remember to log it.

CREATE OR REPLACE FUNCTION handle_party_response_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.response <> 'yes' THEN
    DELETE FROM seating_assignments WHERE party_id = NEW.id;
  END IF;

  -- OLD is unassigned (not just NULL) on an INSERT-triggered invocation, so
  -- TG_OP must be branched explicitly rather than relying on OR short-circuit —
  -- referencing OLD.* at all on the INSERT path raises "record old is not
  -- assigned yet".
  IF TG_OP = 'INSERT' THEN
    INSERT INTO rsvp_response_history (party_id, event_id, response, changed_by, source, snapshot)
    VALUES (NEW.id, NEW.event_id, NEW.response, 'system', NEW.response_source,
            jsonb_build_object('label', NEW.label, 'notes', NEW.notes));
  ELSIF TG_OP = 'UPDATE' AND NEW.response IS DISTINCT FROM OLD.response THEN
    INSERT INTO rsvp_response_history (party_id, event_id, response, changed_by, source, snapshot)
    VALUES (NEW.id, NEW.event_id, NEW.response, 'system', NEW.response_source,
            jsonb_build_object('label', NEW.label, 'notes', NEW.notes));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_party_response_change
  AFTER INSERT OR UPDATE OF response ON rsvp_parties
  FOR EACH ROW EXECUTE FUNCTION handle_party_response_change();

-- ─── 14. submit_rsvp_v2 — atomic public RSVP write against the party/guest model ───
-- Faithful port of submit_rsvp() (final form: 20260704000000), preserving every
-- business rule (payment/review/status/deadline gating, meal validation, the
-- BIZ-1 guest cap, the response lock + RF-2 guest-edit override, RF-1 array
-- caps, SEC-8 field ownership check, and the email+phone duplicate guards) —
-- rebuilt around rsvp_parties + guests instead of one flat rsvps row.
--
-- Key model change: email/phone now live on the PRIMARY guest row, which is
-- always created (not just when response='yes'), so dedup keeps working for
-- no/maybe/pending responses exactly as it did when those columns lived
-- directly on rsvps.

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

  v_norm_email := NULLIF(lower(btrim(COALESCE(p_email, ''))), '');
  v_decline_reason := CASE WHEN p_response = 'no'    THEN NULLIF(p_decline_reason, '')   ELSE NULL END;
  v_maybe_confirm  := CASE WHEN p_response = 'maybe' THEN NULLIF(p_maybe_confirm_by, '') ELSE NULL END;

  -- ── 4. Meal validation (attending only), against the meal_selection field ──
  IF p_response = 'yes' THEN
    SELECT options, COALESCE(is_required, false)
      INTO v_meal_options, v_meal_required
      FROM custom_form_fields
     WHERE event_id = v_event.id AND field_key = 'meal_selection'
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
      response_source = 'web_form', responded_at = now(), updated_at = now()
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
    -- INSERT path: duplicate-email + duplicate-phone guards, then the
    -- partial unique indexes on guests are the race-condition backstop.
    IF v_norm_email IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM guests g JOIN rsvp_parties p ON p.id = g.party_id
        WHERE p.event_id = v_event.id AND g.is_primary_contact AND lower(g.email) = v_norm_email AND p.response <> 'no'
      ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_RSVP',
          'message', 'An RSVP with this email already exists for this event.');
      END IF;
    END IF;

    IF p_phone IS NOT NULL AND btrim(p_phone) <> '' THEN
      IF EXISTS (
        SELECT 1 FROM guests g JOIN rsvp_parties p ON p.id = g.party_id
        WHERE p.event_id = v_event.id AND g.is_primary_contact AND g.phone = p_phone AND p.response <> 'no'
      ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_RSVP',
          'message', 'An RSVP with this phone number already exists for this event.');
      END IF;
    END IF;

    INSERT INTO rsvp_parties (event_id, label, response, notes, decline_reason, maybe_confirm_by, response_source, responded_at)
    VALUES (v_event.id, p_guest_name, p_response::rsvp_response_type, p_notes, v_decline_reason, v_maybe_confirm, 'web_form', now())
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
  END IF;

  -- ── 6. Additional guests + custom answers (attending only) — HARD CAPPED (RF-1) ──
  IF p_response = 'yes' THEN
    INSERT INTO guests (party_id, event_id, full_name, is_primary_contact, meal_selection, dietary_notes)
    SELECT v_party_id, v_event.id, g.elem ->> 'fullName', false,
           NULLIF(g.elem ->> 'mealSelection', ''), NULLIF(g.elem ->> 'dietaryNotes', '')
    FROM jsonb_array_elements(COALESCE(p_additional_guests, '[]'::jsonb)) WITH ORDINALITY AS g(elem, ord)
    WHERE COALESCE(btrim(g.elem ->> 'fullName'), '') <> ''
      AND g.ord <= GREATEST(v_party_size - 1, 0);

    -- Custom answers: capped to 50, and each field_id must belong to THIS event (SEC-8).
    INSERT INTO custom_answers (party_id, field_id, answer_value)
    SELECT v_party_id, (a.elem ->> 'fieldId')::uuid, a.elem -> 'value'
    FROM jsonb_array_elements(COALESCE(p_custom_answers, '[]'::jsonb)) WITH ORDINALITY AS a(elem, ord)
    WHERE COALESCE(a.elem ->> 'fieldId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND a.ord <= 50
      AND EXISTS (
        SELECT 1 FROM custom_form_fields f
         WHERE f.id = (a.elem ->> 'fieldId')::uuid AND f.event_id = v_event.id
      );
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
    'org_phone', v_org_phone
  );
END;
$$;

-- Called by the backend with the service role only.
REVOKE ALL ON FUNCTION public.submit_rsvp_v2(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT) FROM anon, authenticated;

COMMIT;

BEGIN;

-- ─── 15. update_party_response — one-click email-button response path ───
-- Mirrors the old respondViaToken() backend logic: enforces the same
-- response lock, allows party_size adjustment only when accepting, and lets
-- the trigger (trg_party_response_change) handle seating cleanup + the audit
-- log. Adjusting party_size up creates unnamed placeholder companions
-- ("Guest 2", "Guest 3", ...) since the one-click email flow never collects
-- their names; the guest can fill those in later via the full RSVP form if
-- allow_guest_edits is on.

CREATE OR REPLACE FUNCTION public.update_party_response(
  p_event_id    UUID,
  p_party_id    UUID,
  p_response    TEXT,
  p_party_size  INTEGER DEFAULT NULL,
  p_actor       TEXT DEFAULT 'guest',
  p_source      TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_resp rsvp_response_type;
  v_current_count INTEGER;
  v_target_size   INTEGER;
BEGIN
  SELECT response INTO v_existing_resp FROM rsvp_parties WHERE id = p_party_id AND event_id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'RSVP_NOT_FOUND', 'message', 'The RSVP record was not found.');
  END IF;

  IF p_actor = 'guest' AND v_existing_resp IN ('yes', 'no', 'maybe') THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_RESPONDED',
      'message', 'You have already responded to this invitation.');
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
      INSERT INTO guests (party_id, event_id, full_name, is_primary_contact)
      SELECT p_party_id, p_event_id, 'Guest ' || gs, false
      FROM generate_series(v_current_count + 1, v_target_size) gs;
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

REVOKE ALL ON FUNCTION public.update_party_response(UUID, UUID, TEXT, INTEGER, TEXT, TEXT) FROM anon, authenticated;

-- ─── 16. add_guest_to_party — organizer manual add (new party or companion) ───
-- Mirrors the old addGuestManually(): a brand-new party's primary contact must
-- have a reachable phone number (organizer requirement for SMS reachability);
-- a companion added to an EXISTING party may omit phone/email entirely (they
-- may share the primary contact's phone, which the per-event uniqueness index
-- would otherwise reject). When p_party_id is NULL this creates a new party
-- with this guest as its primary contact; otherwise it adds a companion.

CREATE OR REPLACE FUNCTION public.add_guest_to_party(
  p_event_id  UUID,
  p_actor     UUID,
  p_full_name TEXT,
  p_party_id  UUID DEFAULT NULL,
  p_phone     TEXT DEFAULT NULL,
  p_email     TEXT DEFAULT NULL,
  p_response  TEXT DEFAULT 'pending'
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
BEGIN
  IF NOT public._is_event_authorized(p_event_id, p_actor) THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'You are not authorized to manage guests for this event.');
  END IF;

  IF p_party_id IS NULL AND NULLIF(btrim(COALESCE(p_phone, '')), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'VALIDATION_ERROR', 'message', 'A phone number is required for the primary contact.');
  END IF;

  IF p_party_id IS NULL THEN
    INSERT INTO rsvp_parties (event_id, label, response, response_source)
    VALUES (p_event_id, p_full_name, p_response::rsvp_response_type, 'manual')
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

REVOKE ALL ON FUNCTION public.add_guest_to_party(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT) FROM anon, authenticated;

COMMIT;

BEGIN;

-- ─── 17. Seating RPCs — mechanically re-keyed to party_id/guest counts ───
-- The seating-layout editor itself is out of scope for this rebuild, but it
-- cannot keep functioning against tables that no longer exist. These are
-- straight ports of the final versions (schema.sql + 20260702000000
-- feature_payment_gate) with rsvp_id -> party_id and party_size -> a live
-- COUNT(guests) — no behavior change beyond the rename.

CREATE OR REPLACE FUNCTION assign_seat(
    p_event_id UUID,
    p_party_id UUID,
    p_table_id UUID,
    p_assigned_by UUID,
    p_force BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_table_capacity INTEGER;
    v_current_occupied INTEGER;
    v_party_size INTEGER;
    v_remaining INTEGER;
    v_assignment_id UUID;
    v_existing UUID;
    v_table_name TEXT;
BEGIN
    IF NOT public._is_event_authorized(p_event_id, p_assigned_by) THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'You are not authorized to manage seating for this event.');
    END IF;

    IF NOT public._is_event_paid(p_event_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'FEATURE_REQUIRES_PAYMENT', 'message', 'Seating assignment requires a paid event.');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(p_table_id::text));

    SELECT id INTO v_existing FROM seating_assignments WHERE event_id = p_event_id AND party_id = p_party_id;
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ASSIGNED', 'message', 'This guest is already assigned to a table.');
    END IF;

    SELECT max_capacity, table_name INTO v_table_capacity, v_table_name
    FROM tables WHERE id = p_table_id AND event_id = p_event_id FOR UPDATE;

    IF v_table_capacity IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'TABLE_NOT_FOUND', 'message', 'Specified table not found.');
    END IF;

    SELECT COALESCE(SUM(gc.cnt), 0) INTO v_current_occupied
    FROM seating_assignments sa
    JOIN LATERAL (SELECT COUNT(*) AS cnt FROM guests g WHERE g.party_id = sa.party_id) gc ON true
    WHERE sa.table_id = p_table_id;

    SELECT COUNT(*) INTO v_party_size
    FROM guests g
    JOIN rsvp_parties p ON p.id = g.party_id
    WHERE g.party_id = p_party_id AND p.event_id = p_event_id AND p.response = 'yes';

    IF v_party_size = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'RSVP_NOT_FOUND', 'message', 'Party not found or guest is not attending.');
    END IF;

    v_remaining := v_table_capacity - v_current_occupied;
    IF (NOT p_force) AND v_party_size > v_remaining THEN
        RETURN jsonb_build_object('success', false, 'error', 'CAPACITY_EXCEEDED',
            'message', format('%s has %s remaining seats, party size is %s.', v_table_name, v_remaining, v_party_size));
    END IF;

    INSERT INTO seating_assignments (event_id, party_id, table_id, assigned_by)
    VALUES (p_event_id, p_party_id, p_table_id, p_assigned_by)
    RETURNING id INTO v_assignment_id;

    INSERT INTO activity_logs (event_id, actor_id, action, entity_type, entity_id, metadata)
    VALUES (p_event_id, p_assigned_by, 'table_assigned', 'seating_assignment', v_assignment_id,
            jsonb_build_object('table_id', p_table_id, 'table_name', v_table_name, 'party_size', v_party_size, 'forced', p_force));

    RETURN jsonb_build_object('success', true, 'assignment_id', v_assignment_id,
        'seats_remaining', v_remaining - v_party_size, 'forced', p_force);
END;
$$;

CREATE OR REPLACE FUNCTION reassign_seat(
    p_event_id UUID,
    p_party_id UUID,
    p_new_table_id UUID,
    p_assigned_by UUID,
    p_force BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_table_id UUID;
    v_old_table_name TEXT;
    v_new_table_capacity INTEGER;
    v_new_occupied INTEGER;
    v_party_size INTEGER;
    v_new_remaining INTEGER;
    v_new_table_name TEXT;
    v_assignment_id UUID;
BEGIN
    IF NOT public._is_event_authorized(p_event_id, p_assigned_by) THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'You are not authorized to manage seating for this event.');
    END IF;

    IF NOT public._is_event_paid(p_event_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'FEATURE_REQUIRES_PAYMENT', 'message', 'Seating assignment requires a paid event.');
    END IF;

    SELECT sa.table_id, t.table_name
    INTO v_old_table_id, v_old_table_name
    FROM seating_assignments sa
    JOIN tables t ON t.id = sa.table_id
    WHERE sa.event_id = p_event_id AND sa.party_id = p_party_id;

    IF v_old_table_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_ASSIGNED', 'message', 'Guest is not currently assigned to any table.');
    END IF;

    IF v_old_table_id = p_new_table_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'SAME_TABLE', 'message', 'Guest is already assigned to this table.');
    END IF;

    IF p_new_table_id > v_old_table_id THEN
        PERFORM pg_advisory_xact_lock(hashtext(v_old_table_id::text));
        PERFORM pg_advisory_xact_lock(hashtext(p_new_table_id::text));
    ELSE
        PERFORM pg_advisory_xact_lock(hashtext(p_new_table_id::text));
        PERFORM pg_advisory_xact_lock(hashtext(v_old_table_id::text));
    END IF;

    SELECT COUNT(*) INTO v_party_size FROM guests WHERE party_id = p_party_id;

    SELECT max_capacity, table_name
    INTO v_new_table_capacity, v_new_table_name
    FROM tables WHERE id = p_new_table_id AND event_id = p_event_id FOR UPDATE;

    SELECT COALESCE(SUM(gc.cnt), 0) INTO v_new_occupied
    FROM seating_assignments sa
    JOIN LATERAL (SELECT COUNT(*) AS cnt FROM guests g WHERE g.party_id = sa.party_id) gc ON true
    WHERE sa.table_id = p_new_table_id;

    v_new_remaining := v_new_table_capacity - v_new_occupied;

    IF (NOT p_force) AND v_party_size > v_new_remaining THEN
        RETURN jsonb_build_object('success', false, 'error', 'CAPACITY_EXCEEDED',
            'message', format('%s has %s remaining seats, party size is %s.', v_new_table_name, v_new_remaining, v_party_size));
    END IF;

    UPDATE seating_assignments
    SET table_id = p_new_table_id, assigned_at = now(), assigned_by = p_assigned_by
    WHERE event_id = p_event_id AND party_id = p_party_id
    RETURNING id INTO v_assignment_id;

    INSERT INTO activity_logs (event_id, actor_id, action, entity_type, entity_id, metadata)
    VALUES (p_event_id, p_assigned_by, 'table_reassigned', 'seating_assignment', v_assignment_id,
            jsonb_build_object('from_table', v_old_table_name, 'to_table', v_new_table_name, 'party_size', v_party_size, 'forced', p_force));

    RETURN jsonb_build_object('success', true, 'assignment_id', v_assignment_id,
        'from_table', v_old_table_name, 'to_table', v_new_table_name,
        'seats_remaining_new_table', v_new_remaining - v_party_size, 'forced', p_force);
END;
$$;

CREATE OR REPLACE FUNCTION unassign_seat(
    p_event_id   UUID,
    p_party_id   UUID,
    p_assigned_by UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_assignment_id  UUID;
    v_table_id       UUID;
    v_table_name     TEXT;
    v_party_size     INTEGER;
    v_table_capacity INTEGER;
    v_current_occupied INTEGER;
    v_remaining      INTEGER;
BEGIN
    IF NOT public._is_event_authorized(p_event_id, p_assigned_by) THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'You are not authorized to manage seating for this event.');
    END IF;

    SELECT sa.id, sa.table_id, t.table_name, t.max_capacity,
           (SELECT COUNT(*) FROM guests g WHERE g.party_id = sa.party_id)
    INTO v_assignment_id, v_table_id, v_table_name, v_table_capacity, v_party_size
    FROM public.seating_assignments sa
    JOIN public.tables t ON t.id = sa.table_id
    WHERE sa.event_id = p_event_id AND sa.party_id = p_party_id
    FOR UPDATE OF sa;

    IF v_assignment_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'ASSIGNMENT_NOT_FOUND', 'message', 'No seating assignment found for this event and party.');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(v_table_id::text));

    DELETE FROM public.seating_assignments WHERE event_id = p_event_id AND party_id = p_party_id;

    SELECT COALESCE(SUM(gc.cnt), 0) INTO v_current_occupied
    FROM public.seating_assignments sa
    JOIN LATERAL (SELECT COUNT(*) AS cnt FROM guests g WHERE g.party_id = sa.party_id) gc ON true
    WHERE sa.table_id = v_table_id;

    v_remaining := v_table_capacity - v_current_occupied;

    INSERT INTO public.activity_logs (event_id, actor_id, action, entity_type, entity_id, metadata)
    VALUES (p_event_id, p_assigned_by, 'table_unassigned', 'seating_assignment', v_assignment_id,
            jsonb_build_object('table_id', v_table_id, 'table_name', v_table_name, 'party_id', p_party_id, 'party_size', v_party_size));

    RETURN jsonb_build_object('success', true, 'message', format('Guest unassigned from %s.', v_table_name), 'seats_remaining', v_remaining);
END;
$$;

-- Aggregate read RPCs (server-side only).

CREATE OR REPLACE FUNCTION public.get_table_occupancy(p_event_id UUID)
RETURNS TABLE(table_id UUID, occupied BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id AS table_id,
         COALESCE(COUNT(g.id), 0)::BIGINT AS occupied
  FROM tables t
  LEFT JOIN seating_assignments sa ON sa.table_id = t.id
  LEFT JOIN rsvp_parties p ON p.id = sa.party_id AND p.response = 'yes'
  LEFT JOIN guests g ON g.party_id = p.id
  WHERE t.event_id = p_event_id
  GROUP BY t.id;
$$;

CREATE OR REPLACE FUNCTION public.get_seating_summary(p_event_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH attending AS (
    SELECT p.id, (SELECT COUNT(*) FROM guests g WHERE g.party_id = p.id) AS party_size
    FROM rsvp_parties p
    WHERE p.event_id = p_event_id AND p.response = 'yes'
  ),
  seated AS (
    SELECT DISTINCT sa.party_id
    FROM seating_assignments sa
    JOIN attending a ON a.id = sa.party_id
    WHERE sa.event_id = p_event_id
  )
  SELECT jsonb_build_object(
    'attendingParties', (SELECT COUNT(*) FROM attending),
    'attendingGuests',  (SELECT COALESCE(SUM(party_size), 0) FROM attending),
    'seatedParties',    (SELECT COUNT(*) FROM seated),
    'seatedGuests',     (SELECT COALESCE(SUM(a.party_size), 0)
                           FROM attending a WHERE a.id IN (SELECT party_id FROM seated)),
    'unseatedParties',  (SELECT COUNT(*) FROM attending a WHERE a.id NOT IN (SELECT party_id FROM seated)),
    'unseatedGuests',   (SELECT COALESCE(SUM(a.party_size), 0)
                           FROM attending a WHERE a.id NOT IN (SELECT party_id FROM seated))
  );
$$;

CREATE OR REPLACE FUNCTION public.get_seating_guests(
  p_event_id UUID,
  p_search   TEXT DEFAULT '',
  p_filter   TEXT DEFAULT 'all',
  p_limit    INT  DEFAULT 100,
  p_offset   INT  DEFAULT 0,
  p_table_id UUID DEFAULT NULL
)
RETURNS TABLE(id UUID, guest_name TEXT, party_size INT, table_id UUID, total_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         p.label AS guest_name,
         (SELECT COUNT(*)::INT FROM guests g WHERE g.party_id = p.id) AS party_size,
         sa.table_id,
         COUNT(*) OVER() AS total_count
  FROM rsvp_parties p
  LEFT JOIN seating_assignments sa
    ON sa.party_id = p.id AND sa.event_id = p_event_id
  WHERE p.event_id = p_event_id
    AND p.response = 'yes'
    AND (p_search IS NULL OR p_search = '' OR p.label ILIKE '%' || p_search || '%')
    AND (
      p_table_id IS NOT NULL AND sa.table_id = p_table_id
      OR (p_table_id IS NULL AND (
            p_filter = 'all'
            OR (p_filter = 'seated'   AND sa.table_id IS NOT NULL)
            OR (p_filter = 'unseated' AND sa.table_id IS NULL)
      ))
    )
  ORDER BY p.label, p.id
  LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0);
$$;

REVOKE ALL ON FUNCTION public.get_table_occupancy(UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_seating_summary(UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_seating_guests(UUID, TEXT, TEXT, INT, INT, UUID) FROM anon, authenticated;

-- ─── 18. get_executive_overview — mechanical re-key of the 'rsvps' sub-object ───
-- Out of scope (super-admin finance dashboard), but it cannot keep
-- referencing a table that no longer exists. Only the 'rsvps' block changes;
-- everything else (events/revenue/sms/recentActivity) is untouched.

CREATE OR REPLACE FUNCTION get_executive_overview()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'events', (
      SELECT jsonb_build_object(
        'total',  count(*),
        'paid',   count(*) FILTER (WHERE is_paid),
        'unpaid', count(*) FILTER (WHERE NOT is_paid),
        'byStatus', jsonb_build_object(
          'draft',          count(*) FILTER (WHERE status = 'draft'),
          'pending_review', count(*) FILTER (WHERE status = 'pending_review'),
          'active',         count(*) FILTER (WHERE status = 'active'),
          'paused',         count(*) FILTER (WHERE status = 'paused'),
          'completed',      count(*) FILTER (WHERE status = 'completed')
        )
      ) FROM events
    ),
    'organizations', (SELECT count(*) FROM organizations),
    'rsvps', (
      SELECT jsonb_build_object(
        'total',            (SELECT count(*) FROM rsvp_parties),
        'attendingParties', (SELECT count(*) FROM rsvp_parties WHERE response = 'yes'),
        'attendingGuests',  (SELECT COALESCE(count(*), 0) FROM guests g JOIN rsvp_parties p ON p.id = g.party_id WHERE p.response = 'yes'),
        'declined',         (SELECT count(*) FROM rsvp_parties WHERE response = 'no'),
        'pending',          (SELECT count(*) FROM rsvp_parties WHERE response NOT IN ('yes', 'no'))
      )
    ),
    'checkIns', (SELECT count(*) FROM check_ins),
    'revenue', jsonb_build_object(
      'grossCents',    (SELECT COALESCE(sum(amount_cents), 0) FROM event_payments WHERE status = 'completed'),
      'pendingCents',  (SELECT COALESCE(sum(amount_cents), 0) FROM event_payments WHERE status = 'pending'),
      'refundedCents', (SELECT COALESCE(sum(amount_cents), 0) FROM event_payments WHERE status = 'refunded'),
      'byMonth', (
        SELECT COALESCE(jsonb_object_agg(m, cents), '{}'::jsonb)
        FROM (
          SELECT to_char(date_trunc('month', COALESCE(completed_at, created_at)), 'YYYY-MM') AS m,
                 sum(amount_cents) AS cents
          FROM event_payments
          WHERE status = 'completed'
            AND COALESCE(completed_at, created_at) >= (now() - interval '12 months')
          GROUP BY 1
        ) t
      )
    ),
    'sms', (
      SELECT jsonb_build_object(
        'purchased', COALESCE(sum(credits_purchased), 0),
        'used',      COALESCE(sum(credits_used), 0),
        'remaining', COALESCE(sum(credits_purchased), 0) - COALESCE(sum(credits_used), 0)
      ) FROM sms_credit_wallets
    ),
    'recentActivity', (
      SELECT COALESCE(jsonb_agg(a ORDER BY a."createdAt" DESC), '[]'::jsonb)
      FROM (
        SELECT al.id,
               al.action,
               al.entity_type AS "entityType",
               al.created_at  AS "createdAt",
               e.title        AS "eventTitle"
        FROM activity_logs al
        LEFT JOIN events e ON e.id = al.event_id
        ORDER BY al.created_at DESC
        LIMIT 12
      ) a
    )
  );
$$;

COMMIT;

BEGIN;

-- ─── 19. ROW LEVEL SECURITY ───
-- Security fix (audit finding): the old guest_select_rsvps/guest_select_rsvp_guests
-- policies let ANY anonymous caller with the (public) anon key read every other
-- guest's name, email, phone, and custom answers for any paid+active event,
-- regardless of privacy_mode. That's structurally impossible to repeat here:
-- email/phone/dietary_notes/meal_selection now live ONLY on `guests`, and
-- `guests` gets NO public SELECT policy at all — the legitimate "find my
-- invitation" / "search my name" features are served by the backend's
-- service-role client (which bypasses RLS entirely), never by a direct
-- anon-key table read. Public listing of `rsvp_parties` (label + response
-- only — no PII by construction) is opt-in per event via guest_list_visibility.

ALTER TABLE rsvp_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_response_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

-- ── rsvp_parties ──

CREATE POLICY organizer_all_rsvp_parties ON rsvp_parties
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e JOIN organizations o ON e.org_id = o.id
        WHERE e.id = rsvp_parties.event_id AND o.owner_user_id = auth.uid()
    ))
    WITH CHECK (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e JOIN organizations o ON e.org_id = o.id
        WHERE e.id = rsvp_parties.event_id AND o.owner_user_id = auth.uid()
    ));

-- Public listing is opt-in (events.guest_list_visibility != 'none') and
-- never exposes anything beyond label/response — no email/phone, since
-- those columns don't exist on this table.
CREATE POLICY guest_select_rsvp_parties ON rsvp_parties
    FOR SELECT TO public
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = rsvp_parties.event_id
              AND events.is_paid = true
              AND events.status = 'active'
              AND events.guest_list_visibility <> 'none'
        )
    );

-- ── guests ── (no public SELECT/INSERT policy: this is where PII lives;
-- all public-facing guest reads/writes go through SECURITY DEFINER RPCs or
-- the backend's service-role client, both of which bypass RLS by design.)

CREATE POLICY organizer_all_guests ON guests
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e JOIN organizations o ON e.org_id = o.id
        WHERE e.id = guests.event_id AND o.owner_user_id = auth.uid()
    ))
    WITH CHECK (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e JOIN organizations o ON e.org_id = o.id
        WHERE e.id = guests.event_id AND o.owner_user_id = auth.uid()
    ));

-- ── invitations ── (organizer-readable audit ledger; writes are RPC/backend-only)

CREATE POLICY organizer_select_invitations ON invitations
    FOR SELECT TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e JOIN organizations o ON e.org_id = o.id
        WHERE e.id = invitations.event_id AND o.owner_user_id = auth.uid()
    ));

-- ── rsvp_response_history ── (organizer-readable audit trail; system-written only)

CREATE POLICY organizer_select_response_history ON rsvp_response_history
    FOR SELECT TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e JOIN organizations o ON e.org_id = o.id
        WHERE e.id = rsvp_response_history.event_id AND o.owner_user_id = auth.uid()
    ));

-- ── custom_answers ── (no public policy: answers may carry PII-adjacent
-- content such as dietary notes; organizer-only + RPC/service-role writes)

CREATE POLICY organizer_all_custom_answers ON custom_answers
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM rsvp_parties p JOIN events e ON p.event_id = e.id JOIN organizations o ON e.org_id = o.id
        WHERE p.id = custom_answers.party_id AND o.owner_user_id = auth.uid()
    ))
    WITH CHECK (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM rsvp_parties p JOIN events e ON p.event_id = e.id JOIN organizations o ON e.org_id = o.id
        WHERE p.id = custom_answers.party_id AND o.owner_user_id = auth.uid()
    ));

-- ── seating_assignments ── (table_id/party_id only, no guest PII; keep the
-- public SELECT so the guest's own "find my table" view keeps working)

CREATE POLICY organizer_all_seating ON seating_assignments
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e JOIN organizations o ON e.org_id = o.id
        WHERE e.id = seating_assignments.event_id AND o.owner_user_id = auth.uid()
    ))
    WITH CHECK (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e JOIN organizations o ON e.org_id = o.id
        WHERE e.id = seating_assignments.event_id AND o.owner_user_id = auth.uid()
    ));

CREATE POLICY guest_select_seating ON seating_assignments
    FOR SELECT TO public
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = seating_assignments.event_id
              AND events.is_paid = true
              AND events.status = 'active'
        )
    );

-- ── check_ins ── (organizer/staff only; self-check-in writes go through the
-- backend's service-role client, mirroring the old design)

CREATE POLICY organizer_all_checkins ON check_ins
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e JOIN organizations o ON e.org_id = o.id
        WHERE e.id = check_ins.event_id AND o.owner_user_id = auth.uid()
    ))
    WITH CHECK (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e JOIN organizations o ON e.org_id = o.id
        WHERE e.id = check_ins.event_id AND o.owner_user_id = auth.uid()
    ));

COMMIT;

