-- ════════════════════════════════════════════════════════════════════════
-- CHECK-IN v2 — offline-first foundation (Phase 1 of the Android door app)
-- ────────────────────────────────────────────────────────────────────────
-- Spec: FANCY_RSVP_CHECKIN_SPEC.md v1.0 as amended by
--       docs/Checkin-Spec-Amendments.md (the amendment record WINS on any
--       disagreement — see A-7 for why this migration extends check_ins
--       instead of creating the spec's proposed `event_check_ins` table).
--
-- The existing check_ins table already satisfies spec §5.3 Layer 3
-- (server-side uniqueness) and is read by the organizer dashboard,
-- getEventStats, and BOTH export paths. A parallel table would fork all of
-- them, and the spec's own ground rule 2 forbids it. So: additive columns.
--
-- What an offline device needs that the current table cannot express:
--   • an idempotency key, so replaying a queue never double-inserts
--   • device + staff attribution, DENORMALISED (§18.6) so the audit stays
--     readable after a roster edit
--   • a per-event monotonic sequence, so a device can detect a MISSED
--     realtime message rather than trusting a partial stream (§17.4)
--   • soft delete, so an undo is auditable instead of destroying evidence
--   • the server's own receipt time next to the device's clock (§10)
--
-- ── Two deliberate departures from the spec, both tightening it ──
--
-- 1. UNIQUE (event_id, guest_id) becomes a PARTIAL unique index scoped to
--    `deleted_at IS NULL`. The plain constraint would make an undone
--    check-in permanently block that guest from ever checking in again,
--    which turns a supervisor's correction into a locked door. The
--    invariant Layer 3 actually needs is "at most one LIVE check-in per
--    guest per event", which is exactly what the partial index enforces.
--
-- 2. The scanned QR token is stored as a SHA-256 fingerprint, never raw.
--    Amendment A-11 asked for the raw token so the server could verify it;
--    the fingerprint supports the same audit question ("was this same
--    ticket presented at two doors?") without parking a live bearer
--    credential in the database. Verification itself happens in Node,
--    which is where QR_JWT_SECRET lives — plpgsql has no business holding
--    it. The RPC just records the verdict.
--
-- ── Deliberately NOT in this migration ──
--
-- bundle_version is created here but nothing increments it yet. Spec §19.2
-- wants it bumped on ANY guest-data mutation, which means a counter bump on
-- every guest INSERT. Done naively via a trigger on `events`, that takes a
-- row lock on the event for every concurrent RSVP — and this schema already
-- carries a migration named submit_rsvp_concurrency_fix, so contention on
-- that path is a known, previously-painful problem. The counter therefore
-- lives on its own low-traffic row (event_checkin_cursors) and the bumping
-- mechanism is a Phase 4 decision with a real trade-off to make, not a
-- trigger smuggled in here. Phase 1 ships the field and reports it.
--
-- RLS: enabled, no policies — service-role-only, matching every other
-- backend table in this schema. Note that RLS is inert on this platform
-- regardless (see amendment A-9: policies key off auth.uid(), which this
-- app never populates), so the Express API is the only real gate.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. guests.category — the VIP concept (decision D-4)
-- ═══════════════════════════════════════════════════════════════════
-- Not a closed enum: spec §6.1 lists `custom` alongside standard/vip/family,
-- so organizers need free text. 'vip' is the RESERVED value that triggers the
-- premium welcome treatment (§8.4, §9.4); everything else renders standard.
-- Lowercased by convention so the app can compare without collation surprises.
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'standard';

ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_category_check;
ALTER TABLE public.guests ADD CONSTRAINT guests_category_check
  CHECK (length(category) BETWEEN 1 AND 40 AND category = lower(category));

-- Drives the §8.7 "VIP" filter and the §9.7 per-category report breakdown.
CREATE INDEX IF NOT EXISTS idx_guests_event_category ON public.guests(event_id, category);

-- ═══════════════════════════════════════════════════════════════════
-- 2. check_ins — additive columns
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.check_ins
  -- The idempotency key (§5.4). Device-generated at the moment of the scan.
  -- Nullable: every pre-existing row (web kiosk, self-service) has none.
  ADD COLUMN IF NOT EXISTS client_checkin_id     uuid,
  -- Attribution (§18.6). staff_id/device_id are the live ids; the two
  -- *_display_name/label columns are denormalised snapshots so a later roster
  -- edit or device relabel cannot rewrite history.
  ADD COLUMN IF NOT EXISTS staff_id              uuid,
  ADD COLUMN IF NOT EXISTS staff_display_name    text,
  ADD COLUMN IF NOT EXISTS device_id             uuid,
  -- The gate this arrival was recorded at (amendment A-17).
  --
  -- Both an id AND a name are kept, and that is not redundancy. `device_label` is
  -- the immutable snapshot §18.6 requires — it is what the audit trail and the
  -- post-event report read, and moving a device to another gate must never
  -- change it. `gate_table_id` exists so the seating map can answer "were any
  -- guests admitted here?" before allowing an entrance to be deleted, which a
  -- name alone cannot do reliably once names can be reused.
  --
  -- SET NULL rather than CASCADE: losing the gate must never delete an arrival.
  ADD COLUMN IF NOT EXISTS gate_table_id         uuid
    REFERENCES public.tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS device_label          text,
  -- Per-event monotonic sequence (§17.4). Gap detection depends on this.
  ADD COLUMN IF NOT EXISTS server_seq            bigint,
  -- A SECOND sequence position, allocated when this check-in is undone.
  -- Deliberately not a mutation of server_seq: moving a row's sequence
  -- number would leave a permanent hole where it used to sit, and §17.4's
  -- gap detection reads a hole as a dropped message — so a device would
  -- re-fetch the same delta forever. Every allocated number belongs to
  -- exactly one row, as either its server_seq or its undo_seq, which keeps
  -- the sequence space contiguous and gap detection honest.
  ADD COLUMN IF NOT EXISTS undo_seq              bigint,
  -- §10 "Device clock is wrong": keep BOTH times and let the report show the
  -- divergence. checked_in_at is the device's claim; this is ours.
  ADD COLUMN IF NOT EXISTS server_received_at    timestamptz,
  -- Soft delete (§7, §9.6). Replaces the current hard DELETE, which erased
  -- arrival evidence with no audit row at all (discovery finding R-1).
  ADD COLUMN IF NOT EXISTS deleted_at            timestamptz,
  -- Two actor columns because there are two kinds of actor, in different id
  -- namespaces. deleted_by is a platform user (the organizer, undoing from the
  -- dashboard); undone_by_staff_id is an event_staff row (a supervisor, undoing
  -- at the door). Collapsing them into one uuid would make the audit trail
  -- ambiguous about which table to resolve the id against. Exactly one is set.
  -- No FK on either: staff are deactivated, never deleted, and an audit trail
  -- that can be broken by a roster edit is not an audit trail.
  ADD COLUMN IF NOT EXISTS deleted_by            uuid,
  ADD COLUMN IF NOT EXISTS undone_by_staff_id    uuid,
  ADD COLUMN IF NOT EXISTS undone_by_staff_name  text,
  ADD COLUMN IF NOT EXISTS undo_reason           text,
  -- A-11 as tightened above: fingerprint, not the token itself.
  ADD COLUMN IF NOT EXISTS scan_token_fingerprint text,
  -- NULL = not a scan, or not evaluated. false = the presented token failed
  -- verification and this arrival is an ANOMALY on the post-event report —
  -- never a rejection, per §5.3 "the door is never blocked by uncertainty".
  ADD COLUMN IF NOT EXISTS token_verified        boolean;

-- ── method: widen the closed CHECK ──
-- 'group' (§9.1 party check-in) and 'override' (§9.5 supervisor admission of
-- an already-arrived guest) were both rejected at the DB before this.
-- Existing values are preserved verbatim: the spec calls the scan method
-- `scan`, the DB has always called it `qr_scan`, and the DB wins — remapping
-- would rewrite historical rows and both export paths for no gain.
ALTER TABLE public.check_ins DROP CONSTRAINT IF EXISTS check_ins_method_check;
ALTER TABLE public.check_ins ADD CONSTRAINT check_ins_method_check
  CHECK (method IS NULL OR method IN (
    'qr_scan', 'manual_search', 'self_service', 'group', 'override'
  ));

-- ── Idempotency: one row per client_checkin_id, forever ──
-- Full (not deleted_at-scoped) on purpose. Replaying a queue entry whose
-- check-in was subsequently UNDONE must return `duplicate` and leave it
-- undone — the supervisor's correction outranks a stale queue.
CREATE UNIQUE INDEX IF NOT EXISTS uq_check_ins_client_checkin_id
  ON public.check_ins (client_checkin_id)
  WHERE client_checkin_id IS NOT NULL;

-- ── Layer 3, rescoped to live rows (departure 1 above) ──
ALTER TABLE public.check_ins DROP CONSTRAINT IF EXISTS check_ins_event_id_guest_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_check_ins_event_guest_live
  ON public.check_ins (event_id, guest_id)
  WHERE deleted_at IS NULL;

-- Delta catch-up (§17.5) reads by (event, seq). Two indexes because a delta
-- is `server_seq > since OR undo_seq > since` — one index per branch, so
-- neither degenerates into a scan on a 2000-guest event.
CREATE INDEX IF NOT EXISTS idx_check_ins_event_seq
  ON public.check_ins (event_id, server_seq)
  WHERE server_seq IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_check_ins_event_undo_seq
  ON public.check_ins (event_id, undo_seq)
  WHERE undo_seq IS NOT NULL;

-- Supports the A-17 deletion guard: "were any guests admitted at this gate?"
CREATE INDEX IF NOT EXISTS idx_check_ins_gate
  ON public.check_ins (gate_table_id)
  WHERE gate_table_id IS NOT NULL;

-- Every existing row predates sequencing, and those arrivals must be reachable:
-- a guest checked in by the web kiosk before the app was armed is physically
-- inside the venue, and a device that cannot see them will admit them twice.
--
-- They are therefore given REAL sequence numbers starting at 1, per event, and
-- the cursor is seeded past them. Assigning 0 would not work: the delta query is
-- `server_seq > since` with `since` clamped to >= 0, so a seq of 0 is invisible
-- to every possible delta request — the rows would exist and never be delivered.
WITH numbered AS (
  SELECT id,
         event_id,
         row_number() OVER (PARTITION BY event_id ORDER BY checked_in_at, id) AS rn
    FROM public.check_ins
   WHERE server_seq IS NULL
)
UPDATE public.check_ins c
   SET server_seq = n.rn
  FROM numbered n
 WHERE c.id = n.id;

-- The cursor is seeded past these rows in section 3, once the cursor table
-- exists. It cannot be done here — event_checkin_cursors is created below.

-- ═══════════════════════════════════════════════════════════════════
-- 3. event_checkin_cursors — the per-event sequence + bundle counters
-- ═══════════════════════════════════════════════════════════════════
-- A dedicated low-traffic row per event. Kept OFF the `events` table so
-- allocating a sequence number never takes a lock that RSVP submission,
-- seating, or payment fulfillment also want.
CREATE TABLE IF NOT EXISTS public.event_checkin_cursors (
    event_id       uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    -- Highest server_seq handed out for this event. Monotonic, never reused.
    last_seq       bigint NOT NULL DEFAULT 0,
    -- §19.2. Created now, incremented from Phase 4 (see header note).
    bundle_version bigint NOT NULL DEFAULT 1,
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT event_checkin_cursors_last_seq_check CHECK (last_seq >= 0),
    CONSTRAINT event_checkin_cursors_bundle_version_check CHECK (bundle_version >= 1)
);

ALTER TABLE public.event_checkin_cursors ENABLE ROW LEVEL SECURITY;

-- Seed each event's cursor past the sequence numbers backfilled in section 2, so
-- the next allocation cannot collide with an existing row and hand two check-ins
-- the same position in the stream.
INSERT INTO public.event_checkin_cursors (event_id, last_seq)
SELECT event_id, max(server_seq)
  FROM public.check_ins
 WHERE server_seq IS NOT NULL
 GROUP BY event_id
ON CONFLICT (event_id)
  DO UPDATE SET last_seq = GREATEST(public.event_checkin_cursors.last_seq, EXCLUDED.last_seq);

-- ═══════════════════════════════════════════════════════════════════
-- 4. event_staff — the per-event door roster (§18.5)
-- ═══════════════════════════════════════════════════════════════════
-- Roles here are ONLY the two that exist on a tablet. The spec's role matrix
-- (§18.2) also lists organizer and admin, but those are platform identities
-- resolved by middleware/auth.js — they are not roster rows, and modelling
-- them here would create a second, competing source of truth for who is an
-- admin.
--
-- pin_hash: bcrypt or Argon2id, per §18.5. A 4-digit PIN is a 10,000-value
-- keyspace, so a fast hash is trivially reversible — the slow hash is the
-- whole defence, together with the per-device lockout the app enforces.
-- Plaintext PINs are never stored or transmitted; the bundle carries hashes.
CREATE TABLE IF NOT EXISTS public.event_staff (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    display_name text NOT NULL,
    role         text NOT NULL DEFAULT 'usher',
    pin_hash     text NOT NULL,
    is_active    boolean NOT NULL DEFAULT true,
    -- Set when a supervisor resets a PIN offline (§21.8); syncs up later.
    pin_reset_at timestamptz,
    pin_reset_by uuid,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT event_staff_role_check CHECK (role IN ('usher', 'supervisor')),
    CONSTRAINT event_staff_display_name_check
      CHECK (length(trim(display_name)) BETWEEN 1 AND 80)
);

-- Staff pick their own name off a list to log in (§8.1), so two active
-- "Ahmed"s on one event would be unresolvable at the door.
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_staff_active_name
  ON public.event_staff (event_id, lower(trim(display_name)))
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_event_staff_event ON public.event_staff (event_id);

ALTER TABLE public.event_staff ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════
-- 5. event_devices — provisioned tablets (§18.3, §18.4)
-- ═══════════════════════════════════════════════════════════════════
-- Stores token HASHES, not tokens — same reasoning as sessions.jti elsewhere
-- in this schema. A database read must not yield a credential that
-- impersonates a device.
--
-- The health columns (battery/storage/bundle/queue) exist so a supervisor can
-- spot a failing device BEFORE it dies (§21.7). A tablet dying with unsynced
-- check-ins is permanent data loss, so this is not telemetry vanity.
CREATE TABLE IF NOT EXISTS public.event_devices (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id           uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    -- ── Gate binding (amendment A-17) ──
    -- A device binds to a named `entrance` element in this event's seating map;
    -- the organizer picks a gate that exists rather than typing a label. The
    -- venue layout is the single source of truth for gate names, which drive the
    -- audit trail, conflict reports and the readiness view.
    --
    -- Discovery confirmed (report §5A) that an entrance is
    -- `element_type = 'zone' AND shape = 'entrance'` in `tables`. Validated on
    -- write rather than by a CHECK, because a CHECK cannot reach another table.
    --
    -- ON DELETE SET NULL, deliberately NOT RESTRICT: `tables` and `event_devices`
    -- both cascade from `events`, and Postgres does not guarantee cascade order —
    -- a RESTRICT here would intermittently make deleting an EVENT fail. The real
    -- guard against orphaning a gate lives in tableController.deleteTable, where
    -- it can also return a useful message. If a gate ever does vanish, the
    -- denormalised label below keeps the audit trail readable.
    gate_table_id      uuid REFERENCES public.tables(id) ON DELETE SET NULL,
    -- The gate's name, snapshotted at pairing and at each reassignment. Appears
    -- in the audit trail and in conflict reports; an unlabelled device makes a
    -- conflict impossible to investigate, hence NOT NULL.
    device_label       text NOT NULL,
    token_hash         text NOT NULL,
    refresh_token_hash text,
    -- When the CURRENT access token was issued. Separate from created_at so
    -- rotating a token does not have to falsify when the device was paired.
    token_issued_at    timestamptz NOT NULL DEFAULT now(),
    refresh_issued_at  timestamptz NOT NULL DEFAULT now(),
    -- model / OS version / install id, for support triage. No PII.
    fingerprint        jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active          boolean NOT NULL DEFAULT true,
    revoked_at         timestamptz,
    revoked_by         uuid,
    -- Admin-triggered remote wipe (§20.5). The device purges local event data
    -- on its next contact and reports back by clearing this.
    wipe_requested_at  timestamptz,
    wipe_confirmed_at  timestamptz,
    last_seen_at       timestamptz,
    battery_level      integer CHECK (battery_level IS NULL OR battery_level BETWEEN 0 AND 100),
    storage_free_mb    integer CHECK (storage_free_mb IS NULL OR storage_free_mb >= 0),
    bundle_version     bigint,
    queue_depth        integer CHECK (queue_depth IS NULL OR queue_depth >= 0),
    app_version        text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    created_by         uuid,
    CONSTRAINT event_devices_label_check
      CHECK (length(trim(device_label)) BETWEEN 1 AND 60)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_devices_token_hash
  ON public.event_devices (token_hash);
CREATE INDEX IF NOT EXISTS idx_event_devices_event
  ON public.event_devices (event_id) WHERE is_active;

-- Supports the deletion guard: "does any device still reference this gate?"
CREATE INDEX IF NOT EXISTS idx_event_devices_gate
  ON public.event_devices (gate_table_id) WHERE gate_table_id IS NOT NULL;

-- ── Gate name uniqueness (amendment A-17) ──
-- Discovery finding: tableController.hasNameCollision enforces name uniqueness in
-- APPLICATION code with a read-then-write across all elements, and there is no
-- database constraint behind it. Two concurrent creates can both pass, and a
-- direct database write bypasses it entirely.
--
-- That was tolerable while a name was only a display label. A-17 makes it the
-- identity a gate is known by in the audit trail, so it needs a real constraint.
--
-- ── Why this is scoped to ENTRANCES rather than all elements ──
--
-- The application rule covers every element, and mirroring that here would be
-- tidier. But a unique index is validated against EXISTING data: if any event has
-- ever raced two same-named tables past hasNameCollision, a whole-table index
-- fails and takes the deploy down with it. A-17 needs gate identity, not table
-- identity, so the index covers exactly what the amendment requires and cannot be
-- broken by legacy table data. The broader rule stays where it already lives.
--
-- Entrances are few per event, so the de-duplication below touches almost nothing
-- in practice — but it runs first so the index cannot fail either.
DO $$
DECLARE
  v_row record;
  v_new text;
BEGIN
  FOR v_row IN
    SELECT id, event_id, table_name,
           row_number() OVER (
             PARTITION BY event_id, lower(trim(table_name))
             ORDER BY created_at, id
           ) AS rn
      FROM public.tables
     WHERE element_type = 'zone' AND shape = 'entrance'
  LOOP
    -- rn = 1 keeps the original name; later duplicates are suffixed.
    --
    -- The suffix is a fragment of the row's own id, not a counter: a counter can
    -- collide with a name that already exists ("Main" and "Main (2)" both present
    -- would produce a second "Main (2)"), whereas ids are unique by construction
    -- so two renamed rows can never converge. Renaming is visible in the map
    -- editor and trivially reversible — the right trade against a failed deploy.
    IF v_row.rn > 1 THEN
      v_new := v_row.table_name || ' (' || substr(v_row.id::text, 1, 8) || ')';
      UPDATE public.tables SET table_name = v_new WHERE id = v_row.id;
      RAISE NOTICE 'A-17: renamed duplicate entrance % on event % to "%"',
        v_row.id, v_row.event_id, v_new;
    END IF;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tables_event_entrance_name
  ON public.tables (event_id, lower(trim(table_name)))
  WHERE element_type = 'zone' AND shape = 'entrance';

ALTER TABLE public.event_devices ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════
-- 6. event_device_pairing_codes — single-use, 10-minute (§18.3)
-- ═══════════════════════════════════════════════════════════════════
-- Devices are provisioned FROM the web dashboard, never self-enrolled.
-- Hashed like any other credential: a leaked table dump must not yield a
-- usable pairing code inside its validity window.
CREATE TABLE IF NOT EXISTS public.event_device_pairing_codes (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id           uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    code_hash          text NOT NULL,
    -- The gate this code will bind the device to (amendment A-17). Chosen up
    -- front so the binding is attached the instant the device pairs, rather than
    -- being an afterthought.
    gate_table_id      uuid REFERENCES public.tables(id) ON DELETE SET NULL,
    -- Snapshot of the gate's name when the code was issued, so a code generated
    -- before a rename still pairs with the name the organizer saw.
    device_label       text NOT NULL,
    expires_at         timestamptz NOT NULL,
    consumed_at        timestamptz,
    consumed_device_id uuid REFERENCES public.event_devices(id) ON DELETE SET NULL,
    created_by         uuid,
    created_at         timestamptz NOT NULL DEFAULT now()
);

-- Enforces single-use at the DB, not just in application logic (§18.7 #1).
CREATE UNIQUE INDEX IF NOT EXISTS uq_pairing_code_unconsumed
  ON public.event_device_pairing_codes (code_hash)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pairing_codes_event
  ON public.event_device_pairing_codes (event_id);

ALTER TABLE public.event_device_pairing_codes ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════
-- 7. event_check_in_conflicts — §5.3 Layer 4
-- ═══════════════════════════════════════════════════════════════════
-- Written when two devices were BOTH fully offline and both admitted the same
-- guest. The server keeps the first and records the second here with both
-- operators and both timestamps, so the supervisor can investigate rather
-- than discover a silent discrepancy in the final report.
--
-- Nothing here is ever silently dropped (§21.3).
CREATE TABLE IF NOT EXISTS public.event_check_in_conflicts (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    guest_id                    uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    -- The check-in that won. SET NULL rather than CASCADE: if the winner is
    -- later hard-deleted the conflict record must survive as evidence.
    winning_check_in_id         uuid REFERENCES public.check_ins(id) ON DELETE SET NULL,
    winning_staff_display_name  text,
    winning_device_label        text,
    winning_checked_in_at       timestamptz,
    rejected_client_checkin_id  uuid NOT NULL,
    rejected_checked_in_at      timestamptz,
    rejected_staff_id           uuid,
    rejected_staff_display_name text,
    rejected_device_id          uuid,
    rejected_device_label       text,
    rejected_method             text,
    rejected_at                 timestamptz NOT NULL DEFAULT now(),
    resolved_at                 timestamptz,
    resolved_by                 uuid,
    resolution_note             text,
    -- Makes conflict RECORDING idempotent. A device that retries a batch
    -- after a lost response must not multiply one conflict into five.
    UNIQUE (rejected_client_checkin_id)
);

CREATE INDEX IF NOT EXISTS idx_checkin_conflicts_event
  ON public.event_check_in_conflicts (event_id)
  WHERE resolved_at IS NULL;

ALTER TABLE public.event_check_in_conflicts ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════
-- 8. checkin_batch_upsert — the batch endpoint's engine (§7)
-- ═══════════════════════════════════════════════════════════════════
-- One transaction, per-element outcomes, safe to replay from the beginning
-- at any time. The three statuses the spec mandates, plus `rejected` for
-- input the server cannot place at all (unknown guest, malformed record) —
-- the spec has no status for that case, and silently discarding a queued
-- check-in is the one outcome §21.3 forbids outright. A rejected element is
-- reported back so the device can surface it instead of dropping it.
--
-- Why an advisory lock rather than relying on the unique index: two devices
-- draining concurrently can both read "no live check-in for this guest"
-- before either commits. Catching the unique violation afterwards works, but
-- it aborts the surrounding statement mid-batch and makes per-element
-- reporting fragile. Serialising drains per EVENT is cheap (a drain is a
-- background operation, never on the door's critical path) and makes the
-- read-then-write sequence below actually sound.
CREATE OR REPLACE FUNCTION public.checkin_batch_upsert(
  p_event_id uuid,
  p_records  jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec       jsonb;
  v_results   jsonb := '[]'::jsonb;
  v_client_id uuid;
  v_guest_id  uuid;
  v_party_id  uuid;
  v_method    text;
  v_existing  public.check_ins%ROWTYPE;
  v_live      public.check_ins%ROWTYPE;
  v_seq       bigint;
  v_new_id    uuid;
  v_new_seq   bigint;
  v_checked   timestamptz;
  v_device_id uuid;
  v_gate_id   uuid;
  v_accepted  integer := 0;
  v_dup       integer := 0;
  v_conflict  integer := 0;
  v_rejected  integer := 0;
BEGIN
  IF p_records IS NULL OR jsonb_typeof(p_records) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PAYLOAD');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EVENT_NOT_FOUND');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('checkin_batch:' || p_event_id::text));

  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    -- ── Parse. A malformed uuid must reject THIS element, not the batch. ──
    BEGIN
      v_client_id := nullif(v_rec->>'client_checkin_id', '')::uuid;
      v_guest_id  := nullif(v_rec->>'guest_id', '')::uuid;
      v_checked   := coalesce(nullif(v_rec->>'checked_in_at', '')::timestamptz, now());
    EXCEPTION WHEN others THEN
      v_client_id := NULL;
      v_guest_id  := NULL;
      v_checked   := now();
    END;

    v_method := coalesce(nullif(v_rec->>'method', ''), 'qr_scan');
    IF v_method NOT IN ('qr_scan','manual_search','self_service','group','override') THEN
      v_method := 'qr_scan';
    END IF;

    IF v_client_id IS NULL OR v_guest_id IS NULL THEN
      v_rejected := v_rejected + 1;
      v_results := v_results || jsonb_build_object(
        'client_checkin_id', v_rec->>'client_checkin_id',
        'status', 'rejected',
        'reason', 'MALFORMED_RECORD'
      );
      CONTINUE;
    END IF;

    -- ── 1. Idempotent replay (§5.4). Checked FIRST, and deliberately not
    --       scoped to deleted_at: a replay of an undone check-in stays
    --       undone and still reports success. ──
    SELECT * INTO v_existing
      FROM public.check_ins WHERE client_checkin_id = v_client_id;

    IF FOUND THEN
      v_dup := v_dup + 1;
      v_results := v_results || jsonb_build_object(
        'client_checkin_id', v_client_id,
        'guest_id', v_existing.guest_id,
        'status', 'duplicate',
        'server_id', v_existing.id,
        'server_seq', v_existing.server_seq,
        'undone', (v_existing.deleted_at IS NOT NULL)
      );
      CONTINUE;
    END IF;

    -- ── 2. The guest must exist AND belong to this event. Resolves party_id
    --       at the same time (check_ins.party_id is NOT NULL). ──
    SELECT party_id INTO v_party_id
      FROM public.guests WHERE id = v_guest_id AND event_id = p_event_id;

    IF NOT FOUND THEN
      v_rejected := v_rejected + 1;
      v_results := v_results || jsonb_build_object(
        'client_checkin_id', v_client_id,
        'status', 'rejected',
        'reason', 'GUEST_NOT_IN_EVENT'
      );
      CONTINUE;
    END IF;

    -- ── 3. Conflict: a DIFFERENT record already holds this guest (§5.3 L4) ──
    SELECT * INTO v_live
      FROM public.check_ins
      WHERE event_id = p_event_id AND guest_id = v_guest_id AND deleted_at IS NULL;

    IF FOUND THEN
      INSERT INTO public.event_check_in_conflicts (
        event_id, guest_id,
        winning_check_in_id, winning_staff_display_name,
        winning_device_label, winning_checked_in_at,
        rejected_client_checkin_id, rejected_checked_in_at,
        rejected_staff_id, rejected_staff_display_name,
        rejected_device_id, rejected_device_label, rejected_method
      ) VALUES (
        p_event_id, v_guest_id,
        v_live.id, v_live.staff_display_name,
        v_live.device_label, v_live.checked_in_at,
        v_client_id, v_checked,
        nullif(v_rec->>'staff_id', '')::uuid, nullif(v_rec->>'staff_display_name', ''),
        nullif(v_rec->>'device_id', '')::uuid, nullif(v_rec->>'device_label', ''), v_method
      )
      ON CONFLICT (rejected_client_checkin_id) DO NOTHING;

      v_conflict := v_conflict + 1;
      v_results := v_results || jsonb_build_object(
        'client_checkin_id', v_client_id,
        'guest_id', v_guest_id,
        'status', 'conflict',
        'server_id', v_live.id,
        'winning', jsonb_build_object(
          'staff_name',    v_live.staff_display_name,
          'device_label',  v_live.device_label,
          'checked_in_at', v_live.checked_in_at
        )
      );
      CONTINUE;
    END IF;

    -- ── 4. Accept. Resolve the gate, allocate the sequence, then insert. ──
    --
    -- The gate is derived from the DEVICE rather than trusted from the payload
    -- (amendment A-17): a client-supplied gate could attribute an arrival to a
    -- door it never came through, and the audit trail has to be trustworthy. A
    -- device that has since been moved records against its CURRENT gate, which is
    -- correct — that is where the scan physically happened.
    v_device_id := nullif(v_rec->>'device_id', '')::uuid;
    v_gate_id := NULL;
    IF v_device_id IS NOT NULL THEN
      SELECT gate_table_id INTO v_gate_id
        FROM public.event_devices
       WHERE id = v_device_id AND event_id = p_event_id;
    END IF;

    INSERT INTO public.event_checkin_cursors AS c (event_id, last_seq)
      VALUES (p_event_id, 1)
    ON CONFLICT (event_id)
      DO UPDATE SET last_seq = c.last_seq + 1, updated_at = now()
    RETURNING c.last_seq INTO v_seq;

    INSERT INTO public.check_ins (
      event_id, guest_id, party_id, client_checkin_id,
      checked_in_at, server_received_at, method, server_seq,
      staff_id, staff_display_name, device_id, device_label, gate_table_id,
      scan_token_fingerprint, token_verified,
      -- checked_in_by stays NULL for device-originated check-ins. It is the
      -- ORGANIZER audit uuid, server-derived from an authenticated session;
      -- a prior bug put a device label in it and crashed every insert (see
      -- migration 20260728000000). Device identity belongs in device_id.
      checked_in_by
    ) VALUES (
      p_event_id, v_guest_id, v_party_id, v_client_id,
      v_checked, now(), v_method, v_seq,
      nullif(v_rec->>'staff_id', '')::uuid, nullif(v_rec->>'staff_display_name', ''),
      v_device_id, nullif(v_rec->>'device_label', ''), v_gate_id,
      nullif(v_rec->>'scan_token_fingerprint', ''),
      CASE WHEN v_rec ? 'token_verified' AND v_rec->>'token_verified' IS NOT NULL
           THEN (v_rec->>'token_verified')::boolean ELSE NULL END,
      NULL
    )
    RETURNING id, server_seq INTO v_new_id, v_new_seq;

    v_accepted := v_accepted + 1;
    v_results := v_results || jsonb_build_object(
      'client_checkin_id', v_client_id,
      'guest_id', v_guest_id,
      'status', 'accepted',
      'server_id', v_new_id,
      'server_seq', v_new_seq
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'results', v_results,
    'summary', jsonb_build_object(
      'accepted', v_accepted, 'duplicate', v_dup,
      'conflict', v_conflict, 'rejected', v_rejected
    ),
    'max_seq', (SELECT coalesce(last_seq, 0) FROM public.event_checkin_cursors WHERE event_id = p_event_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.checkin_batch_upsert(uuid, jsonb) FROM anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 9. checkin_undo — soft delete with an audit trail (§7, §9.6)
-- ═══════════════════════════════════════════════════════════════════
-- Replaces the hard DELETE in guestService.undoPartyCheckIn (finding R-1).
-- Allocates a NEW server_seq so other devices learn about the undo through
-- the same gap-detecting delta stream that carries check-ins (§17.4's
-- check_in_undone message type).
--
-- Authorization is NOT performed here. This function is SECURITY DEFINER and
-- reachable only through the service role, and the caller
-- (checkinSyncController.deleteCheckIn) has already established that the actor
-- is either the event owner or an active supervisor on this event's roster.
-- The actor identity it passes is server-resolved, never client-asserted.
CREATE OR REPLACE FUNCTION public.checkin_undo(
  p_event_id          uuid,
  p_client_checkin_id uuid,
  p_actor             uuid,
  p_reason            text,
  p_staff_id          uuid DEFAULT NULL,
  p_staff_name        text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.check_ins%ROWTYPE;
  v_seq bigint;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('checkin_batch:' || p_event_id::text));

  SELECT * INTO v_row FROM public.check_ins
    WHERE event_id = p_event_id AND client_checkin_id = p_client_checkin_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_row.deleted_at IS NOT NULL THEN
    -- Idempotent: undoing an undone check-in is a no-op success, so a
    -- retried request cannot fail spuriously.
    RETURN jsonb_build_object('ok', true, 'already_undone', true, 'server_id', v_row.id);
  END IF;

  INSERT INTO public.event_checkin_cursors AS c (event_id, last_seq)
    VALUES (p_event_id, 1)
  ON CONFLICT (event_id)
    DO UPDATE SET last_seq = c.last_seq + 1, updated_at = now()
  RETURNING c.last_seq INTO v_seq;

  -- server_seq is left EXACTLY as it was; the undo gets its own position.
  UPDATE public.check_ins
     SET deleted_at           = now(),
         deleted_by           = p_actor,
         undone_by_staff_id   = p_staff_id,
         undone_by_staff_name = p_staff_name,
         undo_reason          = trim(p_reason),
         undo_seq             = v_seq
   WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'ok', true, 'server_id', v_row.id,
    'guest_id', v_row.guest_id, 'party_id', v_row.party_id, 'server_seq', v_seq
  );
END;
$$;

-- The 4-argument form must go. Adding parameters with defaults creates an
-- OVERLOAD rather than replacing, and PostgREST resolves RPCs by parameter name
-- — with both present, a 4-key call matches two candidates and fails as
-- ambiguous rather than picking one.
DROP FUNCTION IF EXISTS public.checkin_undo(uuid, uuid, uuid, text);

REVOKE ALL ON FUNCTION public.checkin_undo(uuid, uuid, uuid, text, uuid, text) FROM anon, authenticated;

COMMIT;
