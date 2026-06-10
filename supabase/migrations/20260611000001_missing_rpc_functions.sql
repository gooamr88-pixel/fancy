-- ═══════════════════════════════════════════════════════════
-- FANCY RSVP - MISSING RPC FUNCTIONS & SCHEMA PATCHES
-- 1. unassign_seat() RPC
-- 2. refund_sms_credit_atomic() fix (FOR UPDATE + validation)
-- 3. organizations.email UNIQUE constraint
-- 4. Brute-force login protection columns
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────
-- 1. unassign_seat() — Remove a seating assignment atomically
-- ─────────────────────────────────────────────────────────

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
-- 2. refund_sms_credit_atomic() — Fix with FOR UPDATE lock
--    and credits_used >= 0 validation
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refund_sms_credit_atomic(
    p_wallet_id  UUID,
    p_event_id   UUID,
    p_ledger_id  UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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


-- ─────────────────────────────────────────────────────────
-- 3. UNIQUE constraint on organizations.email
-- ─────────────────────────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'organizations_email_unique'
          AND conrelid = 'organizations'::regclass
    ) THEN
        ALTER TABLE organizations
            ADD CONSTRAINT organizations_email_unique UNIQUE (email);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN NULL;   -- constraint already exists
    WHEN duplicate_object THEN NULL;  -- constraint already exists (alt error)
END;
$$;


-- ─────────────────────────────────────────────────────────
-- 4. Login brute-force protection columns
-- ─────────────────────────────────────────────────────────

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMPTZ;

COMMIT;
