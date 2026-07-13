-- ════════════════════════════════════════════════════════════════════════
-- REFERRAL / AFFILIATE PROGRAM — organizers earn platform credit when a
-- person they refer becomes a paying customer.
-- ────────────────────────────────────────────────────────────────────────
-- Every organization gets a stable, unique referral_code (shareable as
-- /register?ref=CODE). A new signup that arrives via that link is stamped
-- with referred_by_org_id at registration time (immutable afterwards — set
-- once, never edited, so it can't be gamed after the fact).
--
-- referral_credit_ledger is the single source of truth for a referrer's
-- credit balance (SUM(amount_cents) per org_id), mirroring the existing
-- sms_credit_ledger pattern already used elsewhere in this schema. The two
-- partial unique indexes are the fraud/race guards: a referred org can only
-- ever generate ONE 'earned' row (one reward per referred customer, no
-- matter how many events they later buy), and a specific payment can only
-- ever have its credit redemption recorded ONCE (safe against the same
-- webhook-vs-verify races every other payment path in this codebase already
-- has to handle).
--
-- Enforcement: the backend uses the service-role key (bypasses RLS), so the
-- new table has RLS ENABLED with NO policies — a hard deny for any anon/
-- authed client, mirroring every other backend-only table in this schema.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────
-- organizations: referral identity
-- ─────────────────────────────────────────────────────────

-- referred_by_org_id: ON DELETE SET NULL so deleting a referrer org never
-- blocks (or cascade-nukes) the orgs they referred — the attribution just
-- goes null, the referred accounts survive.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by_org_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_no_self_referral;
ALTER TABLE organizations
  ADD CONSTRAINT organizations_no_self_referral CHECK (referred_by_org_id IS NULL OR referred_by_org_id <> id);

-- Backfill a code for every existing org so the feature is live for current
-- accounts immediately, not just new signups going forward.
UPDATE organizations
SET referral_code = upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

ALTER TABLE organizations ALTER COLUMN referral_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_referral_code ON organizations(referral_code);
CREATE INDEX IF NOT EXISTS idx_organizations_referred_by ON organizations(referred_by_org_id) WHERE referred_by_org_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────
-- referral_credit_ledger
-- ─────────────────────────────────────────────────────────

-- All non-org FKs are ON DELETE SET NULL so the ledger (an audit trail) never
-- blocks deletion of a referred org, an event, or a payment — the reference
-- just goes null and the historical credit row survives. org_id CASCADEs: if
-- the credit-OWNER org is deleted, their whole balance goes with them.
CREATE TABLE IF NOT EXISTS referral_credit_ledger (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    amount_cents      integer NOT NULL,             -- signed: positive = earned/granted/restored, negative = redeemed/deducted/clawed-back
    type              text NOT NULL,
    referred_org_id   uuid REFERENCES organizations(id) ON DELETE SET NULL,  -- 'earned' rows: who converted to trigger this reward
    event_id          uuid REFERENCES events(id) ON DELETE SET NULL,
    payment_id        uuid REFERENCES event_payments(id) ON DELETE SET NULL, -- 'redeemed' rows: which payment consumed the credit
    note              text,
    created_by        uuid,                          -- admin_grant / admin_deduct: which admin
    created_at        timestamptz DEFAULT now(),
    CONSTRAINT referral_credit_ledger_type_check CHECK (type = ANY (ARRAY['earned', 'redeemed', 'admin_grant', 'admin_deduct', 'redeemed_reversal', 'earned_reversal']))
);

CREATE INDEX IF NOT EXISTS idx_referral_credit_ledger_org ON referral_credit_ledger(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_credit_ledger_earned_once ON referral_credit_ledger(referred_org_id) WHERE type = 'earned';
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_credit_ledger_redeemed_once ON referral_credit_ledger(payment_id) WHERE type = 'redeemed' AND payment_id IS NOT NULL;
-- Idempotency for the refund reversals: a payment's spent credit can be
-- restored at most once, and a referred org's reward can be clawed back at
-- most once — safe against the admin-refund + Stripe-webhook double-fire.
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_credit_ledger_restore_once ON referral_credit_ledger(payment_id) WHERE type = 'redeemed_reversal' AND payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_credit_ledger_clawback_once ON referral_credit_ledger(referred_org_id) WHERE type = 'earned_reversal';

ALTER TABLE referral_credit_ledger ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────
-- event_payments: snapshot how much referral credit was applied
-- ─────────────────────────────────────────────────────────

ALTER TABLE event_payments
  ADD COLUMN IF NOT EXISTS referral_credit_applied_cents integer NOT NULL DEFAULT 0;

-- Extend the allowed payment methods. 'referral_credit' is new (a $0 activation
-- fully funded by referral credit). 'free_tier' is ALSO included here: the
-- createCheckoutSession free-tier path has always inserted payment_method
-- 'free_tier', but no prior migration ever added it to this CHECK — so those
-- inserts were silently failing. Adding it here fixes that latent bug while we
-- own this constraint, rather than dropping a value that code depends on.
ALTER TABLE event_payments DROP CONSTRAINT IF EXISTS event_payments_payment_method_check;
ALTER TABLE event_payments ADD CONSTRAINT event_payments_payment_method_check
  CHECK (payment_method = ANY (ARRAY['stripe'::text, 'cash_manual'::text, 'referral_credit'::text, 'free_tier'::text]));

-- ─────────────────────────────────────────────────────────
-- super_admin_config: admin-configurable reward + on/off switch
-- ─────────────────────────────────────────────────────────

ALTER TABLE super_admin_config
  ADD COLUMN IF NOT EXISTS referral_program_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS referral_reward_cents integer NOT NULL DEFAULT 2500;

COMMIT;
