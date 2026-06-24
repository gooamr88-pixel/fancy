-- ════════════════════════════════════════════════════════════════════════
-- Atomic MULTI-credit SMS deduction + refund (segment-accurate billing)
-- ────────────────────────────────────────────────────────────────────────
-- The original deduct_sms_credit_atomic() debits exactly ONE credit per call,
-- which under-bills multi-segment messages (a 320-char SMS = 2 segments = 2
-- credits at the carrier, but only 1 was charged). These functions debit the
-- exact segment count in a single, row-locked transaction so the wallet can
-- never be over-spent or driven negative under concurrency.
--
-- Both are additive — the single-credit functions remain for backward compat,
-- and the controller falls back to them automatically if this migration has
-- not been applied yet (deploy-order safe).
--
-- Idempotency: reuses the existing partial unique index
-- idx_sms_credit_ledger_idempotency ON sms_credit_ledger(idempotency_key).
-- A repeat call with the same key returns the prior ledger row WITHOUT
-- charging again — so a client retry after a timeout never double-charges or
-- double-sends.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.deduct_sms_credits_atomic(
    p_event_id        UUID,
    p_count           INTEGER,
    p_phone           TEXT,
    p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.refund_sms_credits_atomic(
    p_wallet_id UUID,
    p_event_id  UUID,
    p_ledger_id UUID,
    p_count     INTEGER DEFAULT 1
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Server-side only (invoked by the API with the service role).
REVOKE ALL ON FUNCTION public.deduct_sms_credits_atomic(UUID, INTEGER, TEXT, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_sms_credits_atomic(UUID, UUID, UUID, INTEGER) FROM anon, authenticated;
