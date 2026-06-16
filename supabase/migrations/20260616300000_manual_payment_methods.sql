-- ════════════════════════════════════════════════════════════════════════
-- Manual / offline payment methods (Super Admin configurable) + verification
-- ────────────────────────────────────────────────────────────────────────
-- Adds an admin-managed catalogue of manual payment methods (bank transfer,
-- mobile wallet, InstaPay, cash, …) that is surfaced to the organizer when they
-- choose to pay the platform fee offline. Each event_payments row that is paid
-- manually now records which method the payer used and the proof reference they
-- supplied, so a Super Admin can verify "did the money actually arrive?" before
-- approving.
--
-- Shape of super_admin_config.manual_payment_methods (JSONB array):
--   [{ "id": "uuid-or-slug", "label": "Bank Transfer — CIB",
--      "type": "bank", "details": "Acct 1000-2000-3000 / IBAN EG...",
--      "instructions": "Use the reference code as the transfer note.",
--      "is_active": true }]

ALTER TABLE super_admin_config
  ADD COLUMN IF NOT EXISTS manual_payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Per-payment verification context for offline transfers.
ALTER TABLE event_payments
  ADD COLUMN IF NOT EXISTS manual_method   TEXT,  -- label of the method the payer used
  ADD COLUMN IF NOT EXISTS payer_reference TEXT,  -- sender txn id / wallet number / note
  ADD COLUMN IF NOT EXISTS verified_by     UUID,  -- super admin who confirmed receipt
  ADD COLUMN IF NOT EXISTS verified_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_note      TEXT;  -- internal note (e.g. rejection reason)

-- Seed a couple of sensible starter methods only if none configured yet, so the
-- organizer never lands on an empty manual-payment screen out of the box.
UPDATE super_admin_config
SET manual_payment_methods = '[
  {"id":"bank","label":"Bank Transfer","type":"bank","details":"Add your bank account / IBAN here","instructions":"Include the reference code shown below as the transfer note.","is_active":true},
  {"id":"wallet","label":"Mobile Wallet","type":"wallet","details":"Add your wallet number here","instructions":"Send the exact amount and keep the transaction SMS as proof.","is_active":true}
]'::jsonb
WHERE id = '00000000-0000-0000-0000-000000000000'
  AND (manual_payment_methods IS NULL OR manual_payment_methods = '[]'::jsonb);
