-- Update unassign_seat stored function to return seats_remaining after deletion
CREATE OR REPLACE FUNCTION public.unassign_seat(
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
    v_table_capacity INTEGER;
    v_current_occupied INTEGER;
    v_remaining      INTEGER;
BEGIN
    -- Authorization: verify caller owns this event or is super_admin
    IF NOT public._is_event_authorized(p_event_id, p_assigned_by) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'You are not authorized to manage seating for this event.'
        );
    END IF;

    -- Verify the seating assignment exists for this event + rsvp
    SELECT sa.id, sa.table_id, t.table_name, t.max_capacity, r.party_size
    INTO v_assignment_id, v_table_id, v_table_name, v_table_capacity, v_party_size
    FROM public.seating_assignments sa
    JOIN public.tables t ON t.id = sa.table_id
    JOIN public.rsvps r ON r.id = sa.rsvp_id
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

    -- Acquire transactional advisory lock based on the table's UUID hash
    PERFORM pg_advisory_xact_lock(hashtext(v_table_id::text));

    -- Delete the seating assignment
    DELETE FROM public.seating_assignments
    WHERE event_id = p_event_id
      AND rsvp_id  = p_rsvp_id;

    -- Calculate current table occupancy after deletion
    SELECT COALESCE(SUM(r.party_size), 0)
    INTO v_current_occupied
    FROM public.seating_assignments sa
    JOIN public.rsvps r ON r.id = sa.rsvp_id
    WHERE sa.table_id = v_table_id;

    v_remaining := v_table_capacity - v_current_occupied;

    -- Log to activity_logs
    INSERT INTO public.activity_logs (
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
        'message', format('Guest unassigned from %s.', v_table_name),
        'seats_remaining', v_remaining
    );
END;
$$;
