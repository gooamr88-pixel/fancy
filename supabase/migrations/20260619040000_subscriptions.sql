-- ════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTIONS & PLANS (Master Plan §1.5 / §11)
-- ────────────────────────────────────────────────────────────────────────
-- Promotes the pricing tiers — previously a JSON array inside the single
-- super_admin_config row — into first-class, manageable plan records, and adds
-- per-organization subscriptions. The existing pricing_tiers JSON is left in
-- place (still read by the checkout flow) and is used here only to seed plans.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS plans (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key          TEXT UNIQUE NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT,
    price_cents  INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    "interval"   TEXT NOT NULL DEFAULT 'one_time' CHECK ("interval" IN ('one_time', 'monthly', 'yearly')),
    currency     TEXT NOT NULL DEFAULT 'usd',
    features     JSONB NOT NULL DEFAULT '[]',
    max_guests   INTEGER,
    max_events   INTEGER,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                 UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id                UUID REFERENCES plans(id) ON DELETE SET NULL,
    status                 TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
    current_period_start   TIMESTAMPTZ,
    current_period_end     TIMESTAMPTZ,
    stripe_subscription_id TEXT UNIQUE,
    cancel_at              TIMESTAMPTZ,
    created_at             TIMESTAMPTZ DEFAULT now(),
    updated_at             TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active, sort_order);

-- Seed plans from the existing super_admin_config.pricing_tiers JSON array.
INSERT INTO plans (key, name, price_cents, max_guests, sort_order, "interval")
SELECT
    lower(regexp_replace(tier->>'name', '[^a-zA-Z0-9]+', '_', 'g')) AS key,
    tier->>'name'                                                    AS name,
    COALESCE((tier->>'price_cents')::int, 0)                         AS price_cents,
    (tier->>'max_guests')::int                                       AS max_guests,
    ord                                                              AS sort_order,
    'one_time'
FROM super_admin_config sac,
     LATERAL jsonb_array_elements(sac.pricing_tiers) WITH ORDINALITY AS arr(tier, ord)
WHERE sac.id = '00000000-0000-0000-0000-000000000000'
ON CONFLICT (key) DO NOTHING;

ALTER TABLE plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- updated_at triggers (the function exists from the base schema).
DROP TRIGGER IF EXISTS set_plans_updated_at ON plans;
CREATE TRIGGER set_plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER set_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
