-- ════════════════════════════════════════════════════════════════════════
-- Fix: assign_seat / reassign_seat concurrent same-party race
-- ────────────────────────────────────────────────────────────────────────
-- assign_seat's advisory lock was keyed only on p_table_id. Two concurrent
-- calls assigning the SAME party to two DIFFERENT tables acquired locks on
-- different hash keys and so never serialized against each other: both
-- passed the "already assigned" pre-check, then both attempted to INSERT
-- into seating_assignments. The UNIQUE(event_id, party_id) constraint still
-- prevented double-seating, but the losing transaction's raw 23505
-- unique_violation propagated all the way to the client as a generic 500
-- DATABASE_ERROR instead of a clean, expected conflict response — unlike
-- checkInParty's ALREADY_CHECKED_IN handling for the analogous race.
--
-- Fixed by taking a transactional advisory lock keyed on p_party_id (in
-- addition to the existing table lock) before the "already assigned" check,
-- so concurrent assign/reassign attempts for the same party always
-- serialize regardless of which table(s) they target. An EXCEPTION handler
-- is added as defense-in-depth in case the constraint is ever hit anyway.
-- ════════════════════════════════════════════════════════════════════════

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

    -- Serialize on the party FIRST — this is the invariant actually being
    -- protected (a party can hold at most one seating_assignments row).
    -- Locking only the table (below) doesn't prevent two concurrent calls
    -- from targeting the same party at two different tables.
    PERFORM pg_advisory_xact_lock(hashtext(p_party_id::text));
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
EXCEPTION WHEN unique_violation THEN
    -- Defense-in-depth: should be unreachable now that the party lock above
    -- serializes concurrent callers, but converts any future edge case into
    -- the same clean conflict response the pre-check already returns.
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ASSIGNED', 'message', 'This guest is already assigned to a table.');
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

    -- Serialize on the party before touching either table, for the same
    -- reason as assign_seat above (see migration header).
    PERFORM pg_advisory_xact_lock(hashtext(p_party_id::text));

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
