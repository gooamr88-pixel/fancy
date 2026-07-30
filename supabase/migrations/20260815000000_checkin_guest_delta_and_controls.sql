-- ════════════════════════════════════════════════════════════════════════
-- CHECK-IN v2 — guest-data deltas (spec §19) + emergency controls (§21.5)
-- ────────────────────────────────────────────────────────────────────────
-- Completes the bundle_version work that 20260814000000 deliberately left
-- unfinished. That migration's header explains why: §19.2 wants a counter
-- bumped on ANY guest-data mutation, and the obvious implementation — a
-- trigger that does `UPDATE events SET bundle_version = bundle_version + 1`
-- — takes a row lock on the event for every concurrent RSVP. This schema
-- already carries 20260709000000_submit_rsvp_concurrency_fix.sql, whose whole
-- purpose was an advisory lock around RSVP submission, so adding fresh
-- contention on the same path would be undoing paid-for work.
--
-- ── The design: an append-only change log, not a counter ──
--
-- event_guest_changes has a bigserial. INSERTs from a trigger take no row
-- lock that another transaction wants, so concurrent RSVPs do not serialise
-- on each other. bundle_version for an event is simply the highest seq
-- belonging to it.
--
-- The sequence is GLOBAL, so per-event versions have gaps. That is fine and
-- deliberate: §19.2 requires monotonic, not contiguous. (Contrast server_seq
-- on check_ins, which MUST be contiguous because §17.4 gap detection reads a
-- hole as a dropped realtime message. Different requirement, different
-- mechanism — the two are easy to conflate and must not be.)
--
-- ── Why the delta returns CURRENT STATE, not a mutation replay ──
--
-- The log records WHICH guests changed. checkin_guest_delta then returns
-- those guests as they are NOW. Replaying a mutation log would require the
-- device to apply changes in order and would break irrecoverably on a single
-- missed entry; "here are the keys that changed, here is their current
-- state" is idempotent, collapses repeated edits to one row automatically,
-- and is safe to re-run. §19.4's `requires_full_resync` covers the cases this
-- cannot serve.
--
-- ── What is NOT here ──
--
-- §19.5's `qr_revoked` op. QR tokens on this platform are minted on demand
-- and never persisted as revocable records (see the Phase 0 report §3.2), so
-- there is no regeneration event to observe. Inventing one would mean
-- fabricating backend behaviour, which the spec's ground rule 2 forbids.
-- Recorded as a gap rather than faked.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. The change log
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.event_guest_changes (
    seq        bigserial PRIMARY KEY,
    event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    -- guest_id  set => exactly that guest changed
    -- party_id  set => every guest in that party is affected
    -- both null => event-wide (event details edited)
    guest_id   uuid,
    party_id   uuid,
    op         text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT event_guest_changes_op_check CHECK (op IN (
      'guest_upsert', 'guest_remove', 'party_update', 'seating_change', 'event_update'
    ))
);

-- The only read pattern: "everything for this event above this seq".
CREATE INDEX IF NOT EXISTS idx_event_guest_changes_event_seq
  ON public.event_guest_changes (event_id, seq);
-- Supports retention pruning without scanning the whole table.
CREATE INDEX IF NOT EXISTS idx_event_guest_changes_created
  ON public.event_guest_changes (created_at);

ALTER TABLE public.event_guest_changes ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Emergency controls (§21.5)
-- ═══════════════════════════════════════════════════════════════════
-- Per-event flags, fetched by devices on every sync response and CACHED
-- locally — so a device that goes offline retains the last instruction rather
-- than reverting to a default.
--
-- Hard limit on what these can do: they stop NETWORK activity only. Scanning,
-- local duplicate detection, and queueing continue unconditionally. A device
-- with sync disabled behaves exactly as it does offline, which the entire
-- architecture is already built around. Nothing here can stop a door.
ALTER TABLE public.event_checkin_cursors
  ADD COLUMN IF NOT EXISTS sync_disabled      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS realtime_disabled  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS polling_only       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS controls_set_by    uuid,
  ADD COLUMN IF NOT EXISTS controls_set_at    timestamptz,
  ADD COLUMN IF NOT EXISTS controls_note      text;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Trigger plumbing
-- ═══════════════════════════════════════════════════════════════════

-- ── guests: the row-level source of truth ──
CREATE OR REPLACE FUNCTION public.log_guest_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.event_guest_changes (event_id, guest_id, party_id, op)
    VALUES (OLD.event_id, OLD.id, OLD.party_id, 'guest_remove');
    RETURN OLD;
  END IF;

  -- UPDATE: only log when something a device actually renders changed.
  -- Without this filter, unrelated writes (updated_at touches, phone edits)
  -- would churn the log and push devices toward needless full resyncs.
  IF TG_OP = 'UPDATE' AND NEW.full_name IS NOT DISTINCT FROM OLD.full_name
     AND NEW.category        IS NOT DISTINCT FROM OLD.category
     AND NEW.meal_selection  IS NOT DISTINCT FROM OLD.meal_selection
     AND NEW.dietary_notes   IS NOT DISTINCT FROM OLD.dietary_notes
     AND NEW.party_id        IS NOT DISTINCT FROM OLD.party_id
     AND NEW.is_primary_contact IS NOT DISTINCT FROM OLD.is_primary_contact THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.event_guest_changes (event_id, guest_id, party_id, op)
  VALUES (NEW.event_id, NEW.id, NEW.party_id, 'guest_upsert');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guests_change_log ON public.guests;
CREATE TRIGGER trg_guests_change_log
  AFTER INSERT OR UPDATE OR DELETE ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.log_guest_change();

-- ── rsvp_parties: party-scoped fields a device renders ──
CREATE OR REPLACE FUNCTION public.log_party_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.label IS NOT DISTINCT FROM OLD.label
     AND NEW.response IS NOT DISTINCT FROM OLD.response
     AND NEW.notes    IS NOT DISTINCT FROM OLD.notes
     AND NEW.side     IS NOT DISTINCT FROM OLD.side THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.event_guest_changes (event_id, party_id, op)
  VALUES (NEW.event_id, NEW.id, 'party_update');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rsvp_parties_change_log ON public.rsvp_parties;
CREATE TRIGGER trg_rsvp_parties_change_log
  AFTER UPDATE ON public.rsvp_parties
  FOR EACH ROW EXECUTE FUNCTION public.log_party_change();

-- ── seating_assignments: §19.3 classifies a table change as CRITICAL ──
-- A guest already checked in was verbally directed to the wrong table, so this
-- must reach the device promptly rather than wait for a full refresh.
CREATE OR REPLACE FUNCTION public.log_seating_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event uuid;
  v_party uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_event := OLD.event_id; v_party := OLD.party_id;
  ELSE
    v_event := NEW.event_id; v_party := NEW.party_id;
  END IF;

  INSERT INTO public.event_guest_changes (event_id, party_id, op)
  VALUES (v_event, v_party, 'seating_change');

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seating_change_log ON public.seating_assignments;
CREATE TRIGGER trg_seating_change_log
  AFTER INSERT OR UPDATE OR DELETE ON public.seating_assignments
  FOR EACH ROW EXECUTE FUNCTION public.log_seating_change();

-- ── events: §19.3 "Event details changed → additive, applied silently" ──
CREATE OR REPLACE FUNCTION public.log_event_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.title IS NOT DISTINCT FROM OLD.title
     AND NEW.event_date      IS NOT DISTINCT FROM OLD.event_date
     AND NEW.location_name   IS NOT DISTINCT FROM OLD.location_name
     AND NEW.location_address IS NOT DISTINCT FROM OLD.location_address
     AND NEW.custom_colors   IS NOT DISTINCT FROM OLD.custom_colors
     AND NEW.no_kids_allowed IS NOT DISTINCT FROM OLD.no_kids_allowed THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.event_guest_changes (event_id, op)
  VALUES (NEW.id, 'event_update');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_change_log ON public.events;
CREATE TRIGGER trg_events_change_log
  AFTER UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.log_event_change();

-- ═══════════════════════════════════════════════════════════════════
-- 4. checkin_guest_delta — §19.4
-- ═══════════════════════════════════════════════════════════════════
-- Returns the CURRENT state of every guest touched since p_since, plus the ids
-- of guests that no longer exist, plus to_version.
--
-- requires_full_resync is set when:
--   • the requested version predates the retained log (it cannot be
--     reconstructed), or
--   • the change volume exceeds p_limit, at which point a full re-download is
--     cheaper than a delta — §19.4 explicitly permits this.
-- The device must then perform a full bundle download, NOT attempt to
-- reconcile. Delta application on the device is transactional: a partially
-- applied delta rolls back entirely, because a half-updated guest list is
-- worse than a stale one.
CREATE OR REPLACE FUNCTION public.checkin_guest_delta(
  p_event_id uuid,
  p_since    bigint DEFAULT 0,
  p_limit    integer DEFAULT 500
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_version   bigint;
  v_min_retained bigint;
  v_event_wide   boolean;
  v_affected     uuid[];
  v_changed_cnt  integer;
  v_upserts      jsonb;
  v_removes      jsonb;
  v_limit        integer := greatest(least(coalesce(p_limit, 500), 2000), 1);
  v_since        bigint  := greatest(coalesce(p_since, 0), 0);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EVENT_NOT_FOUND');
  END IF;

  SELECT coalesce(max(seq), 0) INTO v_to_version
    FROM public.event_guest_changes WHERE event_id = p_event_id;

  -- Nothing new. Cheap empty payload, never a guest list (§17.5).
  IF v_to_version <= v_since THEN
    RETURN jsonb_build_object(
      'ok', true, 'from_version', v_since, 'to_version', v_to_version,
      'requires_full_resync', false,
      'upserts', '[]'::jsonb, 'removed_guest_ids', '[]'::jsonb
    );
  END IF;

  SELECT min(seq) INTO v_min_retained
    FROM public.event_guest_changes WHERE event_id = p_event_id;

  -- The caller is asking from before the retained window: unreconstructable.
  IF v_since > 0 AND v_min_retained IS NOT NULL AND v_since < v_min_retained - 1 THEN
    RETURN jsonb_build_object(
      'ok', true, 'from_version', v_since, 'to_version', v_to_version,
      'requires_full_resync', true, 'reason', 'VERSION_TOO_OLD',
      'upserts', '[]'::jsonb, 'removed_guest_ids', '[]'::jsonb
    );
  END IF;

  -- A since of 0 means "I have nothing" — that is a full download, not a delta.
  IF v_since = 0 THEN
    RETURN jsonb_build_object(
      'ok', true, 'from_version', 0, 'to_version', v_to_version,
      'requires_full_resync', true, 'reason', 'NO_BASELINE',
      'upserts', '[]'::jsonb, 'removed_guest_ids', '[]'::jsonb
    );
  END IF;

  SELECT bool_or(guest_id IS NULL AND party_id IS NULL)
    INTO v_event_wide
    FROM public.event_guest_changes
   WHERE event_id = p_event_id AND seq > v_since;

  -- Event-wide edits affect every guest's rendering, so resolve to all of them.
  IF coalesce(v_event_wide, false) THEN
    SELECT array_agg(id) INTO v_affected FROM public.guests WHERE event_id = p_event_id;
  ELSE
    SELECT array_agg(DISTINCT gid) INTO v_affected
      FROM (
        SELECT c.guest_id AS gid
          FROM public.event_guest_changes c
         WHERE c.event_id = p_event_id AND c.seq > v_since AND c.guest_id IS NOT NULL
        UNION
        -- Party-scoped changes fan out to that party's current members.
        SELECT g.id
          FROM public.event_guest_changes c
          JOIN public.guests g ON g.party_id = c.party_id
         WHERE c.event_id = p_event_id AND c.seq > v_since AND c.party_id IS NOT NULL
      ) s;
  END IF;

  v_changed_cnt := coalesce(array_length(v_affected, 1), 0);

  -- Past this point a full re-download moves less data than the delta would.
  IF v_changed_cnt > v_limit THEN
    RETURN jsonb_build_object(
      'ok', true, 'from_version', v_since, 'to_version', v_to_version,
      'requires_full_resync', true, 'reason', 'CHANGE_VOLUME',
      'changed_count', v_changed_cnt,
      'upserts', '[]'::jsonb, 'removed_guest_ids', '[]'::jsonb
    );
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id,
           'partyId', g.party_id,
           'partyLabel', p.label,
           'fullName', g.full_name,
           'isPrimaryContact', g.is_primary_contact,
           'category', g.category,
           'response', p.response,
           'tableId', CASE WHEN t.element_type = 'table' THEN t.id END,
           'tableName', CASE WHEN t.element_type = 'table' THEN t.table_name END,
           'mealSelection', g.meal_selection,
           'dietaryNotes', g.dietary_notes,
           'partyNotes', p.notes,
           'side', p.side,
           -- §19.5: a guest deleted AFTER checking in is retained, because the
           -- person is physically inside the venue. This flag lets the device
           -- and the report mark them as an anomaly instead of erasing them.
           'checkedIn', (ci.id IS NOT NULL)
         )), '[]'::jsonb)
    INTO v_upserts
    FROM public.guests g
    JOIN public.rsvp_parties p ON p.id = g.party_id
    LEFT JOIN public.seating_assignments sa ON sa.party_id = g.party_id AND sa.event_id = g.event_id
    LEFT JOIN public.tables t ON t.id = sa.table_id
    LEFT JOIN public.check_ins ci ON ci.guest_id = g.id AND ci.deleted_at IS NULL
   WHERE g.event_id = p_event_id
     AND g.id = ANY(v_affected);

  -- Ids that were touched but no longer resolve = removed.
  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_removes
    FROM (
      SELECT unnest(v_affected) AS x
      EXCEPT
      SELECT id FROM public.guests WHERE event_id = p_event_id
    ) d;

  RETURN jsonb_build_object(
    'ok', true,
    'from_version', v_since,
    'to_version', v_to_version,
    'requires_full_resync', false,
    'changed_count', v_changed_cnt,
    'upserts', v_upserts,
    'removed_guest_ids', v_removes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.checkin_guest_delta(uuid, bigint, integer) FROM anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 5. Retention pruning
-- ═══════════════════════════════════════════════════════════════════
-- The change log is not kept indefinitely; §19.4 assumes it can age out and
-- handles that with requires_full_resync. Deliberately NOT time-triggered
-- inside the DB — the caller decides when, so pruning never runs during an
-- event. Keeps a floor of recent entries per event so a device that synced
-- minutes ago is never forced into a full resync by a prune.
CREATE OR REPLACE FUNCTION public.prune_event_guest_changes(
  p_older_than interval DEFAULT '30 days',
  p_keep_per_event integer DEFAULT 1000
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH ranked AS (
    SELECT seq, row_number() OVER (PARTITION BY event_id ORDER BY seq DESC) AS rn, created_at
      FROM public.event_guest_changes
  )
  DELETE FROM public.event_guest_changes c
   USING ranked r
   WHERE c.seq = r.seq
     AND r.rn > p_keep_per_event
     AND r.created_at < now() - p_older_than;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_event_guest_changes(interval, integer) FROM anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 6. Backfill a baseline so existing events have a version
-- ═══════════════════════════════════════════════════════════════════
-- Without this, an event whose guest list predates this migration reports
-- to_version = 0 forever and every delta call answers NO_BASELINE.
INSERT INTO public.event_guest_changes (event_id, op)
SELECT DISTINCT g.event_id, 'event_update'
  FROM public.guests g
 WHERE NOT EXISTS (
   SELECT 1 FROM public.event_guest_changes c WHERE c.event_id = g.event_id
 );

COMMIT;
