-- ════════════════════════════════════════════════════════════════════════
-- PAYMENT REFUNDS & DISPUTES (Master Plan §1.13 / §9 / fixes B1)
-- ────────────────────────────────────────────────────────────────────────
-- Before this, the admin "Refund" action only flipped event_payments.status to
-- 'refunded' — it NEVER returned money via Stripe (B1). We add the columns to
-- record a real Stripe refund and a table to track chargebacks/disputes.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE event_payments ADD COLUMN IF NOT EXISTS stripe_refund_id    TEXT;
ALTER TABLE event_payments ADD COLUMN IF NOT EXISTS refund_amount_cents INTEGER;
ALTER TABLE event_payments ADD COLUMN IF NOT EXISTS refunded_at         TIMESTAMPTZ;
ALTER TABLE event_payments ADD COLUMN IF NOT EXISTS refunded_by         UUID;
ALTER TABLE event_payments ADD COLUMN IF NOT EXISTS refund_reason       TEXT;

CREATE TABLE IF NOT EXISTS payment_disputes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id        UUID REFERENCES event_payments(id) ON DELETE SET NULL,
    stripe_dispute_id TEXT UNIQUE,
    stripe_charge_id  TEXT,
    status            TEXT,                 -- Stripe dispute status (needs_response, won, lost, …)
    amount_cents      INTEGER,
    currency          TEXT DEFAULT 'usd',
    reason            TEXT,
    evidence_due_at   TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_disputes_payment ON payment_disputes(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_created ON payment_disputes(created_at DESC);

ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;

COMMIT;
