-- ════════════════════════════════════════════════════════════════════════
-- SMS delivery reconciliation + auto-refund (closes the exactly-once loop)
-- ────────────────────────────────────────────────────────────────────────
-- The send path charges a credit when a message is HANDED to Twilio. But a
-- message can still fail later at the carrier (undelivered/failed) — that async
-- outcome arrives via Twilio's status callback. This migration lets the webhook
-- refund such messages atomically and exactly once.
--
-- Idempotency: refunding DELETES the consumption ledger row, so a repeated
-- callback for the same SID finds nothing and is a clean no-op. The whole thing
-- runs under FOR UPDATE so concurrent callbacks for one SID serialize.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE sms_campaign_recipients ADD COLUMN IF NOT EXISTS delivery_status TEXT;
ALTER TABLE sms_campaign_recipients ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Lookups by SID during reconciliation.
CREATE INDEX IF NOT EXISTS idx_sms_credit_ledger_sid ON sms_credit_ledger(sms_sid) WHERE sms_sid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipients_sid ON sms_campaign_recipients(sms_sid) WHERE sms_sid IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reconcile_sms_delivery(
    p_sms_sid    TEXT,
    p_status     TEXT,
    p_error_code TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.reconcile_sms_delivery(TEXT, TEXT, TEXT) FROM anon, authenticated;
