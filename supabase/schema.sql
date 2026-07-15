-- ============================================================================
-- Fancy RSVP — Database Schema (generated reference snapshot)
--
-- SOURCE OF TRUTH: supabase/migrations/*.sql AND backend/migrations/*.sql
--
-- This file is a human-readable snapshot of the FINAL schema produced by
-- applying every migration in order, through:
--   supabase/migrations/20260719000000_marketing_forms.sql
--   backend/migrations/006_guest_cap_response_update_trigger.sql
-- It is NOT executed at deploy time — the migrations are. Regenerate it
-- whenever migrations change:
--   apply all migrations to a clean Postgres, then
--   pg_dump --schema-only --schema=public --no-owner --no-comments
--
-- Guest model: rsvp_parties + guests, keyed by party_id. The legacy
-- rsvps / rsvp_id guest model was rebuilt in
-- 20260705000000_guest_experience_rebuild and no longer exists.
--
-- NOTE ON STRUCTURE: everything up to the "SCHEMA public; Type: ACL" section
-- near the end of this file is a genuine pg_dump-style snapshot current
-- through 20260712000000_tier_watermark_and_limits.sql. Everything AFTER that
-- marker was appended by hand (not re-dumped) to bring the snapshot fully
-- current through 20260719 + the backend/migrations/*.sql triggers — each
-- appended block is self-contained (CREATE TABLE/COLUMN IF NOT EXISTS, or
-- DROP FUNCTION IF EXISTS + CREATE FUNCTION for signature changes), so running
-- this entire file top-to-bottom against a blank database still produces the
-- exact correct final state. Fold these into the dumped section proper the
-- next time this file is regenerated from a live database.
-- ============================================================================

-- Function bodies reference tables created further down in this file; disable
-- body validation so the snapshot replays regardless of object order (this is
-- exactly what pg_dump emits).
SET check_function_bodies = false;

-- Extensions (as declared by the migrations).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Name: form_field_scope_type; Type: TYPE; Schema: public

CREATE TYPE public.form_field_scope_type AS ENUM (
    'party',
    'guest'
);

-- Name: guest_list_visibility_type; Type: TYPE; Schema: public

CREATE TYPE public.guest_list_visibility_type AS ENUM (
    'none',
    'attending_only',
    'all_responses',
    'anonymized'
);

-- Name: invitation_channel_type; Type: TYPE; Schema: public

CREATE TYPE public.invitation_channel_type AS ENUM (
    'email',
    'sms',
    'qr',
    'public_link'
);

-- Name: invitation_status_type; Type: TYPE; Schema: public

CREATE TYPE public.invitation_status_type AS ENUM (
    'queued',
    'sent',
    'delivered',
    'failed',
    'opened',
    'responded'
);

-- Name: rsvp_response_type; Type: TYPE; Schema: public

CREATE TYPE public.rsvp_response_type AS ENUM (
    'pending',
    'yes',
    'no',
    'maybe',
    'waitlist'
);

-- Name: _is_event_authorized(uuid, uuid); Type: FUNCTION; Schema: public

CREATE FUNCTION public._is_event_authorized(p_event_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM events e
        JOIN organizations o ON e.org_id = o.id
        WHERE e.id = p_event_id
          AND (o.owner_user_id = p_user_id OR is_super_admin(p_user_id))
    );
END;
$$;

-- Name: _is_event_paid(uuid); Type: FUNCTION; Schema: public

CREATE FUNCTION public._is_event_paid(p_event_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM events
        WHERE id = p_event_id
          AND (is_paid = true OR manual_override = true)
    );
END;
$$;

-- Name: add_guest_to_party(uuid, uuid, text, uuid, text, text, text); Type: FUNCTION; Schema: public

CREATE FUNCTION public.add_guest_to_party(p_event_id uuid, p_actor uuid, p_full_name text, p_party_id uuid DEFAULT NULL::uuid, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_response text DEFAULT 'pending'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

-- Name: approve_event_cash(uuid, uuid, integer); Type: FUNCTION; Schema: public

CREATE FUNCTION public.approve_event_cash(p_event_id uuid, p_approved_by uuid, p_amount_cents integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_payment_id UUID;
    v_org_id UUID;
BEGIN
    -- Verify approver is super admin
    SELECT is_super_admin(p_approved_by) INTO v_is_admin;
    IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Only super admins can approve payments.');
    END IF;

    -- Verify event exists
    SELECT org_id INTO v_org_id FROM events WHERE id = p_event_id;
    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'EVENT_NOT_FOUND', 'message', 'Specified event not found.');
    END IF;

    -- Update event payment state
    UPDATE events
    SET is_paid = true,
        status = 'active',
        updated_at = now()
    WHERE id = p_event_id;

    -- Check if there is an existing pending cash_manual payment record for this event
    SELECT id INTO v_payment_id FROM event_payments
    WHERE event_id = p_event_id AND payment_method = 'cash_manual' AND status = 'pending'
    LIMIT 1;

    IF v_payment_id IS NOT NULL THEN
        UPDATE event_payments
        SET status = 'completed',
            approved_by = p_approved_by,
            completed_at = now(),
            amount_cents = p_amount_cents
        WHERE id = v_payment_id;
    ELSE
        -- Insert a new payment record if none existed
        INSERT INTO event_payments (
            event_id,
            amount_cents,
            currency,
            status,
            payment_method,
            approved_by,
            completed_at
        ) VALUES (
            p_event_id,
            p_amount_cents,
            'usd',
            'completed',
            'cash_manual',
            p_approved_by,
            now()
        ) RETURNING id INTO v_payment_id;
    END IF;

    -- Insert activity log
    INSERT INTO activity_logs (
        event_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata
    ) VALUES (
        p_event_id,
        p_approved_by,
        'event_payment_manual_approved',
        'event_payment',
        v_payment_id,
        jsonb_build_object('amount_cents', p_amount_cents)
    );

    RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id);
END;
$$;

-- Name: assign_seat(uuid, uuid, uuid, uuid, boolean); Type: FUNCTION; Schema: public

CREATE FUNCTION public.assign_seat(p_event_id uuid, p_party_id uuid, p_table_id uuid, p_assigned_by uuid, p_force boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

SET default_tablespace = '';

SET default_table_access_method = heap;

-- Name: sms_campaigns; Type: TABLE; Schema: public

CREATE TABLE public.sms_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    message_template text NOT NULL,
    audience text,
    status text DEFAULT 'queued'::text NOT NULL,
    total_recipients integer DEFAULT 0 NOT NULL,
    sent_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    skipped_count integer DEFAULT 0 NOT NULL,
    credits_used integer DEFAULT 0 NOT NULL,
    client_token text,
    last_error text,
    created_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sms_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'queued'::text, 'processing'::text, 'completed'::text, 'partial'::text, 'failed'::text, 'cancelled'::text])))
);

-- Name: claim_next_sms_campaign(); Type: FUNCTION; Schema: public

CREATE FUNCTION public.claim_next_sms_campaign() RETURNS SETOF public.sms_campaigns
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    UPDATE sms_campaigns c
    SET status     = 'processing',
        started_at = COALESCE(c.started_at, now()),
        updated_at = now()
    WHERE c.id = (
        SELECT id FROM sms_campaigns
        WHERE status IN ('queued', 'processing')
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING c.*;
END;
$$;

-- Name: sms_campaign_recipients; Type: TABLE; Schema: public

CREATE TABLE public.sms_campaign_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    event_id uuid NOT NULL,
    rsvp_id uuid,
    guest_name text,
    phone text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    segments integer DEFAULT 1 NOT NULL,
    credits_charged integer DEFAULT 0 NOT NULL,
    sms_sid text,
    ledger_id uuid,
    idempotency_key text NOT NULL,
    error text,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    delivery_status text,
    delivered_at timestamp with time zone,
    CONSTRAINT sms_campaign_recipients_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))
);

-- Name: claim_sms_recipients(uuid, integer); Type: FUNCTION; Schema: public

CREATE FUNCTION public.claim_sms_recipients(p_campaign_id uuid, p_limit integer) RETURNS SETOF public.sms_campaign_recipients
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    UPDATE sms_campaign_recipients r
    SET status     = 'processing',
        attempts   = r.attempts + 1,
        updated_at = now()
    WHERE r.id IN (
        SELECT id FROM sms_campaign_recipients
        WHERE campaign_id = p_campaign_id AND status = 'queued'
        ORDER BY created_at
        LIMIT GREATEST(p_limit, 1)
        FOR UPDATE SKIP LOCKED
    )
    RETURNING r.*;
END;
$$;

-- Name: deduct_sms_credit_atomic(uuid, text); Type: FUNCTION; Schema: public

CREATE FUNCTION public.deduct_sms_credit_atomic(p_event_id uuid, p_phone text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_wallet_id UUID;
    v_remaining INTEGER;
    v_ledger_id UUID;
BEGIN
    -- Row-lock the wallet to prevent concurrent double-spending
    SELECT id, (credits_purchased - credits_used) 
    INTO v_wallet_id, v_remaining
    FROM sms_credit_wallets
    WHERE event_id = p_event_id
    FOR UPDATE;

    IF v_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NO_WALLET');
    END IF;

    IF v_remaining < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_CREDITS');
    END IF;

    -- Increment credits_used
    UPDATE sms_credit_wallets
    SET credits_used = credits_used + 1,
        updated_at = now()
    WHERE id = v_wallet_id;

    -- Insert ledger entry in consumption state
    INSERT INTO sms_credit_ledger (wallet_id, event_id, transaction_type, credits, sms_recipient)
    VALUES (v_wallet_id, p_event_id, 'consumption', -1, p_phone)
    RETURNING id INTO v_ledger_id;

    RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet_id, 'ledger_id', v_ledger_id);
END;
$$;

-- Name: deduct_sms_credit_atomic(uuid, text, text); Type: FUNCTION; Schema: public

CREATE FUNCTION public.deduct_sms_credit_atomic(p_event_id uuid, p_phone text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_wallet_id UUID;
    v_remaining INTEGER;
    v_ledger_id UUID;
    v_existing_ledger_id UUID;
BEGIN
    -- Idempotency check: if key is provided, check for existing entry
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_ledger_id
        FROM sms_credit_ledger
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_ledger_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'ledger_id', v_existing_ledger_id,
                'idempotent', true
            );
        END IF;
    END IF;

    -- Row-lock the wallet to prevent concurrent double-spending
    SELECT id, (credits_purchased - credits_used)
    INTO v_wallet_id, v_remaining
    FROM sms_credit_wallets
    WHERE event_id = p_event_id
    FOR UPDATE;

    IF v_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NO_WALLET');
    END IF;

    IF v_remaining < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_CREDITS');
    END IF;

    -- Increment credits_used
    UPDATE sms_credit_wallets
    SET credits_used = credits_used + 1,
        updated_at = now()
    WHERE id = v_wallet_id;

    -- Insert ledger entry in consumption state
    INSERT INTO sms_credit_ledger (wallet_id, event_id, transaction_type, credits, sms_recipient, idempotency_key)
    VALUES (v_wallet_id, p_event_id, 'consumption', -1, p_phone, p_idempotency_key)
    RETURNING id INTO v_ledger_id;

    RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet_id, 'ledger_id', v_ledger_id);
END;
$$;

-- Name: deduct_sms_credits_atomic(uuid, integer, text, text); Type: FUNCTION; Schema: public

CREATE FUNCTION public.deduct_sms_credits_atomic(p_event_id uuid, p_count integer, p_phone text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_wallet_id          UUID;
    v_remaining          INTEGER;
    v_ledger_id          UUID;
    v_existing_ledger_id UUID;
BEGIN
    IF p_count IS NULL OR p_count < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_COUNT');
    END IF;

    -- Idempotency gate: a key that's already been charged short-circuits here.
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_ledger_id
        FROM sms_credit_ledger
        WHERE idempotency_key = p_idempotency_key;

        IF v_existing_ledger_id IS NOT NULL THEN
            RETURN jsonb_build_object('success', true, 'ledger_id', v_existing_ledger_id, 'idempotent', true);
        END IF;
    END IF;

    -- Row-lock the wallet to serialize concurrent campaigns / double-clicks.
    SELECT id, (credits_purchased - credits_used)
    INTO v_wallet_id, v_remaining
    FROM sms_credit_wallets
    WHERE event_id = p_event_id
    FOR UPDATE;

    IF v_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NO_WALLET');
    END IF;

    IF v_remaining < p_count THEN
        RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_CREDITS',
            'remaining', v_remaining, 'required', p_count);
    END IF;

    UPDATE sms_credit_wallets
    SET credits_used = credits_used + p_count,
        updated_at   = now()
    WHERE id = v_wallet_id;

    INSERT INTO sms_credit_ledger (wallet_id, event_id, transaction_type, credits, sms_recipient, idempotency_key)
    VALUES (v_wallet_id, p_event_id, 'consumption', -p_count, p_phone, p_idempotency_key)
    RETURNING id INTO v_ledger_id;

    RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet_id, 'ledger_id', v_ledger_id, 'credits', p_count);
END;
$$;

-- Name: get_executive_overview(); Type: FUNCTION; Schema: public

CREATE FUNCTION public.get_executive_overview() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
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

-- Name: get_seating_guests(uuid, text, text, integer, integer, uuid); Type: FUNCTION; Schema: public

CREATE FUNCTION public.get_seating_guests(p_event_id uuid, p_search text DEFAULT ''::text, p_filter text DEFAULT 'all'::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_table_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, guest_name text, party_size integer, table_id uuid, total_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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

-- Name: get_seating_summary(uuid); Type: FUNCTION; Schema: public

CREATE FUNCTION public.get_seating_summary(p_event_id uuid) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
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

-- Name: get_table_occupancy(uuid); Type: FUNCTION; Schema: public

CREATE FUNCTION public.get_table_occupancy(p_event_id uuid) RETURNS TABLE(table_id uuid, occupied bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
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

-- Name: handle_party_response_change(); Type: FUNCTION; Schema: public

CREATE FUNCTION public.handle_party_response_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

-- Name: increment_sms_credits(uuid, integer); Type: FUNCTION; Schema: public

CREATE FUNCTION public.increment_sms_credits(p_event_id uuid, p_credit_amount integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE sms_credit_wallets
  SET credits_purchased = credits_purchased + p_credit_amount
  WHERE event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SMS credit wallet not found for event %', p_event_id;
  END IF;
END;
$$;

-- Name: is_super_admin(uuid); Type: FUNCTION; Schema: public

CREATE FUNCTION public.is_super_admin(p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = p_user_id AND role = 'super_admin'
    );
END;
$$;

-- Name: reassign_seat(uuid, uuid, uuid, uuid, boolean); Type: FUNCTION; Schema: public

CREATE FUNCTION public.reassign_seat(p_event_id uuid, p_party_id uuid, p_new_table_id uuid, p_assigned_by uuid, p_force boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

-- Name: reconcile_sms_delivery(text, text, text); Type: FUNCTION; Schema: public

CREATE FUNCTION public.reconcile_sms_delivery(p_sms_sid text, p_status text, p_error_code text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_status      TEXT := lower(COALESCE(p_status, ''));
    v_is_failure  BOOLEAN;
    v_recipient   sms_campaign_recipients%ROWTYPE;
    v_ledger      sms_credit_ledger%ROWTYPE;
    v_refund      INTEGER;
    v_err_suffix  TEXT := COALESCE(' code ' || p_error_code, '');
BEGIN
    IF p_sms_sid IS NULL OR p_sms_sid = '' THEN
        RETURN jsonb_build_object('found', false, 'refunded', false, 'error', 'NO_SID');
    END IF;
    v_is_failure := v_status IN ('undelivered', 'failed');

    -- Lock the matching recipient job row (may be absent for synchronous sends).
    SELECT * INTO v_recipient
    FROM sms_campaign_recipients
    WHERE sms_sid = p_sms_sid
    FOR UPDATE;

    -- ── Success / in-flight states: just record delivery status, never refund ──
    IF NOT v_is_failure THEN
        IF v_recipient.id IS NOT NULL THEN
            UPDATE sms_campaign_recipients
            SET delivery_status = v_status,
                delivered_at    = CASE WHEN v_status = 'delivered' THEN now() ELSE delivered_at END,
                updated_at      = now()
            WHERE id = v_recipient.id;
        END IF;
        RETURN jsonb_build_object('found', v_recipient.id IS NOT NULL, 'refunded', false, 'status', v_status);
    END IF;

    -- ── Failure: refund the consumption ledger row for this SID (once) ──
    SELECT * INTO v_ledger
    FROM sms_credit_ledger
    WHERE sms_sid = p_sms_sid AND transaction_type = 'consumption'
    FOR UPDATE;

    IF v_ledger.id IS NULL THEN
        -- Already refunded, or sid not yet stamped. Still mark the recipient failed.
        IF v_recipient.id IS NOT NULL AND v_recipient.status <> 'failed' THEN
            UPDATE sms_campaign_recipients
            SET status = 'failed', delivery_status = v_status, credits_charged = 0,
                error = 'delivery:' || v_status || v_err_suffix, updated_at = now()
            WHERE id = v_recipient.id;
        END IF;
        RETURN jsonb_build_object('found', v_recipient.id IS NOT NULL, 'refunded', false, 'already', true,
            'campaign_id', v_recipient.campaign_id);
    END IF;

    v_refund := GREATEST(ABS(v_ledger.credits), 1);

    -- Decrement usage (clamped ≥ 0) and remove the consumption row → idempotent.
    UPDATE sms_credit_wallets
    SET credits_used = GREATEST(credits_used - v_refund, 0), updated_at = now()
    WHERE id = v_ledger.wallet_id;

    DELETE FROM sms_credit_ledger WHERE id = v_ledger.id;

    IF v_recipient.id IS NOT NULL THEN
        UPDATE sms_campaign_recipients
        SET status = 'failed', delivery_status = v_status, credits_charged = 0,
            error = 'delivery:' || v_status || v_err_suffix, updated_at = now()
        WHERE id = v_recipient.id;
    END IF;

    RETURN jsonb_build_object('found', true, 'refunded', true, 'credits', v_refund,
        'event_id', v_ledger.event_id, 'campaign_id', v_recipient.campaign_id);
END;
$$;

-- Name: record_sms_purchase(uuid, integer, text); Type: FUNCTION; Schema: public

CREATE FUNCTION public.record_sms_purchase(p_event_id uuid, p_credits integer, p_payment_intent text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDITS');
  END IF;

  -- 1. Ensure the wallet exists (idempotent on the unique event_id).
  INSERT INTO sms_credit_wallets (event_id, credits_purchased, credits_used)
  VALUES (p_event_id, 0, 0)
  ON CONFLICT (event_id) DO NOTHING;

  SELECT id INTO v_wallet_id FROM sms_credit_wallets WHERE event_id = p_event_id;
  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'WALLET_NOT_FOUND');
  END IF;

  -- 2. Idempotency gate: the partial unique index on (stripe_payment_intent_id)
  --    WHERE transaction_type = 'purchase' makes a repeat payment raise here.
  BEGIN
    INSERT INTO sms_credit_ledger (wallet_id, event_id, transaction_type, credits, stripe_payment_intent_id)
    VALUES (v_wallet_id, p_event_id, 'purchase', p_credits, p_payment_intent);
  EXCEPTION WHEN unique_violation THEN
    -- Already processed by an earlier (committed) call that also credited.
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END;

  -- 3. Credit the wallet in the SAME transaction as the ledger insert.
  UPDATE sms_credit_wallets
  SET credits_purchased = credits_purchased + p_credits,
      updated_at = now()
  WHERE id = v_wallet_id;

  RETURN jsonb_build_object('success', true, 'already_processed', false);
END;
$$;

-- Name: refresh_daily_revenue(); Type: FUNCTION; Schema: public

CREATE FUNCTION public.refresh_daily_revenue() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_revenue;
EXCEPTION WHEN OTHERS THEN
  -- CONCURRENTLY requires a prior populate; fall back on first run.
  REFRESH MATERIALIZED VIEW mv_daily_revenue;
END;
$$;

-- Name: refund_sms_credit_atomic(uuid, uuid, uuid); Type: FUNCTION; Schema: public

CREATE FUNCTION public.refund_sms_credit_atomic(p_wallet_id uuid, p_event_id uuid, p_ledger_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_credits_used INTEGER;
BEGIN
    -- Row-lock the wallet to prevent concurrent modifications
    SELECT credits_used
    INTO v_credits_used
    FROM sms_credit_wallets
    WHERE id = p_wallet_id
      AND event_id = p_event_id
    FOR UPDATE;

    -- Validate wallet exists
    IF v_credits_used IS NULL THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND: No wallet found for id=% event=%',
            p_wallet_id, p_event_id;
    END IF;

    -- Validate credits_used > 0 before decrementing (prevent going negative)
    IF v_credits_used <= 0 THEN
        RAISE EXCEPTION 'INVALID_REFUND: credits_used is already 0, cannot refund further';
    END IF;

    -- Revert credits_used decrement
    UPDATE sms_credit_wallets
    SET credits_used = credits_used - 1,
        updated_at   = now()
    WHERE id = p_wallet_id;

    -- Delete the failed/refunded transaction record from ledger
    DELETE FROM sms_credit_ledger
    WHERE id = p_ledger_id;
END;
$$;

-- Name: refund_sms_credits_atomic(uuid, uuid, uuid, integer); Type: FUNCTION; Schema: public

CREATE FUNCTION public.refund_sms_credits_atomic(p_wallet_id uuid, p_event_id uuid, p_ledger_id uuid, p_count integer DEFAULT 1) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_credits_used INTEGER;
    v_refund       INTEGER;
BEGIN
    v_refund := GREATEST(COALESCE(p_count, 1), 1);

    SELECT credits_used
    INTO v_credits_used
    FROM sms_credit_wallets
    WHERE id = p_wallet_id AND event_id = p_event_id
    FOR UPDATE;

    IF v_credits_used IS NULL THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND: No wallet for id=% event=%', p_wallet_id, p_event_id;
    END IF;

    -- Clamp so a buggy/duplicate refund can never push credits_used below zero.
    IF v_refund > v_credits_used THEN
        v_refund := v_credits_used;
    END IF;

    UPDATE sms_credit_wallets
    SET credits_used = credits_used - v_refund,
        updated_at   = now()
    WHERE id = p_wallet_id;

    DELETE FROM sms_credit_ledger WHERE id = p_ledger_id;
END;
$$;

-- Name: requeue_stale_sms_recipients(uuid, integer); Type: FUNCTION; Schema: public

CREATE FUNCTION public.requeue_stale_sms_recipients(p_campaign_id uuid, p_stale_seconds integer DEFAULT 300) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE sms_campaign_recipients
    SET status = 'queued', updated_at = now()
    WHERE campaign_id = p_campaign_id
      AND status = 'processing'
      AND updated_at < now() - make_interval(secs => GREATEST(p_stale_seconds, 30));
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Name: sms_campaign_progress(uuid); Type: FUNCTION; Schema: public

CREATE FUNCTION public.sms_campaign_progress(p_campaign_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT jsonb_build_object(
        'sent',       COUNT(*) FILTER (WHERE status = 'sent'),
        'failed',     COUNT(*) FILTER (WHERE status = 'failed'),
        'skipped',    COUNT(*) FILTER (WHERE status = 'skipped'),
        'queued',     COUNT(*) FILTER (WHERE status = 'queued'),
        'processing', COUNT(*) FILTER (WHERE status = 'processing'),
        'total',      COUNT(*),
        'credits',    COALESCE(SUM(credits_charged) FILTER (WHERE status = 'sent'), 0)
    )
    FROM sms_campaign_recipients
    WHERE campaign_id = p_campaign_id;
$$;

-- Name: submit_rsvp_v2(text, uuid, text, text, text, text, integer, text, text, jsonb, jsonb, text, text); Type: FUNCTION; Schema: public

CREATE FUNCTION public.submit_rsvp_v2(p_slug text, p_party_id uuid, p_guest_name text, p_email text, p_phone text, p_response text, p_party_size integer, p_notes text, p_primary_meal text, p_additional_guests jsonb, p_custom_answers jsonb, p_decline_reason text, p_maybe_confirm_by text) RETURNS jsonb
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
BEGIN
  -- ── 1. Resolve the event by slug ──
  SELECT * INTO v_event FROM events WHERE slug = p_slug;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Event not found.');
  END IF;

  v_is_demo := (v_event.slug = 'demo');

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
          response_source = 'web_form', responded_at = now(), updated_at = now()
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
          response_source = 'web_form', responded_at = now(), updated_at = now()
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
    ELSE
      -- Auto-merged: re-insert the primary guest row for the updated party.
      INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection)
      VALUES (v_party_id, v_event.id, p_guest_name, v_norm_email, p_phone, true,
              CASE WHEN p_response = 'yes' THEN NULLIF(p_primary_meal, '') ELSE NULL END);
    END IF;
  END IF;

  -- ── 6. Additional guests + custom answers (attending only) — HARD CAPPED (RF-1) ──
  -- The companion insert carries the per-person detail fields added by the
  -- companion-detail-fields migration. Out-of-vocab age_group/gender values
  -- are silently coerced to NULL so a stale client can't trip the CHECK
  -- constraint mid-submit and lose the row.
  IF p_response = 'yes' THEN
    INSERT INTO guests (
      party_id, event_id, full_name, email, phone, is_primary_contact,
      meal_selection, dietary_notes, age_group, relationship, gender
    )
    SELECT
      v_party_id, v_event.id, g.elem ->> 'fullName',
      NULLIF(lower(btrim(COALESCE(g.elem ->> 'email', ''))), ''),
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
    'org_phone', v_org_phone
  );
END;
$_$;

-- Name: unassign_seat(uuid, uuid, uuid); Type: FUNCTION; Schema: public

CREATE FUNCTION public.unassign_seat(p_event_id uuid, p_party_id uuid, p_assigned_by uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

-- Name: update_party_response(uuid, uuid, text, integer, text, text); Type: FUNCTION; Schema: public

CREATE FUNCTION public.update_party_response(p_event_id uuid, p_party_id uuid, p_response text, p_party_size integer DEFAULT NULL::integer, p_actor text DEFAULT 'guest'::text, p_source text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Name: validate_custom_answer(); Type: FUNCTION; Schema: public

CREATE FUNCTION public.validate_custom_answer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

-- Name: activity_logs; Type: TABLE; Schema: public

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid,
    actor_id uuid,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: admin_audit_logs; Type: TABLE; Schema: public

CREATE TABLE public.admin_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_user_id uuid,
    actor_role text,
    action text NOT NULL,
    entity_type text,
    entity_id text,
    ip text,
    user_agent text,
    browser text,
    os text,
    before jsonb,
    after jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: admin_user_roles; Type: TABLE; Schema: public

CREATE TABLE public.admin_user_roles (
    admin_user_id uuid NOT NULL,
    role_id uuid NOT NULL
);

-- Name: admin_users; Type: TABLE; Schema: public

CREATE TABLE public.admin_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    mfa_enabled boolean DEFAULT false NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_users_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text])))
);

-- Name: check_ins; Type: TABLE; Schema: public

CREATE TABLE public.check_ins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    guest_id uuid NOT NULL,
    party_id uuid NOT NULL,
    checked_in_at timestamp with time zone DEFAULT now(),
    checked_in_by uuid,
    method text,
    CONSTRAINT check_ins_method_check CHECK ((method = ANY (ARRAY['qr_scan'::text, 'manual_search'::text, 'self_service'::text])))
);

-- Name: credit_packages; Type: TABLE; Schema: public

CREATE TABLE public.credit_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    credits integer NOT NULL,
    bonus_credits integer DEFAULT 0 NOT NULL,
    price_cents integer NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT credit_packages_bonus_credits_check CHECK ((bonus_credits >= 0)),
    CONSTRAINT credit_packages_credits_check CHECK ((credits > 0)),
    CONSTRAINT credit_packages_price_cents_check CHECK ((price_cents >= 0)),
    CONSTRAINT credit_packages_type_check CHECK ((type = ANY (ARRAY['sms'::text, 'email'::text, 'qr'::text])))
);

-- Name: custom_answers; Type: TABLE; Schema: public

CREATE TABLE public.custom_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    party_id uuid NOT NULL,
    guest_id uuid,
    field_id uuid NOT NULL,
    answer_value jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Name: custom_form_fields; Type: TABLE; Schema: public

CREATE TABLE public.custom_form_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    field_key text NOT NULL,
    field_label text NOT NULL,
    field_type text NOT NULL,
    options jsonb DEFAULT '[]'::jsonb,
    is_required boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    scope public.form_field_scope_type DEFAULT 'party'::public.form_field_scope_type NOT NULL,
    CONSTRAINT rsvp_form_fields_field_type_check CHECK ((field_type = ANY (ARRAY['text'::text, 'email'::text, 'phone'::text, 'url'::text, 'select'::text, 'multiselect'::text, 'radio'::text, 'textarea'::text, 'number'::text, 'checkbox'::text, 'date'::text])))
);

-- Name: devices; Type: TABLE; Schema: public

CREATE TABLE public.devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fingerprint text NOT NULL,
    label text,
    trusted boolean DEFAULT false NOT NULL,
    first_seen timestamp with time zone DEFAULT now(),
    last_seen timestamp with time zone DEFAULT now()
);

-- Name: email_log; Type: TABLE; Schema: public

CREATE TABLE public.email_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind text NOT NULL,
    ref text,
    recipient text,
    event_id uuid,
    subject text,
    status text DEFAULT 'sent'::text NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: event_payments; Type: TABLE; Schema: public

CREATE TABLE public.event_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    stripe_checkout_session_id text,
    stripe_payment_intent_id text,
    amount_cents integer NOT NULL,
    currency text DEFAULT 'usd'::text,
    status text DEFAULT 'pending'::text,
    payment_method text DEFAULT 'stripe'::text,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    reference_number text,
    manual_method text,
    payer_reference text,
    verified_by uuid,
    verified_at timestamp with time zone,
    admin_note text,
    stripe_refund_id text,
    refund_amount_cents integer,
    refunded_at timestamp with time zone,
    refunded_by uuid,
    refund_reason text,
    tier_name text,
    tier_max_guests integer,
    tier_remove_watermark boolean DEFAULT false NOT NULL,
    CONSTRAINT event_payments_payment_method_check CHECK ((payment_method = ANY (ARRAY['stripe'::text, 'cash_manual'::text]))),
    CONSTRAINT event_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'refunded'::text])))
);

-- Name: events; Type: TABLE; Schema: public

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    slug text NOT NULL,
    template_type text DEFAULT 'custom'::text NOT NULL,
    title text NOT NULL,
    description text,
    event_date timestamp with time zone NOT NULL,
    status text DEFAULT 'draft'::text,
    is_paid boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    event_end_date timestamp with time zone,
    location_name text,
    location_address text,
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    location_place_id text,
    dress_code text,
    rsvp_deadline timestamp with time zone,
    privacy_mode text DEFAULT 'private'::text,
    access_password text,
    cover_image_url text,
    gallery_urls jsonb DEFAULT '[]'::jsonb,
    custom_colors jsonb DEFAULT '{}'::jsonb,
    custom_fonts jsonb DEFAULT '{}'::jsonb,
    manual_override boolean DEFAULT false,
    template_data jsonb DEFAULT '{}'::jsonb,
    event_type text DEFAULT 'wedding'::text,
    background_music_url text,
    notification_preferences jsonb DEFAULT '{"email": true, "whatsapp": false}'::jsonb,
    qr_code_url text,
    tier_name text,
    tier_max_guests integer,
    tier_remove_watermark boolean DEFAULT false NOT NULL,
    payment_reminder_sent_at timestamp with time zone,
    final_report_sent_at timestamp with time zone,
    recap_sent_at timestamp with time zone,
    allow_guest_edits boolean DEFAULT false,
    guest_list_visibility public.guest_list_visibility_type DEFAULT 'none'::public.guest_list_visibility_type NOT NULL,
    comp_reason text,
    CONSTRAINT events_privacy_mode_check CHECK ((privacy_mode = ANY (ARRAY['public'::text, 'private'::text, 'password'::text]))),
    CONSTRAINT events_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'active'::text, 'paused'::text, 'completed'::text])))
);

-- Name: guests; Type: TABLE; Schema: public

CREATE TABLE public.guests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    party_id uuid NOT NULL,
    event_id uuid NOT NULL,
    full_name text NOT NULL,
    email text,
    phone text,
    is_primary_contact boolean DEFAULT false NOT NULL,
    meal_selection text,
    dietary_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    age_group text,
    relationship text,
    gender text,
    CONSTRAINT guests_age_group_check CHECK (((age_group IS NULL) OR (age_group = ANY (ARRAY['adult'::text, 'teen'::text, 'child'::text, 'infant'::text])))),
    CONSTRAINT guests_gender_check CHECK (((gender IS NULL) OR (gender = ANY (ARRAY['male'::text, 'female'::text])))),
    CONSTRAINT guests_relationship_length_check CHECK (((relationship IS NULL) OR (length(relationship) <= 60)))
);

-- Name: invitations; Type: TABLE; Schema: public

CREATE TABLE public.invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    party_id uuid NOT NULL,
    event_id uuid NOT NULL,
    channel public.invitation_channel_type NOT NULL,
    token text,
    status public.invitation_status_type DEFAULT 'queued'::public.invitation_status_type NOT NULL,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    responded_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Name: login_history; Type: TABLE; Schema: public

CREATE TABLE public.login_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text,
    ip text,
    user_agent text,
    success boolean NOT NULL,
    failure_reason text,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: mv_daily_revenue; Type: MATERIALIZED VIEW; Schema: public

CREATE MATERIALIZED VIEW public.mv_daily_revenue AS
 SELECT (date_trunc('day'::text, COALESCE(completed_at, created_at)))::date AS day,
    COALESCE(sum(amount_cents) FILTER (WHERE (status = ANY (ARRAY['completed'::text, 'refunded'::text]))), (0)::bigint) AS gross_cents,
    COALESCE(sum(
        CASE
            WHEN (refunded_at IS NOT NULL) THEN COALESCE(refund_amount_cents, 0)
            WHEN (status = 'refunded'::text) THEN COALESCE(refund_amount_cents, amount_cents)
            ELSE 0
        END), (0)::bigint) AS refunded_cents,
    (COALESCE(sum(amount_cents) FILTER (WHERE (status = ANY (ARRAY['completed'::text, 'refunded'::text]))), (0)::bigint) - COALESCE(sum(
        CASE
            WHEN (refunded_at IS NOT NULL) THEN COALESCE(refund_amount_cents, 0)
            WHEN (status = 'refunded'::text) THEN COALESCE(refund_amount_cents, amount_cents)
            ELSE 0
        END), (0)::bigint)) AS net_cents,
    count(*) FILTER (WHERE (status = ANY (ARRAY['completed'::text, 'refunded'::text]))) AS payment_count
   FROM public.event_payments
  GROUP BY ((date_trunc('day'::text, COALESCE(completed_at, created_at)))::date)
  WITH NO DATA;

-- Name: organizations; Type: TABLE; Schema: public

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id uuid NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    stripe_customer_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    reset_otp text,
    reset_otp_expires_at timestamp with time zone,
    otp_attempts integer DEFAULT 0,
    failed_login_attempts integer DEFAULT 0,
    lockout_until timestamp with time zone,
    email_verified boolean DEFAULT true,
    registration_otp text,
    registration_otp_expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    suspended_reason text,
    suspended_at timestamp with time zone,
    welcome_sent_at timestamp with time zone,
    bio text,
    website text,
    logo_url text,
    social_links jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT organizations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'banned'::text])))
);

-- Name: payment_disputes; Type: TABLE; Schema: public

CREATE TABLE public.payment_disputes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid,
    stripe_dispute_id text,
    stripe_charge_id text,
    status text,
    amount_cents integer,
    currency text DEFAULT 'usd'::text,
    reason text,
    evidence_due_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Name: permissions; Type: TABLE; Schema: public

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    "group" text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: role_permissions; Type: TABLE; Schema: public

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);

-- Name: roles; Type: TABLE; Schema: public

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: rsvp_parties; Type: TABLE; Schema: public

CREATE TABLE public.rsvp_parties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    label text NOT NULL,
    response public.rsvp_response_type DEFAULT 'pending'::public.rsvp_response_type NOT NULL,
    max_party_size integer DEFAULT 1 NOT NULL,
    notes text,
    decline_reason text,
    maybe_confirm_by text,
    response_source text,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT rsvp_parties_max_party_size_check CHECK (((max_party_size >= 1) AND (max_party_size <= 20)))
);

-- Name: rsvp_response_history; Type: TABLE; Schema: public

CREATE TABLE public.rsvp_response_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    party_id uuid NOT NULL,
    event_id uuid NOT NULL,
    response public.rsvp_response_type NOT NULL,
    changed_by text DEFAULT 'guest'::text NOT NULL,
    source text,
    snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Name: seating_assignments; Type: TABLE; Schema: public

CREATE TABLE public.seating_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    party_id uuid NOT NULL,
    table_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by uuid
);

-- Name: security_events; Type: TABLE; Schema: public

CREATE TABLE public.security_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    ip text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT security_events_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);

-- Name: sessions; Type: TABLE; Schema: public

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    jti text NOT NULL,
    ip text,
    user_agent text,
    device_label text,
    created_at timestamp with time zone DEFAULT now(),
    last_seen_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone
);

-- Name: sms_credit_ledger; Type: TABLE; Schema: public

CREATE TABLE public.sms_credit_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_id uuid NOT NULL,
    event_id uuid NOT NULL,
    transaction_type text NOT NULL,
    credits integer NOT NULL,
    sms_recipient text,
    sms_sid text,
    created_at timestamp with time zone DEFAULT now(),
    stripe_payment_intent_id text,
    idempotency_key text,
    CONSTRAINT sms_credit_ledger_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['purchase'::text, 'consumption'::text, 'refund'::text])))
);

-- Name: sms_credit_wallets; Type: TABLE; Schema: public

CREATE TABLE public.sms_credit_wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    credits_purchased integer DEFAULT 0,
    credits_used integer DEFAULT 0,
    credits_remaining integer GENERATED ALWAYS AS ((credits_purchased - credits_used)) STORED,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sms_credit_wallets_credits_purchased_check CHECK ((credits_purchased >= 0)),
    CONSTRAINT sms_credit_wallets_credits_used_check CHECK ((credits_used >= 0))
);

-- Name: super_admin_config; Type: TABLE; Schema: public

CREATE TABLE public.super_admin_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pricing_tiers jsonb DEFAULT '[{"name": "Essential", "max_guests": 100, "price_cents": 7900}, {"name": "Premium", "max_guests": 300, "price_cents": 14900}, {"name": "Enterprise", "max_guests": 1000, "price_cents": 24900}]'::jsonb NOT NULL,
    sms_rate_cents_per_credit integer DEFAULT 8,
    sms_markup_percentage numeric DEFAULT 40.0,
    platform_commission_pct numeric DEFAULT 0.0,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid,
    manual_payment_methods jsonb DEFAULT '[]'::jsonb NOT NULL,
    landing_stats jsonb DEFAULT '[{"label": "Events Created", "suffix": "+", "target": 10000, "decimals": 0, "source": "events_count"}, {"label": "Guests Managed", "suffix": "+", "target": 50000, "decimals": 0, "source": "guests_count"}, {"label": "Platform Uptime", "suffix": "%", "target": 99.9, "decimals": 1, "source": "static"}]'::jsonb NOT NULL
);

-- Name: tables; Type: TABLE; Schema: public

CREATE TABLE public.tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    table_name text NOT NULL,
    max_capacity integer,
    shape text DEFAULT 'round'::text,
    position_x numeric DEFAULT 0,
    position_y numeric DEFAULT 0,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    element_type text DEFAULT 'table'::text NOT NULL,
    width numeric,
    height numeric,
    rotation numeric DEFAULT 0 NOT NULL,
    color text,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tables_element_type_check CHECK ((element_type = ANY (ARRAY['table'::text, 'zone'::text]))),
    CONSTRAINT tables_max_capacity_check CHECK (((max_capacity IS NULL) OR (max_capacity > 0))),
    CONSTRAINT tables_shape_check CHECK ((shape = ANY (ARRAY['round'::text, 'oval'::text, 'square'::text, 'rectangle'::text, 'rectangular'::text, 'banquet'::text, 'head'::text, 'stage'::text, 'dance_floor'::text, 'bar'::text, 'dj_booth'::text, 'entrance'::text, 'custom'::text])))
);

-- Name: user_roles; Type: TABLE; Schema: public

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_roles_role_check CHECK ((role = ANY (ARRAY['super_admin'::text, 'organizer'::text])))
);

-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);

-- Name: admin_audit_logs admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id);

-- Name: admin_user_roles admin_user_roles_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.admin_user_roles
    ADD CONSTRAINT admin_user_roles_pkey PRIMARY KEY (admin_user_id, role_id);

-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);

-- Name: admin_users admin_users_user_id_key; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_user_id_key UNIQUE (user_id);

-- Name: check_ins check_ins_event_id_guest_id_key; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.check_ins
    ADD CONSTRAINT check_ins_event_id_guest_id_key UNIQUE (event_id, guest_id);

-- Name: check_ins check_ins_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.check_ins
    ADD CONSTRAINT check_ins_pkey PRIMARY KEY (id);

-- Name: credit_packages credit_packages_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.credit_packages
    ADD CONSTRAINT credit_packages_pkey PRIMARY KEY (id);

-- Name: custom_answers custom_answers_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.custom_answers
    ADD CONSTRAINT custom_answers_pkey PRIMARY KEY (id);

-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);

-- Name: devices devices_user_id_fingerprint_key; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_user_id_fingerprint_key UNIQUE (user_id, fingerprint);

-- Name: email_log email_log_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.email_log
    ADD CONSTRAINT email_log_pkey PRIMARY KEY (id);

-- Name: event_payments event_payments_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.event_payments
    ADD CONSTRAINT event_payments_pkey PRIMARY KEY (id);

-- Name: event_payments event_payments_reference_number_key; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.event_payments
    ADD CONSTRAINT event_payments_reference_number_key UNIQUE (reference_number);

-- Name: event_payments event_payments_stripe_checkout_session_id_key; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.event_payments
    ADD CONSTRAINT event_payments_stripe_checkout_session_id_key UNIQUE (stripe_checkout_session_id);

-- Name: event_payments event_payments_stripe_payment_intent_id_key; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.event_payments
    ADD CONSTRAINT event_payments_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);

-- Name: events events_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);

-- Name: events events_slug_key; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_slug_key UNIQUE (slug);

-- Name: guests guests_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.guests
    ADD CONSTRAINT guests_pkey PRIMARY KEY (id);

-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);

-- Name: login_history login_history_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.login_history
    ADD CONSTRAINT login_history_pkey PRIMARY KEY (id);

-- Name: organizations organizations_email_unique; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_email_unique UNIQUE (email);

-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);

-- Name: organizations organizations_stripe_customer_id_key; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_stripe_customer_id_key UNIQUE (stripe_customer_id);

-- Name: payment_disputes payment_disputes_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.payment_disputes
    ADD CONSTRAINT payment_disputes_pkey PRIMARY KEY (id);

-- Name: payment_disputes payment_disputes_stripe_dispute_id_key; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.payment_disputes
    ADD CONSTRAINT payment_disputes_stripe_dispute_id_key UNIQUE (stripe_dispute_id);

-- Name: permissions permissions_key_key; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_key_key UNIQUE (key);

-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);

-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);

-- Name: roles roles_key_key; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_key_key UNIQUE (key);

-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

-- Name: custom_form_fields rsvp_form_fields_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.custom_form_fields
    ADD CONSTRAINT rsvp_form_fields_pkey PRIMARY KEY (id);

-- Name: rsvp_parties rsvp_parties_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.rsvp_parties
    ADD CONSTRAINT rsvp_parties_pkey PRIMARY KEY (id);

-- Name: rsvp_response_history rsvp_response_history_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.rsvp_response_history
    ADD CONSTRAINT rsvp_response_history_pkey PRIMARY KEY (id);

-- Name: seating_assignments seating_assignments_event_id_party_id_key; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.seating_assignments
    ADD CONSTRAINT seating_assignments_event_id_party_id_key UNIQUE (event_id, party_id);

-- Name: seating_assignments seating_assignments_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.seating_assignments
    ADD CONSTRAINT seating_assignments_pkey PRIMARY KEY (id);

-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);

-- Name: sessions sessions_jti_key; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_jti_key UNIQUE (jti);

-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

-- Name: sms_campaign_recipients sms_campaign_recipients_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.sms_campaign_recipients
    ADD CONSTRAINT sms_campaign_recipients_pkey PRIMARY KEY (id);

-- Name: sms_campaigns sms_campaigns_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.sms_campaigns
    ADD CONSTRAINT sms_campaigns_pkey PRIMARY KEY (id);

-- Name: sms_credit_ledger sms_credit_ledger_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.sms_credit_ledger
    ADD CONSTRAINT sms_credit_ledger_pkey PRIMARY KEY (id);

-- Name: sms_credit_wallets sms_credit_wallets_event_id_key; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.sms_credit_wallets
    ADD CONSTRAINT sms_credit_wallets_event_id_key UNIQUE (event_id);

-- Name: sms_credit_wallets sms_credit_wallets_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.sms_credit_wallets
    ADD CONSTRAINT sms_credit_wallets_pkey PRIMARY KEY (id);

-- Name: super_admin_config super_admin_config_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.super_admin_config
    ADD CONSTRAINT super_admin_config_pkey PRIMARY KEY (id);

-- Name: tables tables_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_pkey PRIMARY KEY (id);

-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);

-- Name: user_roles user_roles_user_id_key; Type: CONSTRAINT; Schema: public

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- Name: idx_activity_event; Type: INDEX; Schema: public

CREATE INDEX idx_activity_event ON public.activity_logs USING btree (event_id, created_at DESC);

-- Name: idx_admin_audit_action; Type: INDEX; Schema: public

CREATE INDEX idx_admin_audit_action ON public.admin_audit_logs USING btree (action, created_at DESC);

-- Name: idx_admin_audit_actor; Type: INDEX; Schema: public

CREATE INDEX idx_admin_audit_actor ON public.admin_audit_logs USING btree (actor_user_id, created_at DESC);

-- Name: idx_admin_audit_created; Type: INDEX; Schema: public

CREATE INDEX idx_admin_audit_created ON public.admin_audit_logs USING btree (created_at DESC);

-- Name: idx_admin_audit_entity; Type: INDEX; Schema: public

CREATE INDEX idx_admin_audit_entity ON public.admin_audit_logs USING btree (entity_type, entity_id);

-- Name: idx_admin_user_roles_admin; Type: INDEX; Schema: public

CREATE INDEX idx_admin_user_roles_admin ON public.admin_user_roles USING btree (admin_user_id);

-- Name: idx_admin_users_user; Type: INDEX; Schema: public

CREATE INDEX idx_admin_users_user ON public.admin_users USING btree (user_id);

-- Name: idx_check_ins_event_id; Type: INDEX; Schema: public

CREATE INDEX idx_check_ins_event_id ON public.check_ins USING btree (event_id);

-- Name: idx_check_ins_party_id; Type: INDEX; Schema: public

CREATE INDEX idx_check_ins_party_id ON public.check_ins USING btree (party_id);

-- Name: idx_credit_packages_type; Type: INDEX; Schema: public

CREATE INDEX idx_credit_packages_type ON public.credit_packages USING btree (type, is_active, sort_order);

-- Name: idx_custom_answers_field_id; Type: INDEX; Schema: public

CREATE INDEX idx_custom_answers_field_id ON public.custom_answers USING btree (field_id);

-- Name: idx_custom_answers_guest_id; Type: INDEX; Schema: public

CREATE INDEX idx_custom_answers_guest_id ON public.custom_answers USING btree (guest_id);

-- Name: idx_custom_answers_party_id; Type: INDEX; Schema: public

CREATE INDEX idx_custom_answers_party_id ON public.custom_answers USING btree (party_id);

-- Name: idx_email_log_event; Type: INDEX; Schema: public

CREATE INDEX idx_email_log_event ON public.email_log USING btree (event_id, created_at DESC);

-- Name: idx_event_payments_event_id; Type: INDEX; Schema: public

CREATE INDEX idx_event_payments_event_id ON public.event_payments USING btree (event_id);

-- Name: idx_events_date_status; Type: INDEX; Schema: public

CREATE INDEX idx_events_date_status ON public.events USING btree (event_date, status);

-- Name: idx_events_org_id; Type: INDEX; Schema: public

CREATE INDEX idx_events_org_id ON public.events USING btree (org_id);

-- Name: idx_events_slug; Type: INDEX; Schema: public

CREATE UNIQUE INDEX idx_events_slug ON public.events USING btree (slug);

-- Name: idx_guests_event_email_unique; Type: INDEX; Schema: public

CREATE UNIQUE INDEX idx_guests_event_email_unique ON public.guests USING btree (event_id, lower(email)) WHERE (email IS NOT NULL);

-- Name: idx_guests_event_id; Type: INDEX; Schema: public

CREATE INDEX idx_guests_event_id ON public.guests USING btree (event_id);

-- Name: idx_guests_event_phone_unique; Type: INDEX; Schema: public

CREATE UNIQUE INDEX idx_guests_event_phone_unique ON public.guests USING btree (event_id, phone) WHERE ((phone IS NOT NULL) AND (is_primary_contact = true));

-- Name: idx_guests_full_name_trgm; Type: INDEX; Schema: public

CREATE INDEX idx_guests_full_name_trgm ON public.guests USING gin (full_name public.gin_trgm_ops);

-- Name: idx_guests_one_primary_per_party; Type: INDEX; Schema: public

CREATE UNIQUE INDEX idx_guests_one_primary_per_party ON public.guests USING btree (party_id) WHERE (is_primary_contact = true);

-- Name: idx_guests_party_id; Type: INDEX; Schema: public

CREATE INDEX idx_guests_party_id ON public.guests USING btree (party_id);

-- Name: idx_invitations_event_channel_status; Type: INDEX; Schema: public

CREATE INDEX idx_invitations_event_channel_status ON public.invitations USING btree (event_id, channel, status);

-- Name: idx_invitations_event_id; Type: INDEX; Schema: public

CREATE INDEX idx_invitations_event_id ON public.invitations USING btree (event_id);

-- Name: idx_invitations_party_id; Type: INDEX; Schema: public

CREATE INDEX idx_invitations_party_id ON public.invitations USING btree (party_id);

-- Name: idx_invitations_token_unique; Type: INDEX; Schema: public

CREATE UNIQUE INDEX idx_invitations_token_unique ON public.invitations USING btree (token) WHERE (token IS NOT NULL);

-- Name: idx_login_history_email; Type: INDEX; Schema: public

CREATE INDEX idx_login_history_email ON public.login_history USING btree (email, created_at DESC);

-- Name: idx_login_history_user; Type: INDEX; Schema: public

CREATE INDEX idx_login_history_user ON public.login_history USING btree (user_id, created_at DESC);

-- Name: idx_mv_daily_revenue_day; Type: INDEX; Schema: public

CREATE UNIQUE INDEX idx_mv_daily_revenue_day ON public.mv_daily_revenue USING btree (day);

-- Name: idx_organizations_owner; Type: INDEX; Schema: public

CREATE INDEX idx_organizations_owner ON public.organizations USING btree (owner_user_id);

-- Name: idx_payment_disputes_created; Type: INDEX; Schema: public

CREATE INDEX idx_payment_disputes_created ON public.payment_disputes USING btree (created_at DESC);

-- Name: idx_payment_disputes_payment; Type: INDEX; Schema: public

CREATE INDEX idx_payment_disputes_payment ON public.payment_disputes USING btree (payment_id);

-- Name: idx_role_permissions_role; Type: INDEX; Schema: public

CREATE INDEX idx_role_permissions_role ON public.role_permissions USING btree (role_id);

-- Name: idx_rsvp_parties_event_id; Type: INDEX; Schema: public

CREATE INDEX idx_rsvp_parties_event_id ON public.rsvp_parties USING btree (event_id);

-- Name: idx_rsvp_parties_event_response; Type: INDEX; Schema: public

CREATE INDEX idx_rsvp_parties_event_response ON public.rsvp_parties USING btree (event_id, response);

-- Name: idx_rsvp_parties_label_trgm; Type: INDEX; Schema: public

CREATE INDEX idx_rsvp_parties_label_trgm ON public.rsvp_parties USING gin (label public.gin_trgm_ops);

-- Name: idx_rsvp_response_history_event_id; Type: INDEX; Schema: public

CREATE INDEX idx_rsvp_response_history_event_id ON public.rsvp_response_history USING btree (event_id, created_at DESC);

-- Name: idx_rsvp_response_history_party_id; Type: INDEX; Schema: public

CREATE INDEX idx_rsvp_response_history_party_id ON public.rsvp_response_history USING btree (party_id, created_at DESC);

-- Name: idx_seating_event; Type: INDEX; Schema: public

CREATE INDEX idx_seating_event ON public.seating_assignments USING btree (event_id);

-- Name: idx_seating_table; Type: INDEX; Schema: public

CREATE INDEX idx_seating_table ON public.seating_assignments USING btree (table_id);

-- Name: idx_security_events_created; Type: INDEX; Schema: public

CREATE INDEX idx_security_events_created ON public.security_events USING btree (created_at DESC);

-- Name: idx_sessions_jti; Type: INDEX; Schema: public

CREATE INDEX idx_sessions_jti ON public.sessions USING btree (jti);

-- Name: idx_sessions_user; Type: INDEX; Schema: public

CREATE INDEX idx_sessions_user ON public.sessions USING btree (user_id, created_at DESC);

-- Name: idx_sms_campaign_recipients_campaign; Type: INDEX; Schema: public

CREATE INDEX idx_sms_campaign_recipients_campaign ON public.sms_campaign_recipients USING btree (campaign_id, status);

-- Name: idx_sms_campaign_recipients_idem; Type: INDEX; Schema: public

CREATE UNIQUE INDEX idx_sms_campaign_recipients_idem ON public.sms_campaign_recipients USING btree (idempotency_key);

-- Name: idx_sms_campaign_recipients_sid; Type: INDEX; Schema: public

CREATE INDEX idx_sms_campaign_recipients_sid ON public.sms_campaign_recipients USING btree (sms_sid) WHERE (sms_sid IS NOT NULL);

-- Name: idx_sms_campaigns_active; Type: INDEX; Schema: public

CREATE INDEX idx_sms_campaigns_active ON public.sms_campaigns USING btree (created_at) WHERE (status = ANY (ARRAY['queued'::text, 'processing'::text]));

-- Name: idx_sms_campaigns_event; Type: INDEX; Schema: public

CREATE INDEX idx_sms_campaigns_event ON public.sms_campaigns USING btree (event_id, created_at DESC);

-- Name: idx_sms_campaigns_token; Type: INDEX; Schema: public

CREATE UNIQUE INDEX idx_sms_campaigns_token ON public.sms_campaigns USING btree (client_token) WHERE (client_token IS NOT NULL);

-- Name: idx_sms_credit_ledger_event; Type: INDEX; Schema: public

CREATE INDEX idx_sms_credit_ledger_event ON public.sms_credit_ledger USING btree (event_id);

-- Name: idx_sms_credit_ledger_idempotency; Type: INDEX; Schema: public

CREATE UNIQUE INDEX idx_sms_credit_ledger_idempotency ON public.sms_credit_ledger USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);

-- Name: idx_sms_credit_ledger_sid; Type: INDEX; Schema: public

CREATE INDEX idx_sms_credit_ledger_sid ON public.sms_credit_ledger USING btree (sms_sid) WHERE (sms_sid IS NOT NULL);

-- Name: idx_sms_credit_ledger_unique_purchase; Type: INDEX; Schema: public

CREATE UNIQUE INDEX idx_sms_credit_ledger_unique_purchase ON public.sms_credit_ledger USING btree (stripe_payment_intent_id) WHERE (transaction_type = 'purchase'::text);

-- Name: idx_tables_event; Type: INDEX; Schema: public

CREATE INDEX idx_tables_event ON public.tables USING btree (event_id);

-- Name: idx_user_roles_user_role; Type: INDEX; Schema: public

CREATE INDEX idx_user_roles_user_role ON public.user_roles USING btree (user_id, role);

-- Name: uq_email_log_kind_ref; Type: INDEX; Schema: public

CREATE UNIQUE INDEX uq_email_log_kind_ref ON public.email_log USING btree (kind, ref) WHERE (ref IS NOT NULL);

-- Name: credit_packages set_credit_packages_updated_at; Type: TRIGGER; Schema: public

CREATE TRIGGER set_credit_packages_updated_at BEFORE UPDATE ON public.credit_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Name: custom_answers set_updated_at; Type: TRIGGER; Schema: public

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.custom_answers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Name: events set_updated_at; Type: TRIGGER; Schema: public

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Name: guests set_updated_at; Type: TRIGGER; Schema: public

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.guests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Name: invitations set_updated_at; Type: TRIGGER; Schema: public

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.invitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Name: organizations set_updated_at; Type: TRIGGER; Schema: public

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Name: rsvp_parties set_updated_at; Type: TRIGGER; Schema: public

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rsvp_parties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Name: sms_credit_wallets set_updated_at; Type: TRIGGER; Schema: public

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sms_credit_wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Name: super_admin_config set_updated_at; Type: TRIGGER; Schema: public

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.super_admin_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Name: rsvp_parties trg_party_response_change; Type: TRIGGER; Schema: public

CREATE TRIGGER trg_party_response_change AFTER INSERT OR UPDATE OF response ON public.rsvp_parties FOR EACH ROW EXECUTE FUNCTION public.handle_party_response_change();

-- Name: custom_answers trg_validate_custom_answer; Type: TRIGGER; Schema: public

CREATE TRIGGER trg_validate_custom_answer BEFORE INSERT OR UPDATE ON public.custom_answers FOR EACH ROW EXECUTE FUNCTION public.validate_custom_answer();

-- Name: activity_logs activity_logs_event_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Name: admin_audit_logs admin_audit_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Name: admin_user_roles admin_user_roles_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.admin_user_roles
    ADD CONSTRAINT admin_user_roles_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id) ON DELETE CASCADE;

-- Name: admin_user_roles admin_user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.admin_user_roles
    ADD CONSTRAINT admin_user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;

-- Name: admin_users admin_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- check_ins_checked_in_by_fkey dropped by migration
-- 20260728000000_drop_checkin_actor_fk.sql — checked_in_by is a plain audit
-- uuid; organizer ids live in organizations.owner_user_id, not auth.users.

-- Name: check_ins check_ins_event_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.check_ins
    ADD CONSTRAINT check_ins_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Name: check_ins check_ins_guest_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.check_ins
    ADD CONSTRAINT check_ins_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES public.guests(id) ON DELETE CASCADE;

-- Name: check_ins check_ins_party_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.check_ins
    ADD CONSTRAINT check_ins_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.rsvp_parties(id) ON DELETE CASCADE;

-- Name: custom_answers custom_answers_field_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.custom_answers
    ADD CONSTRAINT custom_answers_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.custom_form_fields(id) ON DELETE CASCADE;

-- Name: custom_answers custom_answers_guest_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.custom_answers
    ADD CONSTRAINT custom_answers_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES public.guests(id) ON DELETE CASCADE;

-- Name: custom_answers custom_answers_party_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.custom_answers
    ADD CONSTRAINT custom_answers_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.rsvp_parties(id) ON DELETE CASCADE;

-- Name: devices devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Name: event_payments event_payments_event_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.event_payments
    ADD CONSTRAINT event_payments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Name: events fk_events_org_id; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.events
    ADD CONSTRAINT fk_events_org_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Name: organizations fk_organizations_owner_user_id; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT fk_organizations_owner_user_id FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Name: user_roles fk_user_roles_user_id; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT fk_user_roles_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Name: guests guests_event_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.guests
    ADD CONSTRAINT guests_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Name: guests guests_party_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.guests
    ADD CONSTRAINT guests_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.rsvp_parties(id) ON DELETE CASCADE;

-- Name: invitations invitations_event_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Name: invitations invitations_party_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.rsvp_parties(id) ON DELETE CASCADE;

-- Name: login_history login_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.login_history
    ADD CONSTRAINT login_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Name: payment_disputes payment_disputes_payment_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.payment_disputes
    ADD CONSTRAINT payment_disputes_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.event_payments(id) ON DELETE SET NULL;

-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;

-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;

-- Name: custom_form_fields rsvp_form_fields_event_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.custom_form_fields
    ADD CONSTRAINT rsvp_form_fields_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Name: rsvp_parties rsvp_parties_event_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.rsvp_parties
    ADD CONSTRAINT rsvp_parties_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Name: rsvp_response_history rsvp_response_history_event_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.rsvp_response_history
    ADD CONSTRAINT rsvp_response_history_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Name: rsvp_response_history rsvp_response_history_party_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.rsvp_response_history
    ADD CONSTRAINT rsvp_response_history_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.rsvp_parties(id) ON DELETE CASCADE;

-- Name: seating_assignments seating_assignments_event_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.seating_assignments
    ADD CONSTRAINT seating_assignments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Name: seating_assignments seating_assignments_party_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.seating_assignments
    ADD CONSTRAINT seating_assignments_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.rsvp_parties(id) ON DELETE CASCADE;

-- Name: seating_assignments seating_assignments_table_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.seating_assignments
    ADD CONSTRAINT seating_assignments_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE CASCADE;

-- Name: security_events security_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Name: sms_campaign_recipients sms_campaign_recipients_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.sms_campaign_recipients
    ADD CONSTRAINT sms_campaign_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.sms_campaigns(id) ON DELETE CASCADE;

-- Name: sms_campaign_recipients sms_campaign_recipients_event_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.sms_campaign_recipients
    ADD CONSTRAINT sms_campaign_recipients_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Name: sms_campaigns sms_campaigns_event_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.sms_campaigns
    ADD CONSTRAINT sms_campaigns_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Name: sms_credit_ledger sms_credit_ledger_event_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.sms_credit_ledger
    ADD CONSTRAINT sms_credit_ledger_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Name: sms_credit_ledger sms_credit_ledger_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.sms_credit_ledger
    ADD CONSTRAINT sms_credit_ledger_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.sms_credit_wallets(id) ON DELETE CASCADE;

-- Name: sms_credit_wallets sms_credit_wallets_event_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.sms_credit_wallets
    ADD CONSTRAINT sms_credit_wallets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Name: tables tables_event_id_fkey; Type: FK CONSTRAINT; Schema: public

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Name: activity_logs; Type: ROW SECURITY; Schema: public

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Name: super_admin_config admin_all_config; Type: POLICY; Schema: public

CREATE POLICY admin_all_config ON public.super_admin_config TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Name: user_roles admin_all_roles; Type: POLICY; Schema: public

CREATE POLICY admin_all_roles ON public.user_roles TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Name: admin_audit_logs; Type: ROW SECURITY; Schema: public

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Name: admin_user_roles; Type: ROW SECURITY; Schema: public

ALTER TABLE public.admin_user_roles ENABLE ROW LEVEL SECURITY;

-- Name: admin_users; Type: ROW SECURITY; Schema: public

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Name: check_ins; Type: ROW SECURITY; Schema: public

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- Name: credit_packages; Type: ROW SECURITY; Schema: public

ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

-- Name: custom_answers; Type: ROW SECURITY; Schema: public

ALTER TABLE public.custom_answers ENABLE ROW LEVEL SECURITY;

-- Name: custom_form_fields; Type: ROW SECURITY; Schema: public

ALTER TABLE public.custom_form_fields ENABLE ROW LEVEL SECURITY;

-- Name: devices; Type: ROW SECURITY; Schema: public

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Name: email_log; Type: ROW SECURITY; Schema: public

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Name: event_payments; Type: ROW SECURITY; Schema: public

ALTER TABLE public.event_payments ENABLE ROW LEVEL SECURITY;

-- Name: events; Type: ROW SECURITY; Schema: public

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Name: rsvp_parties guest_select_rsvp_parties; Type: POLICY; Schema: public

CREATE POLICY guest_select_rsvp_parties ON public.rsvp_parties FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = rsvp_parties.event_id) AND (events.is_paid = true) AND (events.status = 'active'::text) AND (events.guest_list_visibility <> 'none'::public.guest_list_visibility_type)))));

-- Name: seating_assignments guest_select_seating; Type: POLICY; Schema: public

CREATE POLICY guest_select_seating ON public.seating_assignments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = seating_assignments.event_id) AND (events.is_paid = true) AND (events.status = 'active'::text)))));

-- Name: guests; Type: ROW SECURITY; Schema: public

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

-- Name: invitations; Type: ROW SECURITY; Schema: public

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Name: login_history; Type: ROW SECURITY; Schema: public

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- Name: organizations; Type: ROW SECURITY; Schema: public

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Name: check_ins organizer_all_checkins; Type: POLICY; Schema: public

CREATE POLICY organizer_all_checkins ON public.check_ins TO authenticated USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = check_ins.event_id) AND (o.owner_user_id = auth.uid())))))) WITH CHECK ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = check_ins.event_id) AND (o.owner_user_id = auth.uid()))))));

-- Name: custom_answers organizer_all_custom_answers; Type: POLICY; Schema: public

CREATE POLICY organizer_all_custom_answers ON public.custom_answers TO authenticated USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM ((public.rsvp_parties p
     JOIN public.events e ON ((p.event_id = e.id)))
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((p.id = custom_answers.party_id) AND (o.owner_user_id = auth.uid())))))) WITH CHECK ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM ((public.rsvp_parties p
     JOIN public.events e ON ((p.event_id = e.id)))
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((p.id = custom_answers.party_id) AND (o.owner_user_id = auth.uid()))))));

-- Name: events organizer_all_events; Type: POLICY; Schema: public

CREATE POLICY organizer_all_events ON public.events TO authenticated USING ((public.is_super_admin(auth.uid()) OR (org_id IN ( SELECT organizations.id
   FROM public.organizations
  WHERE (organizations.owner_user_id = auth.uid()))))) WITH CHECK ((public.is_super_admin(auth.uid()) OR (org_id IN ( SELECT organizations.id
   FROM public.organizations
  WHERE (organizations.owner_user_id = auth.uid())))));

-- Name: custom_form_fields organizer_all_fields; Type: POLICY; Schema: public

CREATE POLICY organizer_all_fields ON public.custom_form_fields TO authenticated USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = custom_form_fields.event_id) AND (o.owner_user_id = auth.uid())))))) WITH CHECK ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = custom_form_fields.event_id) AND (o.owner_user_id = auth.uid()))))));

-- Name: guests organizer_all_guests; Type: POLICY; Schema: public

CREATE POLICY organizer_all_guests ON public.guests TO authenticated USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = guests.event_id) AND (o.owner_user_id = auth.uid())))))) WITH CHECK ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = guests.event_id) AND (o.owner_user_id = auth.uid()))))));

-- Name: organizations organizer_all_organizations; Type: POLICY; Schema: public

CREATE POLICY organizer_all_organizations ON public.organizations TO authenticated USING ((public.is_super_admin(auth.uid()) OR (owner_user_id = auth.uid()))) WITH CHECK ((public.is_super_admin(auth.uid()) OR (owner_user_id = auth.uid())));

-- Name: rsvp_parties organizer_all_rsvp_parties; Type: POLICY; Schema: public

CREATE POLICY organizer_all_rsvp_parties ON public.rsvp_parties TO authenticated USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = rsvp_parties.event_id) AND (o.owner_user_id = auth.uid())))))) WITH CHECK ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = rsvp_parties.event_id) AND (o.owner_user_id = auth.uid()))))));

-- Name: seating_assignments organizer_all_seating; Type: POLICY; Schema: public

CREATE POLICY organizer_all_seating ON public.seating_assignments TO authenticated USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = seating_assignments.event_id) AND (o.owner_user_id = auth.uid())))))) WITH CHECK ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = seating_assignments.event_id) AND (o.owner_user_id = auth.uid()))))));

-- Name: tables organizer_all_tables; Type: POLICY; Schema: public

CREATE POLICY organizer_all_tables ON public.tables TO authenticated USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = tables.event_id) AND (o.owner_user_id = auth.uid())))))) WITH CHECK ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = tables.event_id) AND (o.owner_user_id = auth.uid()))))));

-- Name: user_roles organizer_read_own_role; Type: POLICY; Schema: public

CREATE POLICY organizer_read_own_role ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));

-- Name: event_payments organizer_read_payments; Type: POLICY; Schema: public

CREATE POLICY organizer_read_payments ON public.event_payments FOR SELECT TO authenticated USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = event_payments.event_id) AND (o.owner_user_id = auth.uid()))))));

-- Name: invitations organizer_select_invitations; Type: POLICY; Schema: public

CREATE POLICY organizer_select_invitations ON public.invitations FOR SELECT TO authenticated USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = invitations.event_id) AND (o.owner_user_id = auth.uid()))))));

-- Name: sms_credit_ledger organizer_select_ledger; Type: POLICY; Schema: public

CREATE POLICY organizer_select_ledger ON public.sms_credit_ledger FOR SELECT TO authenticated USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = sms_credit_ledger.event_id) AND (o.owner_user_id = auth.uid()))))));

-- Name: activity_logs organizer_select_logs; Type: POLICY; Schema: public

CREATE POLICY organizer_select_logs ON public.activity_logs FOR SELECT TO authenticated USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = activity_logs.event_id) AND (o.owner_user_id = auth.uid()))))));

-- Name: rsvp_response_history organizer_select_response_history; Type: POLICY; Schema: public

CREATE POLICY organizer_select_response_history ON public.rsvp_response_history FOR SELECT TO authenticated USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = rsvp_response_history.event_id) AND (o.owner_user_id = auth.uid()))))));

-- Name: sms_credit_wallets organizer_select_wallet; Type: POLICY; Schema: public

CREATE POLICY organizer_select_wallet ON public.sms_credit_wallets FOR SELECT TO authenticated USING ((public.is_super_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.events e
     JOIN public.organizations o ON ((e.org_id = o.id)))
  WHERE ((e.id = sms_credit_wallets.event_id) AND (o.owner_user_id = auth.uid()))))));

-- Name: payment_disputes; Type: ROW SECURITY; Schema: public

ALTER TABLE public.payment_disputes ENABLE ROW LEVEL SECURITY;

-- Name: permissions; Type: ROW SECURITY; Schema: public

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Name: role_permissions; Type: ROW SECURITY; Schema: public

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Name: roles; Type: ROW SECURITY; Schema: public

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Name: rsvp_parties; Type: ROW SECURITY; Schema: public

ALTER TABLE public.rsvp_parties ENABLE ROW LEVEL SECURITY;

-- Name: rsvp_response_history; Type: ROW SECURITY; Schema: public

ALTER TABLE public.rsvp_response_history ENABLE ROW LEVEL SECURITY;

-- Name: seating_assignments; Type: ROW SECURITY; Schema: public

ALTER TABLE public.seating_assignments ENABLE ROW LEVEL SECURITY;

-- Name: security_events; Type: ROW SECURITY; Schema: public

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Name: sessions; Type: ROW SECURITY; Schema: public

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Name: sms_credit_ledger; Type: ROW SECURITY; Schema: public

ALTER TABLE public.sms_credit_ledger ENABLE ROW LEVEL SECURITY;

-- Name: sms_credit_wallets; Type: ROW SECURITY; Schema: public

ALTER TABLE public.sms_credit_wallets ENABLE ROW LEVEL SECURITY;

-- Name: super_admin_config; Type: ROW SECURITY; Schema: public

ALTER TABLE public.super_admin_config ENABLE ROW LEVEL SECURITY;

-- Name: tables; Type: ROW SECURITY; Schema: public

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- Name: user_roles; Type: ROW SECURITY; Schema: public

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Name: SCHEMA public; Type: ACL; Schema: -

REVOKE USAGE ON SCHEMA public FROM PUBLIC;

-- ============================================================================
-- APPENDED — brings the snapshot above (current through 20260712) fully
-- current through supabase/migrations/20260719000000_marketing_forms.sql and
-- backend/migrations/006_guest_cap_response_update_trigger.sql. See the file
-- header for why this is appended rather than merged in place.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- backend/migrations/002_guest_analytics.sql, as it exists TODAY — its
-- original body created this table keyed to the legacy `rsvps` table, which
-- 20260705000000_guest_experience_rebuild.sql later dropped, re-keying this
-- table's rsvp_id column to party_id (see that migration's section 11). That
-- migration also DROPPED guest_reminders entirely (absorbed into
-- `invitations`), so it is intentionally not recreated here.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    party_id UUID REFERENCES public.rsvp_parties(id) ON DELETE SET NULL,
    session_id TEXT,
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    user_agent TEXT,
    ip_hash TEXT,
    referrer TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_analytics_event_id ON public.guest_analytics(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_analytics_event_type ON public.guest_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_guest_analytics_created_at ON public.guest_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_guest_analytics_session ON public.guest_analytics(session_id);

ALTER TABLE public.guest_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_analytics" ON public.guest_analytics;
CREATE POLICY "service_role_full_access_analytics" ON public.guest_analytics FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────
-- backend/migrations/003_must_reset_password.sql
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────
-- backend/migrations/004, 005, 006 — tier_max_guests enforcement triggers.
-- 006 is the final, consolidated form of the counting rule (declines free
-- their slot); 004's trigger-creation statements are still needed since 006
-- only re-pointed the function bodies, not the CREATE TRIGGER calls.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.count_reserved_guests(p_event_id UUID, p_exclude_party_id UUID DEFAULT NULL)
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

CREATE OR REPLACE FUNCTION public.enforce_tier_guest_cap()
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

DROP TRIGGER IF EXISTS trg_enforce_tier_guest_cap ON public.guests;
CREATE TRIGGER trg_enforce_tier_guest_cap
  BEFORE INSERT ON public.guests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tier_guest_cap();

CREATE OR REPLACE FUNCTION public.enforce_tier_guest_cap_on_response_update()
RETURNS TRIGGER AS $$
DECLARE
  v_cap INTEGER;
  v_count INTEGER;
  v_party_guest_count INTEGER;
BEGIN
  IF OLD.response IS DISTINCT FROM 'no' OR NEW.response = 'no' THEN
    RETURN NEW;
  END IF;

  SELECT tier_max_guests INTO v_cap FROM events WHERE id = NEW.event_id;
  IF v_cap IS NULL OR v_cap <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_party_guest_count FROM guests WHERE party_id = NEW.id;
  v_count := count_reserved_guests(NEW.event_id, NEW.id);

  IF v_count + v_party_guest_count > v_cap THEN
    RAISE EXCEPTION 'GUEST_LIMIT_REACHED: This event''s plan allows up to % guests (currently %, declines excluded).', v_cap, v_count
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_tier_guest_cap_on_response_update ON public.rsvp_parties;
CREATE TRIGGER trg_enforce_tier_guest_cap_on_response_update
  BEFORE UPDATE OF response ON public.rsvp_parties
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tier_guest_cap_on_response_update();

-- ─────────────────────────────────────────────────────────────────────────
-- 20260713000000_get_event_parties_rpc.sql
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_event_parties(
  p_event_id           UUID,
  p_response           TEXT DEFAULT NULL,
  p_search             TEXT DEFAULT NULL,
  p_seated             TEXT DEFAULT NULL,
  p_meal               TEXT DEFAULT NULL,
  p_custom_field_id    UUID DEFAULT NULL,
  p_custom_field_value TEXT DEFAULT NULL,
  p_sort               TEXT DEFAULT NULL,
  p_limit              INT  DEFAULT 50,
  p_offset             INT  DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT p.id, p.label, p.created_at
    FROM rsvp_parties p
    WHERE p.event_id = p_event_id
      AND (p_response IS NULL OR p.response::text = p_response)
      AND (p_search IS NULL OR p.label ILIKE '%' || p_search || '%')
      AND (
        p_seated IS NULL
        OR (p_seated = 'true'  AND     EXISTS (SELECT 1 FROM seating_assignments sa WHERE sa.party_id = p.id AND sa.event_id = p_event_id))
        OR (p_seated = 'false' AND NOT EXISTS (SELECT 1 FROM seating_assignments sa WHERE sa.party_id = p.id AND sa.event_id = p_event_id))
      )
      AND (
        p_meal IS NULL
        OR EXISTS (SELECT 1 FROM guests g WHERE g.party_id = p.id AND g.meal_selection = p_meal)
      )
      AND (
        p_custom_field_id IS NULL
        OR EXISTS (
          SELECT 1 FROM custom_answers ca
          WHERE ca.party_id = p.id
            AND ca.field_id = p_custom_field_id
            AND (
              p_custom_field_value IS NULL
              OR lower(btrim(ca.answer_value #>> '{}')) = lower(btrim(p_custom_field_value))
            )
        )
      )
  ),
  page AS (
    SELECT f.id,
           row_number() OVER (
             ORDER BY
               CASE WHEN p_sort = 'name_asc'  THEN f.label      END ASC  NULLS LAST,
               CASE WHEN p_sort = 'name_desc' THEN f.label      END DESC NULLS LAST,
               CASE WHEN p_sort = 'date_asc'  THEN f.created_at END ASC,
               CASE WHEN p_sort IS NULL OR p_sort NOT IN ('name_asc', 'name_desc', 'date_asc')
                    THEN f.created_at END DESC
           ) AS rn
    FROM filtered f
    ORDER BY rn
    LIMIT  GREATEST(p_limit, 0)
    OFFSET GREATEST(p_offset, 0)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtered),
    'parties', COALESCE((
      SELECT jsonb_agg(party_json ORDER BY rn)
      FROM (
        SELECT
          pg.rn,
          to_jsonb(p)
            || jsonb_build_object(
                 'guests', COALESCE((
                   SELECT jsonb_agg(to_jsonb(g) ORDER BY g.is_primary_contact DESC, g.id)
                   FROM guests g WHERE g.party_id = p.id
                 ), '[]'::jsonb),
                 'custom_answers', COALESCE((
                   SELECT jsonb_agg(to_jsonb(ca) ORDER BY ca.created_at, ca.id)
                   FROM custom_answers ca WHERE ca.party_id = p.id
                 ), '[]'::jsonb),
                 'seating_assignments', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object(
                            'id', sa.id,
                            'table_id', sa.table_id,
                            'tables', CASE WHEN t.id IS NULL THEN NULL
                                      ELSE jsonb_build_object('table_name', t.table_name) END)
                          ORDER BY sa.assigned_at, sa.id)
                   FROM seating_assignments sa
                   LEFT JOIN tables t ON t.id = sa.table_id
                   WHERE sa.party_id = p.id AND sa.event_id = p_event_id
                 ), '[]'::jsonb),
                 'invitations', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object('channel', i.channel, 'status', i.status)
                          ORDER BY i.created_at, i.id)
                   FROM invitations i WHERE i.party_id = p.id
                 ), '[]'::jsonb)
               ) AS party_json
        FROM page pg
        JOIN rsvp_parties p ON p.id = pg.id
      ) x
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.get_event_parties(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, INT, INT) FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 20260714000000_guest_side_tagging.sql
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rsvp_parties ADD COLUMN IF NOT EXISTS side TEXT;

ALTER TABLE public.rsvp_parties DROP CONSTRAINT IF EXISTS rsvp_parties_side_check;
ALTER TABLE public.rsvp_parties ADD CONSTRAINT rsvp_parties_side_check
  CHECK (side IS NULL OR side IN ('partner1', 'partner2'));

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS track_guest_side BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_rsvp_parties_event_side ON public.rsvp_parties(event_id, side);

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

REVOKE ALL ON FUNCTION public.add_guest_to_party(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) FROM anon, authenticated;

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
  SELECT * INTO v_event FROM events WHERE slug = p_slug;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Event not found.');
  END IF;

  v_is_demo := (v_event.slug = 'demo');
  v_side := CASE WHEN p_side IN ('partner1', 'partner2') THEN p_side END;

  PERFORM pg_advisory_xact_lock(hashtext('rsvp_submit:' || v_event.id::text));

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

  IF p_party_id IS NOT NULL THEN
    SELECT response INTO v_existing_resp FROM rsvp_parties WHERE id = p_party_id AND event_id = v_event.id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'code', 'RSVP_NOT_FOUND', 'message', 'The RSVP record was not found.');
    END IF;

    SELECT email INTO v_existing_email FROM guests WHERE party_id = p_party_id AND is_primary_contact = true;

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

    INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection)
    VALUES (v_party_id, v_event.id, p_guest_name, v_norm_email, p_phone, true,
            CASE WHEN p_response = 'yes' THEN NULLIF(p_primary_meal, '') ELSE NULL END);
  ELSE
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
          response_source = 'web_form', responded_at = now(), updated_at = now(),
          side = COALESCE(v_side, side)
        WHERE id = v_party_id AND event_id = v_event.id;
        v_is_update := true;
        DELETE FROM guests WHERE party_id = v_party_id;
        DELETE FROM custom_answers WHERE party_id = v_party_id;
        IF p_response = 'no' THEN
          DELETE FROM seating_assignments WHERE party_id = v_party_id;
        END IF;
      END IF;
    END IF;

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
          response_source = 'web_form', responded_at = now(), updated_at = now(),
          side = COALESCE(v_side, side)
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
      INSERT INTO rsvp_parties (event_id, label, response, notes, decline_reason, maybe_confirm_by, response_source, responded_at, side)
      VALUES (v_event.id, p_guest_name, p_response::rsvp_response_type, p_notes, v_decline_reason, v_maybe_confirm, 'web_form', now(), v_side)
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
          INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection, dietary_notes)
          VALUES (
            v_party_id, v_event.id, v_g ->> 'fullName', NULL,
            NULLIF(btrim(v_g ->> 'phone'), ''), false,
            NULLIF(v_g ->> 'mealSelection', ''), NULLIF(v_g ->> 'dietaryNotes', '')
          ) RETURNING id INTO v_new_guest_id;
        EXCEPTION WHEN unique_violation THEN
          INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection, dietary_notes)
          VALUES (
            v_party_id, v_event.id, v_g ->> 'fullName', NULL, NULL, false,
            NULLIF(v_g ->> 'mealSelection', ''), NULLIF(v_g ->> 'dietaryNotes', '')
          ) RETURNING id INTO v_new_guest_id;
        END;
      END;

      IF jsonb_typeof(v_g -> 'customAnswers') = 'object' THEN
        INSERT INTO custom_answers (party_id, guest_id, field_id, answer_value)
        SELECT v_party_id, v_new_guest_id, ca.key::uuid, to_jsonb(ca.value)
        FROM jsonb_each_text(v_g -> 'customAnswers') AS ca(key, value)
        WHERE NULLIF(btrim(ca.value), '') IS NOT NULL;
      END IF;
    END LOOP;

    INSERT INTO custom_answers (party_id, field_id, answer_value)
    SELECT v_party_id, (a.elem ->> 'fieldId')::uuid, a.elem -> 'value'
    FROM jsonb_array_elements(COALESCE(p_custom_answers, '[]'::jsonb)) WITH ORDINALITY AS a(elem, ord)
    WHERE a.ord <= 50;
  END IF;

  INSERT INTO activity_logs (event_id, action, entity_type, entity_id, metadata)
  VALUES (v_event.id, 'rsvp_submitted', 'rsvp_party', v_party_id,
          jsonb_build_object('guest_name', p_guest_name, 'response', p_response, 'party_size', v_party_size));

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

-- ─────────────────────────────────────────────────────────────────────────
-- 20260715000000_remove_companion_detail_fields.sql
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_age_group_check;
ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_gender_check;
ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_relationship_length_check;

ALTER TABLE public.guests
  DROP COLUMN IF EXISTS age_group,
  DROP COLUMN IF EXISTS relationship,
  DROP COLUMN IF EXISTS gender;

-- ─────────────────────────────────────────────────────────────────────────
-- 20260716000000_update_party_response_guest_cap.sql
-- ─────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────
-- 20260717000000_admin_revenue_consistency_fix.sql
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.sms_credit_ledger ADD COLUMN IF NOT EXISTS amount_cents INTEGER;

DROP FUNCTION IF EXISTS public.record_sms_purchase(UUID, INTEGER, TEXT);

CREATE FUNCTION public.record_sms_purchase(
  p_event_id        UUID,
  p_credits         INTEGER,
  p_payment_intent  TEXT,
  p_amount_cents    INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDITS');
  END IF;

  INSERT INTO sms_credit_wallets (event_id, credits_purchased, credits_used)
  VALUES (p_event_id, 0, 0)
  ON CONFLICT (event_id) DO NOTHING;

  SELECT id INTO v_wallet_id FROM sms_credit_wallets WHERE event_id = p_event_id;
  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'WALLET_NOT_FOUND');
  END IF;

  BEGIN
    INSERT INTO sms_credit_ledger (wallet_id, event_id, transaction_type, credits, stripe_payment_intent_id, amount_cents)
    VALUES (v_wallet_id, p_event_id, 'purchase', p_credits, p_payment_intent, p_amount_cents);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END;

  UPDATE sms_credit_wallets
  SET credits_purchased = credits_purchased + p_credits,
      updated_at = now()
  WHERE id = v_wallet_id;

  RETURN jsonb_build_object('success', true, 'already_processed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.record_sms_purchase(UUID, INTEGER, TEXT, INTEGER) FROM anon, authenticated;

DROP MATERIALIZED VIEW IF EXISTS mv_daily_revenue CASCADE;

CREATE MATERIALIZED VIEW mv_daily_revenue AS
WITH combined AS (
  SELECT
    date_trunc('day', COALESCE(completed_at, created_at))::date AS day,
    amount_cents,
    CASE
      WHEN refunded_at IS NOT NULL THEN COALESCE(refund_amount_cents, 0)
      WHEN status = 'refunded'     THEN COALESCE(refund_amount_cents, amount_cents)
      ELSE 0
    END AS refunded_cents,
    (status IN ('completed', 'refunded')) AS counts
  FROM event_payments
  UNION ALL
  SELECT
    date_trunc('day', created_at)::date AS day,
    COALESCE(amount_cents, 0) AS amount_cents,
    0 AS refunded_cents,
    true AS counts
  FROM sms_credit_ledger
  WHERE transaction_type = 'purchase'
)
SELECT
  day,
  COALESCE(sum(amount_cents) FILTER (WHERE counts), 0) AS gross_cents,
  COALESCE(sum(refunded_cents), 0) AS refunded_cents,
  COALESCE(sum(amount_cents) FILTER (WHERE counts), 0) - COALESCE(sum(refunded_cents), 0) AS net_cents,
  count(*) FILTER (WHERE counts) AS payment_count
FROM combined
GROUP BY 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_revenue_day ON mv_daily_revenue(day);

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
      'grossCents', (
        (SELECT COALESCE(sum(amount_cents), 0) FROM event_payments WHERE status IN ('completed', 'refunded'))
        + (SELECT COALESCE(sum(amount_cents), 0) FROM sms_credit_ledger WHERE transaction_type = 'purchase')
      ),
      'pendingCents', (SELECT COALESCE(sum(amount_cents), 0) FROM event_payments WHERE status = 'pending'),
      'refundedCents', (
        SELECT COALESCE(sum(
          CASE
            WHEN refunded_at IS NOT NULL THEN COALESCE(refund_amount_cents, 0)
            WHEN status = 'refunded'     THEN COALESCE(refund_amount_cents, amount_cents)
            ELSE 0
          END
        ), 0)
        FROM event_payments
      ),
      'byMonth', (
        SELECT COALESCE(jsonb_object_agg(m, cents), '{}'::jsonb)
        FROM (
          SELECT to_char(month, 'YYYY-MM') AS m, sum(cents) AS cents
          FROM (
            SELECT date_trunc('month', COALESCE(completed_at, created_at)) AS month, amount_cents AS cents
            FROM event_payments
            WHERE status IN ('completed', 'refunded')
              AND COALESCE(completed_at, created_at) >= (now() - interval '12 months')
            UNION ALL
            SELECT date_trunc('month', created_at) AS month, COALESCE(amount_cents, 0) AS cents
            FROM sms_credit_ledger
            WHERE transaction_type = 'purchase'
              AND created_at >= (now() - interval '12 months')
          ) monthly
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

-- ─────────────────────────────────────────────────────────────────────────
-- 20260718000000_rsvp_sms_consent.sql
-- Re-supersedes submit_rsvp_v2 above (adds p_sms_consent) — the DROP here
-- targets the 14-arg version this same file created above.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rsvp_parties ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.rsvp_parties ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ;

DROP FUNCTION IF EXISTS public.submit_rsvp_v2(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT);

CREATE FUNCTION public.submit_rsvp_v2(p_slug text, p_party_id uuid, p_guest_name text, p_email text, p_phone text, p_response text, p_party_size integer, p_notes text, p_primary_meal text, p_additional_guests jsonb, p_custom_answers jsonb, p_decline_reason text, p_maybe_confirm_by text, p_side text DEFAULT NULL, p_sms_consent boolean DEFAULT false, p_primary_dietary_notes text DEFAULT NULL) RETURNS jsonb
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
  v_primary_guest_id UUID;
BEGIN
  SELECT * INTO v_event FROM events WHERE slug = p_slug;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Event not found.');
  END IF;

  v_is_demo := (v_event.slug = 'demo');
  v_side := CASE WHEN p_side IN ('partner1', 'partner2') THEN p_side END;

  PERFORM pg_advisory_xact_lock(hashtext('rsvp_submit:' || v_event.id::text));

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

  IF p_response = 'yes' THEN
    FOR v_field IN
      SELECT id, scope, field_label FROM custom_form_fields
      WHERE event_id = v_event.id AND is_required = true AND is_meal_field = false
    LOOP
      IF v_field.scope = 'guest' THEN
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

  IF p_party_id IS NOT NULL THEN
    SELECT response INTO v_existing_resp FROM rsvp_parties WHERE id = p_party_id AND event_id = v_event.id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'code', 'RSVP_NOT_FOUND', 'message', 'The RSVP record was not found.');
    END IF;

    SELECT email INTO v_existing_email FROM guests WHERE party_id = p_party_id AND is_primary_contact = true;

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
      sms_consent = p_sms_consent, sms_consent_at = now()
    WHERE id = p_party_id AND event_id = v_event.id;

    v_party_id := p_party_id;
    v_is_update := true;

    DELETE FROM guests WHERE party_id = v_party_id;
    DELETE FROM custom_answers WHERE party_id = v_party_id;

    INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection, dietary_notes)
    VALUES (v_party_id, v_event.id, p_guest_name, v_norm_email, p_phone, true,
            CASE WHEN p_response = 'yes' THEN NULLIF(p_primary_meal, '') ELSE NULL END,
            CASE WHEN p_response = 'yes' THEN NULLIF(btrim(p_primary_dietary_notes), '') ELSE NULL END)
    RETURNING id INTO v_primary_guest_id;
  ELSE
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
          response_source = 'web_form', responded_at = now(), updated_at = now(),
          side = COALESCE(v_side, side),
          sms_consent = p_sms_consent, sms_consent_at = now()
        WHERE id = v_party_id AND event_id = v_event.id;
        v_is_update := true;
        DELETE FROM guests WHERE party_id = v_party_id;
        DELETE FROM custom_answers WHERE party_id = v_party_id;
        IF p_response = 'no' THEN
          DELETE FROM seating_assignments WHERE party_id = v_party_id;
        END IF;
      END IF;
    END IF;

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
          response_source = 'web_form', responded_at = now(), updated_at = now(),
          side = COALESCE(v_side, side),
          sms_consent = p_sms_consent, sms_consent_at = now()
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
      INSERT INTO rsvp_parties (event_id, label, response, notes, decline_reason, maybe_confirm_by, response_source, responded_at, side, sms_consent, sms_consent_at)
      VALUES (v_event.id, p_guest_name, p_response::rsvp_response_type, p_notes, v_decline_reason, v_maybe_confirm, 'web_form', now(), v_side, p_sms_consent, now())
      RETURNING id INTO v_party_id;

      BEGIN
        INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection, dietary_notes)
        VALUES (v_party_id, v_event.id, p_guest_name, v_norm_email, p_phone, true,
                CASE WHEN p_response = 'yes' THEN NULLIF(p_primary_meal, '') ELSE NULL END,
                CASE WHEN p_response = 'yes' THEN NULLIF(btrim(p_primary_dietary_notes), '') ELSE NULL END)
        RETURNING id INTO v_primary_guest_id;
      EXCEPTION WHEN unique_violation THEN
        DELETE FROM rsvp_parties WHERE id = v_party_id;
        RETURN jsonb_build_object('success', false, 'code', 'DUPLICATE_RSVP',
          'message', 'An RSVP with this email or phone already exists for this event.');
      END;
    ELSE
      INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection, dietary_notes)
      VALUES (v_party_id, v_event.id, p_guest_name, v_norm_email, p_phone, true,
              CASE WHEN p_response = 'yes' THEN NULLIF(p_primary_meal, '') ELSE NULL END,
              CASE WHEN p_response = 'yes' THEN NULLIF(btrim(p_primary_dietary_notes), '') ELSE NULL END)
      RETURNING id INTO v_primary_guest_id;
    END IF;
  END IF;

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
          INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection, dietary_notes)
          VALUES (
            v_party_id, v_event.id, v_g ->> 'fullName', NULL,
            NULLIF(btrim(v_g ->> 'phone'), ''), false,
            NULLIF(v_g ->> 'mealSelection', ''), NULLIF(v_g ->> 'dietaryNotes', '')
          ) RETURNING id INTO v_new_guest_id;
        EXCEPTION WHEN unique_violation THEN
          INSERT INTO guests (party_id, event_id, full_name, email, phone, is_primary_contact, meal_selection, dietary_notes)
          VALUES (
            v_party_id, v_event.id, v_g ->> 'fullName', NULL, NULL, false,
            NULLIF(v_g ->> 'mealSelection', ''), NULLIF(v_g ->> 'dietaryNotes', '')
          ) RETURNING id INTO v_new_guest_id;
        END;
      END;

      IF jsonb_typeof(v_g -> 'customAnswers') = 'object' THEN
        INSERT INTO custom_answers (party_id, guest_id, field_id, answer_value)
        SELECT v_party_id, v_new_guest_id, ca.key::uuid, to_jsonb(ca.value)
        FROM jsonb_each_text(v_g -> 'customAnswers') AS ca(key, value)
        WHERE NULLIF(btrim(ca.value), '') IS NOT NULL;
      END IF;
    END LOOP;

    INSERT INTO custom_answers (party_id, guest_id, field_id, answer_value)
    SELECT v_party_id,
           CASE WHEN cff.scope = 'guest' THEN v_primary_guest_id ELSE NULL END,
           (a.elem ->> 'fieldId')::uuid, a.elem -> 'value'
    FROM jsonb_array_elements(COALESCE(p_custom_answers, '[]'::jsonb)) WITH ORDINALITY AS a(elem, ord)
    JOIN custom_form_fields cff ON cff.id = (a.elem ->> 'fieldId')::uuid
    WHERE a.ord <= 200;
  END IF;

  INSERT INTO activity_logs (event_id, action, entity_type, entity_id, metadata)
  VALUES (v_event.id, 'rsvp_submitted', 'rsvp_party', v_party_id,
          jsonb_build_object('guest_name', p_guest_name, 'response', p_response, 'party_size', v_party_size));

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

REVOKE ALL ON FUNCTION public.submit_rsvp_v2(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 20260719000000_marketing_forms.sql
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'footer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  segment TEXT NOT NULL DEFAULT 'general' CHECK (segment IN ('general', 'planners', 'venues', 'corporate')),
  company TEXT,
  phone TEXT,
  expected_guests TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'responded', 'closed')),
  admin_response TEXT,
  responded_at TIMESTAMPTZ,
  responded_by UUID
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON public.contact_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_segment ON public.contact_submissions(segment);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON public.contact_submissions(status);

-- ─────────────────────────────────────────────────────────────────────────
-- 20260723010000_organizer_added_seating_reveal.sql
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rsvp_parties ADD COLUMN IF NOT EXISTS created_by_organizer BOOLEAN NOT NULL DEFAULT false;
