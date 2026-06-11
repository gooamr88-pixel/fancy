-- ═══════════════════════════════════════════════════════════
-- FANCY RSVP - AUDIT FIXES MIGRATION
-- H10: Authorization checks in seating RPC functions
-- M22: Missing index for is_super_admin()
-- M23: Fix search_path on update_updated_at_column
-- M29: Idempotency key for deduct_sms_credit_atomic
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────
-- M22: Add missing composite index for is_super_admin() lookups
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON user_roles(user_id, role);


-- ─────────────────────────────────────────────────────────
-- M23: Fix search_path on update_updated_at_column trigger function
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- ─────────────────────────────────────────────────────────
-- H10: Authorization checks in seating RPC functions
-- Verify p_assigned_by is the org owner OR a super_admin
-- ─────────────────────────────────────────────────────────

-- Helper: check if a user is authorized for a given event
-- (they must be the org owner or a super admin)
CREATE OR REPLACE FUNCTION _is_event_authorized(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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


-- assign_seat: add authorization check
CREATE OR REPLACE FUNCTION assign_seat(
    p_event_id UUID,
    p_rsvp_id UUID,
    p_table_id UUID,
    p_assigned_by UUID
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
    -- Authorization: verify caller owns this event or is super_admin
    IF NOT _is_event_authorized(p_event_id, p_assigned_by) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'You are not authorized to manage seating for this event.'
        );
    END IF;

    -- Acquire transactional advisory lock based on the table's UUID hash
    PERFORM pg_advisory_xact_lock(hashtext(p_table_id::text));

    -- Check if guest is already assigned
    SELECT id INTO v_existing
    FROM seating_assignments
    WHERE event_id = p_event_id AND rsvp_id = p_rsvp_id;

    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ALREADY_ASSIGNED',
            'message', 'This guest is already assigned to a table.'
        );
    END IF;

    -- Fetch capacity and lock the table row
    SELECT max_capacity, table_name
    INTO v_table_capacity, v_table_name
    FROM tables
    WHERE id = p_table_id AND event_id = p_event_id
    FOR UPDATE;

    IF v_table_capacity IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'TABLE_NOT_FOUND',
            'message', 'Specified table not found.'
        );
    END IF;

    -- Calculate current table occupancy
    SELECT COALESCE(SUM(r.party_size), 0)
    INTO v_current_occupied
    FROM seating_assignments sa
    JOIN rsvps r ON r.id = sa.rsvp_id
    WHERE sa.table_id = p_table_id;

    -- Fetch party size of guest
    SELECT party_size INTO v_party_size
    FROM rsvps
    WHERE id = p_rsvp_id AND event_id = p_event_id AND response = 'yes';

    IF v_party_size IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'RSVP_NOT_FOUND',
            'message', 'RSVP not found or guest is not attending.'
        );
    END IF;

    -- Capacity Assertion
    v_remaining := v_table_capacity - v_current_occupied;
    IF v_party_size > v_remaining THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CAPACITY_EXCEEDED',
            'message', format('%s has %s remaining seats, party size is %s.', v_table_name, v_remaining, v_party_size)
        );
    END IF;

    -- Insert atomic seating assignment
    INSERT INTO seating_assignments (event_id, rsvp_id, table_id, assigned_by)
    VALUES (p_event_id, p_rsvp_id, p_table_id, p_assigned_by)
    RETURNING id INTO v_assignment_id;

    -- Log transaction
    INSERT INTO activity_logs (event_id, actor_id, action, entity_type, entity_id, metadata)
    VALUES (p_event_id, p_assigned_by, 'table_assigned', 'seating_assignment', v_assignment_id,
            jsonb_build_object('table_id', p_table_id, 'table_name', v_table_name, 'party_size', v_party_size));

    RETURN jsonb_build_object(
        'success', true,
        'assignment_id', v_assignment_id,
        'seats_remaining', v_remaining - v_party_size
    );
END;
$$;


-- reassign_seat: add authorization check
CREATE OR REPLACE FUNCTION reassign_seat(
    p_event_id UUID,
    p_rsvp_id UUID,
    p_new_table_id UUID,
    p_assigned_by UUID
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
    -- Authorization: verify caller owns this event or is super_admin
    IF NOT _is_event_authorized(p_event_id, p_assigned_by) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'You are not authorized to manage seating for this event.'
        );
    END IF;

    -- Resolve old assignment
    SELECT sa.table_id, t.table_name
    INTO v_old_table_id, v_old_table_name
    FROM seating_assignments sa
    JOIN tables t ON t.id = sa.table_id
    WHERE sa.event_id = p_event_id AND sa.rsvp_id = p_rsvp_id;

    IF v_old_table_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'NOT_ASSIGNED',
            'message', 'Guest is not currently assigned to any table.'
        );
    END IF;

    IF v_old_table_id = p_new_table_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'SAME_TABLE',
            'message', 'Guest is already assigned to this table.'
        );
    END IF;

    -- Lock both tables in UUID order to prevent deadlocks
    IF p_new_table_id > v_old_table_id THEN
        PERFORM pg_advisory_xact_lock(hashtext(v_old_table_id::text));
        PERFORM pg_advisory_xact_lock(hashtext(p_new_table_id::text));
    ELSE
        PERFORM pg_advisory_xact_lock(hashtext(p_new_table_id::text));
        PERFORM pg_advisory_xact_lock(hashtext(v_old_table_id::text));
    END IF;

    -- Fetch party size
    SELECT party_size INTO v_party_size FROM rsvps WHERE id = p_rsvp_id;

    -- Check new table capacity
    SELECT max_capacity, table_name
    INTO v_new_table_capacity, v_new_table_name
    FROM tables
    WHERE id = p_new_table_id AND event_id = p_event_id
    FOR UPDATE;

    SELECT COALESCE(SUM(r.party_size), 0)
    INTO v_new_occupied
    FROM seating_assignments sa
    JOIN rsvps r ON r.id = sa.rsvp_id
    WHERE sa.table_id = p_new_table_id;

    v_new_remaining := v_new_table_capacity - v_new_occupied;

    IF v_party_size > v_new_remaining THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CAPACITY_EXCEEDED',
            'message', format('%s has %s remaining seats, party size is %s.', v_new_table_name, v_new_remaining, v_party_size)
        );
    END IF;

    -- Update seating assignment
    UPDATE seating_assignments
    SET table_id = p_new_table_id,
        assigned_at = now(),
        assigned_by = p_assigned_by
    WHERE event_id = p_event_id AND rsvp_id = p_rsvp_id
    RETURNING id INTO v_assignment_id;

    -- Log transaction
    INSERT INTO activity_logs (event_id, actor_id, action, entity_type, entity_id, metadata)
    VALUES (p_event_id, p_assigned_by, 'table_reassigned', 'seating_assignment', v_assignment_id,
            jsonb_build_object('from_table', v_old_table_name, 'to_table', v_new_table_name, 'party_size', v_party_size));

    RETURN jsonb_build_object(
        'success', true,
        'assignment_id', v_assignment_id,
        'from_table', v_old_table_name,
        'to_table', v_new_table_name,
        'seats_remaining_new_table', v_new_remaining - v_party_size
    );
END;
$$;


-- unassign_seat: add authorization check
CREATE OR REPLACE FUNCTION unassign_seat(
    p_event_id   UUID,
    p_rsvp_id    UUID,
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
BEGIN
    -- Authorization: verify caller owns this event or is super_admin
    IF NOT _is_event_authorized(p_event_id, p_assigned_by) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'You are not authorized to manage seating for this event.'
        );
    END IF;

    -- Verify the seating assignment exists for this event + rsvp
    SELECT sa.id, sa.table_id, t.table_name
    INTO v_assignment_id, v_table_id, v_table_name
    FROM seating_assignments sa
    JOIN tables t ON t.id = sa.table_id
    WHERE sa.event_id = p_event_id
      AND sa.rsvp_id  = p_rsvp_id
    FOR UPDATE OF sa;

    IF v_assignment_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',   'ASSIGNMENT_NOT_FOUND',
            'message', 'No seating assignment found for this event and RSVP.'
        );
    END IF;

    -- Fetch party size for logging
    SELECT party_size INTO v_party_size
    FROM rsvps
    WHERE id = p_rsvp_id;

    -- Delete the seating assignment
    DELETE FROM seating_assignments
    WHERE event_id = p_event_id
      AND rsvp_id  = p_rsvp_id;

    -- Log to activity_logs
    INSERT INTO activity_logs (
        event_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata
    ) VALUES (
        p_event_id,
        p_assigned_by,
        'table_unassigned',
        'seating_assignment',
        v_assignment_id,
        jsonb_build_object(
            'table_id',    v_table_id,
            'table_name',  v_table_name,
            'rsvp_id',     p_rsvp_id,
            'party_size',  v_party_size
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', format('Guest unassigned from %s.', v_table_name)
    );
END;
$$;


-- ─────────────────────────────────────────────────────────
-- M29: Add idempotency_key to deduct_sms_credit_atomic
-- If a key is provided and a ledger entry with that key exists,
-- skip the deduction and return the existing entry.
-- ─────────────────────────────────────────────────────────

-- Add idempotency_key column to sms_credit_ledger
ALTER TABLE sms_credit_ledger ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_credit_ledger_idempotency
  ON sms_credit_ledger(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Recreate deduct_sms_credit_atomic with idempotency support
CREATE OR REPLACE FUNCTION deduct_sms_credit_atomic(
    p_event_id UUID,
    p_phone TEXT,
    p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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


-- Also update the search_path hardening for the new function signature
ALTER FUNCTION public._is_event_authorized(UUID, UUID) SET search_path = public;

COMMIT;
