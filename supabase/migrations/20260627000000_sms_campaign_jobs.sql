-- ════════════════════════════════════════════════════════════════════════
-- Async SMS campaign jobs (scale-safe background delivery)
-- ────────────────────────────────────────────────────────────────────────
-- Large campaigns (1,000+ recipients) can't be blasted inside an HTTP request
-- without risking a timeout. These tables let the API *enqueue* a campaign and
-- return immediately, while a single-leader interval worker drains it in paced
-- slices with the same atomic, idempotent, per-segment credit billing as the
-- synchronous path.
--
-- Status lifecycle:  queued → processing → completed | partial | failed
--                    (draft is reserved for future "save without sending")
--
-- Idempotency: each recipient carries a stable idempotency_key
-- (sms:<token>:<rsvp_id>) that is UNIQUE here AND reused as the credit-ledger
-- key — so re-enqueue, worker retries, and crash recovery never double-charge
-- or double-send.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sms_campaigns (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    message_template  TEXT NOT NULL,
    audience          TEXT,                       -- e.g. 'pending+maybe' or 'custom'
    status            TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('draft', 'queued', 'processing', 'completed', 'partial', 'failed', 'cancelled')),
    total_recipients  INTEGER NOT NULL DEFAULT 0,
    sent_count        INTEGER NOT NULL DEFAULT 0,
    failed_count      INTEGER NOT NULL DEFAULT 0,
    skipped_count     INTEGER NOT NULL DEFAULT 0,
    credits_used      INTEGER NOT NULL DEFAULT 0,
    client_token      TEXT,
    last_error        TEXT,
    created_at        TIMESTAMPTZ DEFAULT now(),
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_event ON sms_campaigns(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_active ON sms_campaigns(created_at) WHERE status IN ('queued', 'processing');
-- Idempotent enqueue: a given client token maps to exactly one campaign.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_campaigns_token ON sms_campaigns(client_token) WHERE client_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS sms_campaign_recipients (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id       UUID NOT NULL REFERENCES sms_campaigns(id) ON DELETE CASCADE,
    event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    rsvp_id           UUID,                       -- snapshot; nullable if guest later deleted
    guest_name        TEXT,
    phone             TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'skipped')),
    segments          INTEGER NOT NULL DEFAULT 1, -- estimate at enqueue; exact count charged at send
    credits_charged   INTEGER NOT NULL DEFAULT 0,
    sms_sid           TEXT,
    ledger_id         UUID,
    idempotency_key   TEXT NOT NULL,
    error             TEXT,
    attempts          INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipients_campaign ON sms_campaign_recipients(campaign_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_campaign_recipients_idem ON sms_campaign_recipients(idempotency_key);

-- ── Atomic claim: pick the next active campaign without two workers fighting ──
CREATE OR REPLACE FUNCTION public.claim_next_sms_campaign()
RETURNS SETOF sms_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    UPDATE sms_campaigns c
    SET status     = 'processing',
        started_at = COALESCE(c.started_at, now()),
        updated_at = now()
    WHERE c.id = (
        SELECT id FROM sms_campaigns
        WHERE status IN ('queued', 'processing')
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING c.*;
END;
$$;

-- ── Atomic claim of a recipient slice (FOR UPDATE SKIP LOCKED = no double-grab) ──
CREATE OR REPLACE FUNCTION public.claim_sms_recipients(p_campaign_id UUID, p_limit INTEGER)
RETURNS SETOF sms_campaign_recipients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    UPDATE sms_campaign_recipients r
    SET status     = 'processing',
        attempts   = r.attempts + 1,
        updated_at = now()
    WHERE r.id IN (
        SELECT id FROM sms_campaign_recipients
        WHERE campaign_id = p_campaign_id AND status = 'queued'
        ORDER BY created_at
        LIMIT GREATEST(p_limit, 1)
        FOR UPDATE SKIP LOCKED
    )
    RETURNING r.*;
END;
$$;

-- ── Crash recovery: return recipients stuck 'processing' to 'queued' for retry ──
CREATE OR REPLACE FUNCTION public.requeue_stale_sms_recipients(p_campaign_id UUID, p_stale_seconds INTEGER DEFAULT 300)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE sms_campaign_recipients
    SET status = 'queued', updated_at = now()
    WHERE campaign_id = p_campaign_id
      AND status = 'processing'
      AND updated_at < now() - make_interval(secs => GREATEST(p_stale_seconds, 30));
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ── One-round-trip progress aggregate (counts + exact credits) for the worker/UI ──
CREATE OR REPLACE FUNCTION public.sms_campaign_progress(p_campaign_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'sent',       COUNT(*) FILTER (WHERE status = 'sent'),
        'failed',     COUNT(*) FILTER (WHERE status = 'failed'),
        'skipped',    COUNT(*) FILTER (WHERE status = 'skipped'),
        'queued',     COUNT(*) FILTER (WHERE status = 'queued'),
        'processing', COUNT(*) FILTER (WHERE status = 'processing'),
        'total',      COUNT(*),
        'credits',    COALESCE(SUM(credits_charged) FILTER (WHERE status = 'sent'), 0)
    )
    FROM sms_campaign_recipients
    WHERE campaign_id = p_campaign_id;
$$;

REVOKE ALL ON FUNCTION public.claim_next_sms_campaign() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_sms_recipients(UUID, INTEGER) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.requeue_stale_sms_recipients(UUID, INTEGER) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.sms_campaign_progress(UUID) FROM anon, authenticated;
