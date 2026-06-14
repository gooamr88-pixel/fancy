-- PRD updates for Fancy RSVP
-- 1. Add event_type and background_music_url to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'wedding';
ALTER TABLE events ADD COLUMN IF NOT EXISTS background_music_url TEXT;

-- 2. Add reference_number to event_payments
ALTER TABLE event_payments ADD COLUMN IF NOT EXISTS reference_number TEXT UNIQUE;

-- 3. Update approve_event_cash RPC to support updating existing pending manual payment
CREATE OR REPLACE FUNCTION approve_event_cash(
    p_event_id UUID,
    p_approved_by UUID,
    p_amount_cents INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
