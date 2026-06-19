-- ════════════════════════════════════════════════════════════════════════
-- ADMIN AUDIT LOG (Master Plan §1.3 / §17 / Foundation F2)
-- ────────────────────────────────────────────────────────────────────────
-- Platform-scoped audit trail for every Super Admin mutation, capturing the
-- IP / device / browser context that the existing event-scoped activity_logs
-- table lacks. activity_logs is retained for organizer/event activity; this
-- table records admin actions across the whole platform.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role    TEXT,
    action        TEXT NOT NULL,            -- e.g. 'payment.refund'
    entity_type   TEXT,                     -- e.g. 'event_payment'
    entity_id     TEXT,                     -- text (not all entities are UUIDs)
    ip            TEXT,
    user_agent    TEXT,
    browser       TEXT,
    os            TEXT,
    "before"      JSONB,
    "after"       JSONB,
    metadata      JSONB DEFAULT '{}',
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_entity ON admin_audit_logs(entity_type, entity_id);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

COMMIT;
