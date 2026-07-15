-- ════════════════════════════════════════════════════════════════════════
-- PROMO CODES — super-admin-issued codes that publish an organizer's event
-- immediately, free, with no payment and no manual admin review.
-- ────────────────────────────────────────────────────────────────────────
-- Normal flow: draft → (Stripe payment) → pending_review → (admin approves
-- via PATCH /admin/events/:id) → active. A promo code is a self-service
-- shortcut straight to the end state: an organizer who has a valid code
-- redeems it and their event becomes is_paid=true, status='active' in one
-- step — comped, exactly like a super-admin manually granting a tier via
-- updateEventAdmin (manual_override=true + comp_reason), just organizer-
-- triggered instead of admin-triggered.
--
-- promo_codes        — the code catalog, fully managed from the admin
--                       dashboard (create/edit/deactivate/delete), with an
--                       optional usage cap and expiry.
-- promo_code_redemptions — an append-only audit ledger of who used what,
--                       when, and for which event. Also the source of truth
--                       for "has this event already redeemed a code" (one
--                       row per event, enforced by a UNIQUE constraint) —
--                       the same append-only-ledger pattern already used by
--                       referral_credit_ledger elsewhere in this schema.
--
-- Redemption itself is an ATOMIC RPC (redeem_promo_code), mirroring
-- reserve_referral_credit's advisory-lock + row-lock pattern: without it,
-- two concurrent redemptions of the same near-exhausted code could both
-- read "1 slot left" and both succeed, overrunning max_redemptions.
--
-- RLS: enabled, no policies — service-role-only, like every other backend
-- table in this schema.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS promo_codes (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code              text NOT NULL UNIQUE,
    description       text,
    -- Which pricing tier (super_admin_config.pricing_tiers[].name) this code
    -- grants — there's no real payment to derive it from, so the admin picks
    -- one explicitly when creating the code, same as updateEventAdmin's
    -- isPaid+tierName comp path.
    tier_name         text NOT NULL,
    max_redemptions   integer CHECK (max_redemptions IS NULL OR max_redemptions > 0), -- NULL = unlimited
    redemption_count  integer NOT NULL DEFAULT 0,
    expires_at        timestamptz, -- NULL = never expires
    is_active         boolean NOT NULL DEFAULT true,
    created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS promo_code_redemptions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id   uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
    event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    redeemed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    tier_name       text NOT NULL, -- snapshot at redemption time, independent of later code edits
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (event_id) -- an event can only ever redeem one promo code, once
);

CREATE INDEX IF NOT EXISTS idx_promo_code_redemptions_code ON promo_code_redemptions(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_redemptions_org ON promo_code_redemptions(org_id);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_redemptions ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────
-- redeem_promo_code — validates + records the redemption atomically.
-- Deliberately does NOT touch the `events` row itself (status/is_paid/
-- tier snapshot) — that update stays in the Node controller, right next to
-- where updateEventAdmin already does the equivalent comp update, so the
-- "what does granting a tier actually set on the event" logic lives in one
-- place. This function's only job is: is the code valid & has capacity,
-- and record the redemption before the caller is allowed to proceed.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_promo_code(
  p_code      text,
  p_event_id  uuid,
  p_org_id    uuid,
  p_actor     uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_row promo_codes%ROWTYPE;
  v_norm_code text := upper(trim(coalesce(p_code, '')));
BEGIN
  IF v_norm_code = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CODE');
  END IF;

  -- Serialize redemptions of the SAME code so two concurrent redeems can't
  -- both squeeze past a near-exhausted max_redemptions cap.
  PERFORM pg_advisory_xact_lock(hashtext('promo_code:' || v_norm_code));

  SELECT * INTO v_code_row FROM promo_codes WHERE code = v_norm_code FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CODE');
  END IF;

  IF NOT v_code_row.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CODE_INACTIVE');
  END IF;

  IF v_code_row.expires_at IS NOT NULL AND v_code_row.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CODE_EXPIRED');
  END IF;

  IF v_code_row.max_redemptions IS NOT NULL AND v_code_row.redemption_count >= v_code_row.max_redemptions THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CODE_LIMIT_REACHED');
  END IF;

  IF EXISTS (SELECT 1 FROM promo_code_redemptions WHERE event_id = p_event_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EVENT_ALREADY_REDEEMED');
  END IF;

  INSERT INTO promo_code_redemptions (promo_code_id, event_id, org_id, redeemed_by, tier_name)
  VALUES (v_code_row.id, p_event_id, p_org_id, p_actor, v_code_row.tier_name);

  UPDATE promo_codes SET redemption_count = redemption_count + 1, updated_at = now()
  WHERE id = v_code_row.id;

  RETURN jsonb_build_object('ok', true, 'promo_code_id', v_code_row.id, 'tier_name', v_code_row.tier_name);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'EVENT_ALREADY_REDEEMED');
END;
$$;

-- Server-role only (called by the backend with the service key).
REVOKE ALL ON FUNCTION public.redeem_promo_code(text, uuid, uuid, uuid) FROM anon, authenticated;

COMMIT;
