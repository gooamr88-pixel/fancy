-- ════════════════════════════════════════════════════════════════════════
-- SESSIONS, DEVICES & SECURITY EVENTS (Master Plan §1.2 / Foundation F2)
-- ────────────────────────────────────────────────────────────────────────
-- Adds server-side session tracking so admin tooling can list and REVOKE
-- sessions (the JWT is otherwise stateless). The JWT now carries a `jti`
-- claim; requireAuth checks the matching sessions row is not revoked/expired.
--
-- Backward compatibility: tokens issued BEFORE this migration carry no `jti`.
-- The backend treats a missing jti as "legacy valid until natural 24h expiry"
-- so existing logins are not force-killed on deploy.
--
-- Also introduces organization lifecycle status (active/suspended/banned) for
-- User & Organizer management (§4 / §5).
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Sessions ───
CREATE TABLE IF NOT EXISTS sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    jti          TEXT UNIQUE NOT NULL,             -- matches JWT `jti` claim
    ip           TEXT,
    user_agent   TEXT,
    device_label TEXT,
    created_at   TIMESTAMPTZ DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    expires_at   TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_jti ON sessions(jti);

-- ─── Login history ───
CREATE TABLE IF NOT EXISTS login_history (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email          TEXT,
    ip             TEXT,
    user_agent     TEXT,
    success        BOOLEAN NOT NULL,
    failure_reason TEXT,
    created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_email ON login_history(email, created_at DESC);

-- ─── Devices ───
CREATE TABLE IF NOT EXISTS devices (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fingerprint TEXT NOT NULL,
    label       TEXT,
    trusted     BOOLEAN NOT NULL DEFAULT false,
    first_seen  TIMESTAMPTZ DEFAULT now(),
    last_seen   TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, fingerprint)
);

-- ─── Security events (anomalies / sensitive actions) ───
CREATE TABLE IF NOT EXISTS security_events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type       TEXT NOT NULL,                       -- e.g. 'impossible_travel','burst_login','impersonation'
    severity   TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
    ip         TEXT,
    metadata   JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);

-- ─── Organization lifecycle status (§4 / §5) ───
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'banned'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- ─── RLS: service-role-only ───
ALTER TABLE sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

COMMIT;
