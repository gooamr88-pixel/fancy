-- ═══════════════════════════════════════════════════════════
-- FANCY RSVP - SMS LEDGER IDEMPOTENCY MIGRATION
-- ═══════════════════════════════════════════════════════════

-- Ensure a payment intent cannot be processed multiple times for purchase credits
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_credit_ledger_unique_purchase 
ON sms_credit_ledger(stripe_payment_intent_id) 
WHERE (transaction_type = 'purchase');
