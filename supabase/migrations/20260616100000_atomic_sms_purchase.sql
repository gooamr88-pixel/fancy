-- ════════════════════════════════════════════════════════════════════════
-- Atomic SMS credit purchase (webhook-safe)
-- ────────────────────────────────────────────────────────────────────────
-- Previously the webhook inserted the idempotency ledger row and THEN called
-- increment_sms_credits as a separate statement. If the process died between
-- the two, Stripe's retry hit the ledger's unique constraint and returned
-- early — skipping the credit increment. Result: ledger shows a purchase but
-- the wallet was never credited (lost credits).
--
-- record_sms_purchase performs wallet-ensure + ledger-insert + increment in a
-- SINGLE transaction (the function body). Either everything commits or nothing
-- does, so a retry is always safe:
--   • first delivery        → credits added, ledger written, atomically
--   • duplicate delivery     → unique_violation caught → already_processed=true,
--                              no double credit
--   • mid-way failure        → whole function rolls back → clean retry
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.record_sms_purchase(
  p_event_id        UUID,
  p_credits         INTEGER,
  p_payment_intent  TEXT
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

-- Server-side only (called by the webhook with the service role).
REVOKE ALL ON FUNCTION public.record_sms_purchase(UUID, INTEGER, TEXT) FROM anon, authenticated;
