-- ════════════════════════════════════════════════════════════════════════
-- CREDIT PACKAGES CATALOG (Master Plan §10 / §1.6 — scoped)
-- ────────────────────────────────────────────────────────────────────────
-- Admin-managed catalog of purchasable credit bundles (sms / email / qr),
-- including bonus credits and pricing. This is the catalog half of §10.
--
-- NOTE: full unification of the live per-event sms_credit_wallets into a generic
-- credit_wallets table is intentionally DEFERRED — the SMS purchase/consumption
-- RPCs (record_sms_purchase, increment_sms_credits) are the source of truth and
-- must not be disrupted mid-flight. Email/QR wallets land when their consumption
-- paths are built (later phases). Existing SMS grants already work via
-- POST /api/v1/admin/events/:eventId/grant-sms.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS credit_packages (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type           TEXT NOT NULL CHECK (type IN ('sms', 'email', 'qr')),
    name           TEXT NOT NULL,
    credits        INTEGER NOT NULL CHECK (credits > 0),
    bonus_credits  INTEGER NOT NULL DEFAULT 0 CHECK (bonus_credits >= 0),
    price_cents    INTEGER NOT NULL CHECK (price_cents >= 0),
    currency       TEXT NOT NULL DEFAULT 'usd',
    is_active      BOOLEAN NOT NULL DEFAULT true,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_packages_type ON credit_packages(type, is_active, sort_order);

ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_credit_packages_updated_at ON credit_packages;
CREATE TRIGGER set_credit_packages_updated_at BEFORE UPDATE ON credit_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
