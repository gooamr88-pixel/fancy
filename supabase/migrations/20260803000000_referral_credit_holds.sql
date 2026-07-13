-- ════════════════════════════════════════════════════════════════════════
-- REFERRAL CREDIT HOLDS — atomic reserve / capture / release
-- ────────────────────────────────────────────────────────────────────────
-- The application-level "read balance, then apply" approach can't close a
-- TOCTOU race: two checkouts opened at once both read the same balance and
-- both apply it, letting a user spend the same credit twice. The professional
-- fix (mirroring this codebase's record_sms_purchase RPC) is to make the
-- reservation an ATOMIC database operation.
--
-- A HOLD earmarks credit the moment a checkout is created. Available credit is
-- always  ledger_balance − active_non_expired_holds, so a second concurrent
-- checkout sees the already-held amount subtracted and can't double-spend.
--   • reserve  → serialize per-org (advisory lock), compute availability, cut a
--                hold for the affordable slice. Supersedes an event's own prior
--                hold so re-entering checkout / switching method never stacks.
--   • capture  → payment confirmed: flip the hold to 'captured' and write the
--                real 'redeemed' ledger row, in one transaction. Idempotent.
--   • release  → checkout abandoned/declined: free the hold. Abandoned card
--                holds also self-heal via expires_at (lazy expiry, no sweeper).
--
-- RLS: enabled, no policies — service-role-only, like every other backend table.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS referral_credit_holds (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_id      uuid REFERENCES events(id) ON DELETE SET NULL,
    amount_cents  integer NOT NULL CHECK (amount_cents > 0),
    status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'captured', 'released')),
    reference     text,                       -- Stripe session id (card) / manual payment id, for tracing
    expires_at    timestamptz NOT NULL,
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_credit_holds_org_active ON referral_credit_holds(org_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_referral_credit_holds_event_active ON referral_credit_holds(event_id) WHERE status = 'active';

ALTER TABLE referral_credit_holds ENABLE ROW LEVEL SECURITY;

-- Link the hold to the payment it funds, so capture/release can find it and so a
-- refund/decline can be reconciled.
ALTER TABLE event_payments
  ADD COLUMN IF NOT EXISTS referral_hold_id uuid REFERENCES referral_credit_holds(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────
-- reserve_referral_credit
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_referral_credit(
  p_org_id          uuid,
  p_event_id        uuid,
  p_requested_cents integer,
  p_ttl_minutes     integer,
  p_reference       text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance   bigint;
  v_held      bigint;
  v_available bigint;
  v_reserve   integer;
  v_hold_id   uuid;
BEGIN
  IF p_org_id IS NULL OR p_requested_cents IS NULL OR p_requested_cents <= 0 THEN
    RETURN jsonb_build_object('reserved_cents', 0, 'hold_id', NULL);
  END IF;

  -- Serialize the availability math for this org so two concurrent checkouts
  -- can't both observe the same balance and both reserve it. Transaction-scoped:
  -- released automatically at COMMIT/ROLLBACK.
  PERFORM pg_advisory_xact_lock(hashtext('referral_credit:' || p_org_id::text));

  -- An event only ever earmarks credit ONCE: re-entering checkout or switching
  -- payment method supersedes the event's own prior active hold instead of stacking.
  IF p_event_id IS NOT NULL THEN
    UPDATE referral_credit_holds
    SET status = 'released', updated_at = now()
    WHERE org_id = p_org_id AND event_id = p_event_id AND status = 'active';
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_balance
  FROM referral_credit_ledger WHERE org_id = p_org_id;

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_held
  FROM referral_credit_holds
  WHERE org_id = p_org_id AND status = 'active' AND expires_at > now();

  v_available := GREATEST(0, v_balance - v_held);
  v_reserve := LEAST(v_available, p_requested_cents)::integer;

  IF v_reserve <= 0 THEN
    RETURN jsonb_build_object('reserved_cents', 0, 'hold_id', NULL);
  END IF;

  INSERT INTO referral_credit_holds (org_id, event_id, amount_cents, status, reference, expires_at)
  VALUES (
    p_org_id, p_event_id, v_reserve, 'active', p_reference,
    now() + make_interval(mins => GREATEST(1, COALESCE(p_ttl_minutes, 1440)))
  )
  RETURNING id INTO v_hold_id;

  RETURN jsonb_build_object('reserved_cents', v_reserve, 'hold_id', v_hold_id);
END;
$$;

-- ─────────────────────────────────────────────────────────
-- capture_referral_hold
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.capture_referral_hold(
  p_hold_id    uuid,
  p_payment_id uuid,
  p_note       text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold referral_credit_holds%ROWTYPE;
BEGIN
  IF p_hold_id IS NULL THEN
    RETURN jsonb_build_object('captured', false, 'captured_cents', 0);
  END IF;

  SELECT * INTO v_hold FROM referral_credit_holds WHERE id = p_hold_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('captured', false, 'error', 'HOLD_NOT_FOUND');
  END IF;

  -- Idempotent: a racing capture (webhook vs. synchronous verify) already ran.
  IF v_hold.status = 'captured' THEN
    RETURN jsonb_build_object('captured', true, 'already_captured', true, 'captured_cents', v_hold.amount_cents);
  END IF;
  IF v_hold.status <> 'active' THEN
    RETURN jsonb_build_object('captured', false, 'error', 'HOLD_NOT_ACTIVE');
  END IF;

  UPDATE referral_credit_holds SET status = 'captured', updated_at = now() WHERE id = p_hold_id;

  -- Record the actual spend in the SAME transaction as the status flip. The
  -- redeemed-once partial unique index on payment_id is a second guard against a
  -- duplicate debit for the same payment.
  BEGIN
    INSERT INTO referral_credit_ledger (org_id, amount_cents, type, event_id, payment_id, note)
    VALUES (v_hold.org_id, -v_hold.amount_cents, 'redeemed', v_hold.event_id, p_payment_id, p_note);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('captured', true, 'already_recorded', true, 'captured_cents', v_hold.amount_cents);
  END;

  RETURN jsonb_build_object('captured', true, 'captured_cents', v_hold.amount_cents);
END;
$$;

-- ─────────────────────────────────────────────────────────
-- release_referral_hold
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_referral_hold(p_hold_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_hold_id IS NULL THEN
    RETURN jsonb_build_object('released', false);
  END IF;
  UPDATE referral_credit_holds SET status = 'released', updated_at = now()
  WHERE id = p_hold_id AND status = 'active';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('released', v_count > 0);
END;
$$;

-- Server-role only (called by the backend with the service key).
REVOKE ALL ON FUNCTION public.reserve_referral_credit(uuid, uuid, integer, integer, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_referral_hold(uuid, uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.release_referral_hold(uuid) FROM anon, authenticated;

COMMIT;
