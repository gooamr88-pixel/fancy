-- Feature Payment Gate
-- Adds _is_event_paid() helper and inserts payment-gate checks into
-- assign_seat() and reassign_seat(). unassign_seat() is intentionally
-- left ungated so organizers can always free seats.

-- A. Helper: returns TRUE when the event is paid or has a manual override.
CREATE OR REPLACE FUNCTION _is_event_paid(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM events
        WHERE id = p_event_id
          AND (is_paid = true OR manual_override = true)
    );
END;
$$;

-- B. Recreate assign_seat with payment gate after auth check.
CREATE OR REPLACE FUNCTION assign_seat(
    p_event_id UUID,
    p_rsvp_id UUID,
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
    -- Authorization: verify caller owns this event or is super_admin
    IF NOT public._is_event_authorized(p_event_id, p_assigned_by) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'You are not authorized to manage seating for this event.'
        );
    END IF;

    -- Payment gate: event must be paid or have manual_override
    IF NOT public._is_event_paid(p_event_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'FEATURE_REQUIRES_PAYMENT',
            'message', 'Seating assignment requires a paid event.'
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

    SELECT COALESCE(SUM(r.party_size), 0)
    INTO v_current_occupied
    FROM seating_assignments sa
    JOIN rsvps r ON r.id = sa.rsvp_id
    WHERE sa.table_id = p_table_id;

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

    v_remaining := v_table_capacity - v_current_occupied;
    IF (NOT p_force) AND v_party_size > v_remaining THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CAPACITY_EXCEEDED',
            'message', format('%s has %s remaining seats, party size is %s.', v_table_name, v_remaining, v_party_size)
        );
    END IF;

    INSERT INTO seating_assignments (event_id, rsvp_id, table_id, assigned_by)
    VALUES (p_event_id, p_rsvp_id, p_table_id, p_assigned_by)
    RETURNING id INTO v_assignment_id;

    INSERT INTO activity_logs (event_id, actor_id, action, entity_type, entity_id, metadata)
    VALUES (p_event_id, p_assigned_by, 'table_assigned', 'seating_assignment', v_assignment_id,
            jsonb_build_object('table_id', p_table_id, 'table_name', v_table_name, 'party_size', v_party_size, 'forced', p_force));

    RETURN jsonb_build_object(
        'success', true,
        'assignment_id', v_assignment_id,
        'seats_remaining', v_remaining - v_party_size,
        'forced', p_force
    );
END;
$$;

-- C. Recreate reassign_seat with payment gate after auth check.
CREATE OR REPLACE FUNCTION reassign_seat(
    p_event_id UUID,
    p_rsvp_id UUID,
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
    -- Authorization
    IF NOT public._is_event_authorized(p_event_id, p_assigned_by) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'You are not authorized to manage seating for this event.'
        );
    END IF;

    -- Payment gate: event must be paid or have manual_override
    IF NOT public._is_event_paid(p_event_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'FEATURE_REQUIRES_PAYMENT',
            'message', 'Seating assignment requires a paid event.'
        );
    END IF;

    SELECT sa.table_id, t.table_name
    INTO v_old_table_id, v_old_table_name
    FROM seating_assignments sa
    JOIN tables t ON t.id = sa.table_id
    WHERE sa.event_id = p_event_id AND sa.rsvp_id = p_rsvp_id;

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

    SELECT party_size INTO v_party_size FROM rsvps WHERE id = p_rsvp_id;

    SELECT max_capacity, table_name
    INTO v_new_table_capacity, v_new_table_name
    FROM tables WHERE id = p_new_table_id AND event_id = p_event_id FOR UPDATE;

    SELECT COALESCE(SUM(r.party_size), 0)
    INTO v_new_occupied
    FROM seating_assignments sa
    JOIN rsvps r ON r.id = sa.rsvp_id
    WHERE sa.table_id = p_new_table_id;

    v_new_remaining := v_new_table_capacity - v_new_occupied;

    IF (NOT p_force) AND v_party_size > v_new_remaining THEN
        RETURN jsonb_build_object(
            'success', false, 'error', 'CAPACITY_EXCEEDED',
            'message', format('%s has %s remaining seats, party size is %s.', v_new_table_name, v_new_remaining, v_party_size)
        );
    END IF;

    UPDATE seating_assignments
    SET table_id = p_new_table_id, assigned_at = now(), assigned_by = p_assigned_by
    WHERE event_id = p_event_id AND rsvp_id = p_rsvp_id
    RETURNING id INTO v_assignment_id;

    INSERT INTO activity_logs (event_id, actor_id, action, entity_type, entity_id, metadata)
    VALUES (p_event_id, p_assigned_by, 'table_reassigned', 'seating_assignment', v_assignment_id,
            jsonb_build_object('from_table', v_old_table_name, 'to_table', v_new_table_name, 'party_size', v_party_size, 'forced', p_force));

    RETURN jsonb_build_object(
        'success', true, 'assignment_id', v_assignment_id,
        'from_table', v_old_table_name, 'to_table', v_new_table_name,
        'seats_remaining_new_table', v_new_remaining - v_party_size, 'forced', p_force
    );
END;
$$;
