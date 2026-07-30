# Fancy RSVP Check-in Spec — Amendment Record

**Applies to:** `FANCY_RSVP_CHECKIN_SPEC.md` v1.0 → **v1.2**
**Authority:** Phase 0 discovery (`docs/Checkin-Discovery-Report.md`) + owner decisions of 2026-07-30, owner amendments of 2026-07-30 (A-15 … A-17)
**Status:** authoritative. Where v1.0 and this record disagree, **this record wins.**

---

## Why this document exists rather than an edited spec

The v1.0 spec has never existed as a file in this repository — it was supplied as a conversation attachment, and a filesystem search of the repo, Desktop, and `fancy/` found no copy. Rather than retype 21 sections and risk silent transcription drift in a document that is meant to be authoritative, the corrections are recorded here as a precise delta keyed to v1.0 section numbers.

**When the original file is added to the repo, these amendments should be folded into it and this record retired.**

---

## Part A — Decisions recorded (2026-07-30)

| # | Decision | Answer | Effect |
|---|---|---|---|
| D-20 | QR verification on-device | **Skip local signature verification** | See A-1, A-11 |
| D-4 | VIP / guest category | **Add `guests.category`** + minimal organizer UI | §9.4 and §8.4 unblocked; A-4 |
| D-18 | §21 operational rules | **All three accepted** | §21.2, §21.4, §21.7 stand as written |
| D-1 | Tablet model | Spec floor: 8"+, ≥8 MP autofocus rear camera, 4 GB RAM, Android 12+ | Validate on purchase |
| D-5 | Organizer push on VIP arrival | **Deferred to v2** — no push infrastructure exists | Remove from §9.4 v1 scope |
| D-6 | Supervisor walk-in guests | **Yes, supervisor-only**, flagged as walk-in in the report, and **must be offline-queueable** | §10, §18.2 |
| D-7 | Concurrent devices | Design for 6 (see D-16) | §21.7 |
| D-8 | Largest guest count | A few thousand; note `max_party_size` ≤ 20 and the 10 000-party export cap | §21.10 stands |
| D-9 | Multiple live events per device | **No for v1** | Simplifies bundle/session/purge |
| D-10 | Entrance display hardware | **Separate hardware or a second paired tablet** — one tablet cannot scan and present simultaneously | §8.8 |
| D-11 | Realtime mechanism | Supabase Realtime (provisioned, already published to, never subscribed) | A-8; authorisation still open |
| D-12 | Local retention window | **7 days** | §20.5 stands |
| D-13 | Certificate pinning | **No pinning for v1** | §20.6 |
| D-14 | Who may register/revoke devices | Fancy admins **and** the event's own organizer | §18.3 |
| D-15 | Tablets per-client or shared | Assume **shared/reused** — purge policy stays aggressive | §20.5 |
| D-16 | Max devices per event | **6**, configurable | §21.7 |
| D-17 | Break-glass supervisor code | **Yes** — cheap, removes a total-stoppage mode | §21.8 |
| D-19 | Per-event logo | **Reuse org profile branding** for v1; no per-event logo column exists | §9.8 |
| D-21 | Mid-event tier/feature 403 | **Gate at bundle time only; never re-gate a live device** | §8.2, A-10 |

---

## Part B — Amendments

### A-1 · §6.1 `qr_index` — replaced

**v1.0 said:** a `qr_index(code_value PK → guest_id)` table, populated during preparation, so scanning is one indexed primary-key lookup with "no parsing or computing at scan time."

**Unbuildable.** The scanned value is `https://<origin>/ticket/<urlencoded-JWT>`, and the JWT is minted on demand in five call sites, is not persisted, and carries an `iat` — so the same party yields different code bytes at different times. There is no stable string to index.

**v1.1 replacement — resolve by `partyId`:**

1. Extract the token from the URL (`/\/ticket\/([^/?#]+)/`, falling back to treating the whole scanned string as a bare token — older emailed tickets are bare).
2. Base64-decode the JWT payload. **Do not verify the signature** (D-20).
3. Read `purpose`, `eventId`, `exp`, `partyId`. Reject on `purpose !== 'qr_ticket'`; report wrong-event on `eventId` mismatch; report expired on `exp` past.
4. Single indexed lookup on the local `parties` table by `partyId`, then `guests` by `party_id`.

**Local index becomes** `parties(id PK)` + `guests(party_id INDEXED)`. Still one indexed lookup. The `qr_index` table is deleted from the Room schema.

**Security note, and it matters:** the bundle is an **allowlist**. A token bearing an invented `partyId` resolves to "not found". Forging an admission requires guessing a real party's v4 UUID. The realistic abuse is photographing a genuine ticket, which §9.5 already handles via single-use + supervisor override. Do not re-litigate this as a hole; do read A-11, which closes the one part that is a genuine gap.

### A-2 · §9.1 first bullet — deleted

**v1.0 said:** "Scanning a companion's own code checks in that companion only."

**Deleted.** Companions have no individual QR codes. One code per party, universally. Only the shared-invitation path exists.

The rest of §9.1 stands and its acceptance criterion is achievable: `check_ins` is per-guest with `UNIQUE(event_id, guest_id)`, so a party of four arriving as two-then-two produces four correct rows.

**Added requirement:** selecting *who* is arriving now needs a check-in path accepting an explicit `guest_ids[]`. The existing `checkInParty` checks in every unchecked guest in the party at once and cannot express a partial arrival.

**Cosmetic warning for the client:** organizer-added companions are auto-named `Guest 2`, `Guest 3`, … The scan-result screen will display those placeholders.

### A-3 · §6.1 `guests` — corrected

| v1.0 field | v1.1 |
|---|---|
| `parent_guest_id` | **Removed.** No parent/child link between guests exists. |
| `is_companion` | **Removed.** Derive from `is_primary_contact = false`. |
| `photo_local_path` | **Removed.** No guest photo exists on any table. |
| `party_id` | **Kept** — exactly the grouping key intended. |
| `name_normalized` | **Kept**, computed on-device at bundle ingest. |
| `category` | **Kept** — now sourced from the new `guests.category` (D-4). |
| — | **Added** `is_primary_contact: Boolean` |
| — | **Added** `dietary_notes: String?` (exists server-side alongside `meal_selection`) |

### A-4 · §9.4 / §8.4 VIP — unblocked

`guests.category` is added server-side (D-4) with a minimal organizer UI. VIP visual treatment, audio cue, and the §8.4 VIP welcome state proceed as specified.

**Removed from v1:** organizer push notification on VIP arrival (D-5) — no push infrastructure exists.

### A-5 · §6.1 `events` — corrected

| v1.0 field | v1.1 |
|---|---|
| `venue` | → `location_name` (+ `location_address` available) |
| `total_invited` | **Derived** as `count(guests)`; not stored server-side |
| `branding_primary_color` | Extract from `events.custom_colors` (jsonb) |
| `branding_logo_path` | **No per-event source.** Use org profile branding (D-19) |
| `starts_at` | → `event_date` (timestamptz) |

### A-6 · §7 — endpoint inventory corrected

**Already exist, reusable:** `POST /events/:eventId/checkin/scan`, `POST …/manual`, `GET …/search`, `POST …/undo`, plus `GET /events`, `GET /events/:eventId/stats`, `GET …/rsvps` (paginated, `get_event_parties` RPC), `GET …/rsvps/export[-excel]`, `GET …/seating/guests`, `GET …/tables`.

**Genuinely net-new:** `GET /checkin/events`, `GET …/bundle`, `POST …/check-ins` (batch), `DELETE …/check-ins/{id}` (soft), `GET …/delta`, `GET …/guest-delta`, `POST /checkin/devices/pair`, and the staff/device/conflict surface.

**Base path correction:** the platform's prefix is `/api/v1`, not `/api`. Per §21.4 the check-in surface is versioned independently: **`/api/v1/checkin/...`**.

### A-7 · §6.2 — extend `check_ins`, do not create `event_check_ins`

**v1.0 said:** create a new `event_check_ins` table.

**Rejected**, and v1.0's own §2 ground rule 2 forbids it ("do not silently create a parallel structure"). A working `check_ins` table already exists with `UNIQUE (event_id, guest_id)` — v1.0 §5.3 Layer 3 is already satisfied — and it is read by the organizer dashboard, `getEventStats`, and both export paths. A parallel table forks all of them.

**v1.1: additive migration on `check_ins`:**

| Column | Purpose |
|---|---|
| `client_checkin_id uuid UNIQUE` | Idempotency key (§5.4). **The single most important addition.** |
| `device_id uuid` | Attribution (§18.6) |
| `staff_id uuid` | Attribution. **Distinct from `checked_in_by`** |
| `staff_display_name text` | Denormalised so the audit stays readable (§18.6) |
| `device_label text` | Denormalised, same reason |
| `server_seq bigint` | Per-event monotonic sequence (§17.4, mandatory) |
| `deleted_at`, `deleted_by`, `undo_reason` | Soft-delete undo (§7, §9.6) |
| `scan_token text`, `token_verified boolean` | A-11 |
| `method` CHECK widened | add `group`, `override`; keep existing `qr_scan`, `manual_search`, `self_service` |

**Do not touch `checked_in_by`.** It is server-derived from the authenticated session, and a code comment records that a kiosk once sent a device label into it and crashed the insert. Device and staff identity go in the new columns.

**Method-value note:** v1.0 §6.1 uses `scan`; the DB uses `qr_scan`. **The DB value wins** — mapping on the client is cheaper than migrating existing rows and both export paths.

### A-8 · §17.2 — realtime status corrected, authorisation reclassified

Supabase Realtime is **provisioned and already published to** by the backend (REST broadcast, topic `event-<eventId>`, message types including `checkin_update`). v1.0's "best case" is the actual case.

**But nothing subscribes anywhere in the codebase** — zero client-side `.subscribe(` calls; the frontend uses Supabase for Storage only. Treat realtime as **provisioned but never exercised end to end.** v1.0 §17.1's "build and test the polling fallback first" is correct and now has a concrete reason.

**Reclassified:** D-11 is *not* a mechanism-selection question, it is a **design task**. Channel authorisation is unsolved: an Android client needs a Supabase key, and with the anon key on a public channel any holder can subscribe to any event's topic — a cross-tenant guest-data leak, compounded by current payloads carrying `guestName` in plaintext. Supabase Realtime Authorization needs RLS on `realtime.messages`, which would key off `auth.uid()` — never populated on this platform.

**This must be resolved before Phase 4.** Tracked as R-2.

**Self-hosted alternatives note:** SSE or WebSocket are viable (the API is long-running pm2, not serverless), but it runs `instances: 'max'` in cluster mode, so either would need sticky sessions or a shared pub/sub bus. A further argument for Supabase Realtime.

### A-9 · §12 / §20.6 — RLS is inert on this platform

RLS is enabled on every table, but all policies key off `auth.uid()`, and **this platform does not use Supabase Auth** — authentication is a custom HS256 JWT plus a server-side `sessions` table, and all access runs through the **service-role key**, which bypasses RLS entirely.

**Consequences:** RLS provides the Android app no protection whatsoever; the app must never talk to Supabase directly for data; every authorisation decision is the Express API's responsibility.

### A-10 · §8.2 — check-in is a paid feature

`qr_checkin` and `manual_checkin` are gated (`freeDefault: false`), resolved per event from `events.tier_name` against `super_admin_config.pricing_tiers[].features`.

- Preparation must surface `403 FEATURE_NOT_AVAILABLE` / `FEATURE_REQUIRES_PAYMENT` clearly, as a "cannot arm this event" state.
- **A device already prepared and at a venue must never be re-gated** (D-21). Gate at bundle time only. A tier change mid-event must not stop the door.

### A-11 · §7 batch element — carry the scan token (new, arising from D-20)

**The gap.** v1.0 §7's batch element is `{client_checkin_id, guest_id, checked_in_at, staff_id, device_id, method}` — no token. For any check-in queued offline the server therefore **never sees the scanned token and cannot verify it.** Combined with D-20 (no on-device verification), a scanned check-in is verified *nowhere*. "The server rejects forgeries on sync" is not true as specified.

**v1.1 amendment.** For `method = 'qr_scan'`, the batch element additionally carries `scan_token` — the raw token as scanned.

- The server verifies it with `verifyQrTicket()` (it holds `QR_JWT_SECRET`).
- On success: `token_verified = true`.
- On failure: **the check-in is still recorded**, with `token_verified = false`, and appears as an **anomaly on the post-event report**. It is never rejected — consistent with §5.3's "the door is never blocked by uncertainty."
- Also assert the token's `partyId` matches the submitted `guest_id`'s party; a mismatch is the same anomaly path.

**Cost:** a few hundred bytes per scanned record. **Benefit:** the only place a forged or tampered scan can ever be detected. Without it, D-20 leaves no server-side backstop at all.

**Log hygiene (§20.7):** `scan_token` is a credential. It must not appear in any log line on either side.

### A-12 · §8.5 / §10 — server-side search is weaker than the spec assumes

`GET …/checkin/search` matches only `rsvp_parties.label` via `ILIKE`, so **searching a companion's own name finds nothing**, and there is **no Arabic normalisation** — §8.5 requires diacritic-, hamza-, and alef-insensitive matching.

The offline device index must do this properly regardless (it is the primary search path). The server endpoint should be improved to match, so the web kiosk and the app do not disagree at the door.

### A-13 · §21.9 — rate limiting caveat

`/api` is limited to 1000 req / 15 min per IP. Because the API runs `instances: 'max'` in cluster mode with no `REDIS_URL` configured, limits are **per-worker and non-deterministic** — the effective ceiling is N× and the same client is allowed or throttled depending on which worker answered.

The mandatory batch endpoint makes an end-of-event drain a handful of requests, so this is not a blocker. Recorded because §21.9 requires that a legitimate drain of several hundred queued check-ins is never throttled, and per-record posting would have violated it.

### A-14 · Pre-Phase-1 runtime verification

Everything in the discovery report is static analysis — no server started, no database queried. Three items depend on runtime behaviour and must be confirmed before Phase 1 is signed off:

1. **The CSRF origin guard vs. a native client.** `csrfOriginGuard` runs on all state-changing requests; a native client sends no `Origin` header. If it rejects them, every write from the app fails. **Highest-risk unknown.**
2. **Supabase Realtime replication** actually enabled on the hosted project (config.toml reflects local dev).
3. **The deployed schema matches `supabase/schema.sql`** — this repo has a history of migrations being written but not applied in production.

---

# Part B2 — Owner amendments of 2026-07-30 (v1.1 → v1.2)

Three amendments supplied by the project owner, recorded here in full.

**Status: all three implemented and confirmed by the owner on 2026-07-30.**
Backend 488/488 unit tests pass. Two premises in the amendments turned out to be
wrong when checked against the code, and two gaps they did not anticipate were
found — all four are recorded inline below rather than silently worked around.

| | Implemented in | Verified by |
|---|---|---|
| A-15 | `checkinSyncService/Controller`, `SyncRepository.kt`, `SyncPolicy.kt` | `checkinInlineDelta.test.js` (11) |
| A-16 | 6 dashboard components + `checkin-setup` page + `admin/checkin-devices` + admin controller | `checkinConflictsAndCategory.test.js` (13), `checkinAdmin.test.js` (16) |
| A-17 | migration `20260814000000`, `checkinDeviceService`, `tableController` | `checkinDevice.test.js`, `tableGateGuard.test.js` (9) |

Kotlin changes for A-15 are written but **never compiled** — this environment has
no JDK or Gradle. See `android/README.md`.

---

## A-15 · Batch response carries the check-in delta inline

**Amends §7 (batch endpoint) and §17 (realtime/polling).**

Polling remains the v1 mechanism, but the interval during an active event tightens
to **10 s** (was 20 s in §17.5's DEGRADED row), and — the substantive change —
**every batch check-in response returns all changes since the device's
`server_seq` in the same response body.**

The reasoning is sound and worth restating, because it inverts an assumption in
§17: during an arrival rush devices are uploading *constantly*, so the batch
response is by far the highest-frequency channel available. Piggy-backing the
delta on it converges the fleet in a second or two rather than at the next poll
tick. It costs one extra query per batch and no extra round trips.

`server_seq` remains mandatory per §17.4 — this changes *when* deltas arrive, not
how ordering or gap detection work.

### Response schema (replaces §7's batch response)

```json
{
  "results": [ /* unchanged: accepted | duplicate | conflict | rejected */ ],
  "summary": { "accepted": 0, "duplicate": 0, "conflict": 0, "rejected": 0 },
  "maxSeq": 0,
  "delta": {
    "changes":  [ /* same shape as GET .../delta */ ],
    "maxSeq":   0,
    "truncated": false
  }
}
```

`delta` is **not** a footnote or an optional extra: it is part of the documented
response schema, and a client may rely on it being present.

### Consequences to handle at implementation time

1. **The device must send its `since_seq` with the batch.** The request body
   currently carries only `records`. It gains a `since_seq` field, or the batch
   returns everything and wastes bandwidth on a poor connection — which is the
   condition this whole subsystem exists for.
2. **Ordering within the response.** The delta must be computed **after** the
   batch is applied, so a device sees its own just-accepted check-ins reflected in
   `delta.maxSeq`. Computing it before would hand back a sequence the device then
   immediately overtakes, and its next delta would re-fetch its own writes.
3. **`truncated` must be honoured on this path too.** A rush that generates more
   changes than one response can carry must not be silently cut — the device
   follows up exactly as it does for `GET .../delta`.
4. **The poll loop stays.** §17.1's rule is unchanged: polling is the correctness
   baseline. Piggy-backed deltas are an optimisation on top of it, and a device
   that stops uploading (nobody arriving at that gate) still needs the timer.

### As implemented

- `checkinSyncService.submitCheckInBatch(eventId, records, { sinceSeq })` — reads
  the delta after the RPC returns; a delta failure logs and returns `delta: null`
  rather than failing a batch the server has already committed.
- `postCheckInBatch` accepts `since_seq` or `sinceSeq`; a non-numeric value is
  treated as ABSENT rather than as 0, so a malformed client does not silently get
  the whole stream.
- `SyncRepository.applyChanges()` extracted and shared by the polling and inline
  paths — two implementations would drift, and the symptom would be a guest
  reading as arrived at one gate and not another depending on which channel
  delivered the news.
- `SyncPolicy.pollIntervalMs` DEGRADED-and-live: 20 s → 10 s.

**One correction made during implementation.** A truncated inline delta first
returned `Partial(0)` so the worker would loop — but the next `drainOnce` finds an
empty queue and returns early *without sending a batch*, so the remainder would
have waited out a full poll interval mid-rush. It now follows up with `pollDelta`
directly, bounded at 20 iterations.

---

## A-16 · Web dashboard surfaces for staff, devices and operations

**Fills a genuine hole.** §18 defines `event_staff` and `event_devices` as tables
and §18.3 refers to "the device management view in the Fancy RSVP web dashboard"
that v1.0 never specifies. Without these screens the Android app is complete and
**completely inoperable**: nobody can add a staff member or provision a tablet.

All additive — new pages and endpoints. Only item 6 touches an existing surface,
and purely by adding a field.

### Organizer dashboard

| # | Surface | Content |
|---|---|---|
| 1 | **Team management** | Add staff (name, role, 4-digit PIN), deactivate, reset PIN, list. Roles `usher` / `supervisor` per §18.2. PINs hashed server-side with a per-staff salt, never stored or transmitted in plaintext; the bundle carries hashes only. Deactivation propagates on the next guest-delta. |
| 2 | **Device management** | Create, revoke, per-device health from §21.7 telemetry (battery, free storage, bundle version, queue depth, last seen). Pairing code single-use, 8 characters, 10-minute validity, shown as text **and** QR. Revocation triggers local wipe on next contact (§20.5). Labelling constrained by A-17. |
| 3 | **Pre-event readiness** | One screen answering "are we ready tonight?": which devices are paired, which hold a **verified** bundle and at what version, battery and storage, and whether a prepared spare exists (§21.7). Warnings are **explicit blockers, not passive text.** |
| 4 | **Live check-in** | Attendance progress, arrivals over time, category breakdown, per-staff activity. Supervisor detail: pending sync per device, unresolved conflicts. |
| 5 | **Conflict resolution** | Surfaces `event_check_in_conflicts` for a human: both timestamps, both operators, both gate names, an explicit resolve action recording who and when. Also surfaces §19.5 anomalies (guests removed after checking in). |
| 6 | **Guest category** | Per D-4: one dropdown on the existing guest edit surface writing to `guests.category`. Fixed enum, no per-category theming in v1. |
| 7 | **Emergency controls** | Admin activation of the §21.5 kill switch, scoped per event, recording actor and timestamp. The UI must make unmistakable that this **never stops local check-in** — it only affects network activity. |

### Super admin

Cross-organization device registry, global revocation, remote wipe (§20.5), and
the §21.6 post-event operational summary.

### Authorisation — narrower than it first appears

Per D-14: Fancy super admins **plus the event's own organizer** may manage devices
and staff. Staff and device records are scoped to one event and are never visible
across organizations. Every privileged action is enforced server-side and written
to `activity_logs`.

**One clarification that materially reduces the work.** The amendment describes
this as "the platform's first sub-organizer concept". That is true of the *event
role model* but **not** of the *web authentication model*: ushers and supervisors
authenticate **on the device, by PIN, against the bundled roster**. They never log
into the web dashboard and have no platform credential. So these screens need no
new web identity — they are guarded by the existing `requireAuth` +
`verifyEventOwner`, plus `requireSuperAdmin` for the cross-org surfaces.

What *is* new is the **device** identity, and the amendment's instruction there is
right and already followed: `event_devices` extends the existing `sessions.jti`
revocation pattern (server-side lookup, fail-closed, immediate revocation) rather
than inventing a second mechanism. Discovery found that pattern sound and the
Phase 1 implementation already mirrors it.

### As implemented

Organizer, at `/dashboard/checkin-setup` (a separate page, not a dashboard tab —
the sidebar's existing "Check-In" entry opens the door KIOSK, and administrative
controls do not belong on a screen that faces guests):

| Item | Component |
|---|---|
| 1 Team | `TeamManagement.js` |
| 2 Devices | `DeviceManagement.js` |
| 3 Readiness | folded into `DeviceManagement.js` — same data, and separating them would mean two screens answering one question |
| 4 Live | `CheckinLive.js` |
| 5 Conflicts | `CheckinConflicts.js` |
| 6 Category | dropdown in `EditGuestModal.js` |
| 7 Emergency | `CheckinControls.js` |

Super admin: `/admin/checkin-devices` plus
`GET|DELETE|POST /api/v1/admin/checkin/devices*` and
`GET /api/v1/admin/checkin/events/:eventId/summary`.

**Four decisions worth recording:**

1. **The live view reuses the report endpoint in `json` mode** rather than adding a
   parallel stats endpoint. The report already computes every figure, and a second
   implementation would eventually disagree with the XLSX the client is emailed.
2. **Category is party-level.** The amendment says "one dropdown"; the column is
   per-guest, so it writes to every guest in the party. In practice that matches
   reality — a VIP arrives with their family and they are all VIPs at the door.
3. **An invalid category is a 400, not a coercion.** Falling back to `standard`
   would quietly downgrade a VIP, and nobody would find out until the door.
4. **Permissions reuse pre-seeded RBAC keys** (`events.view` to read,
   `security.manage` to revoke or wipe). An invented key belongs to no role, so it
   would work for super admins and be ungrantable to anyone else.

### Sequencing — and where the build already diverges

The amendment requires these screens to land before or alongside the Android
phases that depend on them, and specifically that pairing and staff management be
usable before Phase 3 scanning can be tested end to end on hardware.

**This ordering was already violated** — Android Phases 2–7 were written before
these screens existed. Nothing was lost (none of it had been compiled, and the
backend endpoints already existed from Phase 1), and the gap is now closed: items
1 and 2 are built, so hardware testing is unblocked the moment the migrations are
applied.

The remaining blockers are environmental, not sequencing: migrations `20260814…`
and `20260815…` are unapplied, the 65 integration tests are unrun, and no Kotlin
has been compiled.

---

## A-17 · Gates derive from the seating map, not free text

Every device binds to a **named `entrance` element in that event's seating map**.
The organizer picks a gate that exists; they cannot invent one. Gate names drive
the audit trail, conflict reports and readiness view, so the venue layout becomes
the single source of truth.

### Discovery: how an entrance is actually represented

The amendment required this be confirmed rather than assumed. It has been, at all
three layers, and they agree:

| Layer | Evidence |
|---|---|
| Database | `20260616000000_seating_elements_scale.sql` — `element_type IN ('table','zone')`; `shape` CHECK includes `'entrance'` among the **non-seating zone shapes** |
| API | `backend/controllers/tableController.js:7` — `ZONE_SHAPES = [... 'entrance', ...]`; `elementType` resolves to `'zone'` |
| Editor | `frontend/src/app/dashboard/seating-map/page.js:44` — `entrance: { label: 'Entrance', cat: 'zone', … }` |

**An entrance is `element_type = 'zone' AND shape = 'entrance'`.** There is no
dedicated entrance table and no other representation.

Note also: `getTables` filters to `element_type='table'` by default and the map
opts in with `?include=all` — so a gate-list endpoint must query explicitly.

### Correction to the amendment's premise

> *"Entrance elements have no guaranteed name today. Require a name at the point a
> gate is used, enforced in the map editor — not as a blanket migration."*

**This premise is false, and the work it implies is unnecessary.**

- `tables.table_name` is `text NOT NULL` at the database level.
- `createTable` rejects a missing or blank name with `400 VALIDATION_ERROR`
  (`tableController.js:38-44`) for **every** element type, entrances included.

Every entrance that can exist already has a name. No migration, no back-fill, and
no new editor enforcement is required. The amendment's underlying *intent* —
that a gate always has a stable human-readable name — already holds.

### What discovery found that the amendment did NOT anticipate

Two real gaps, both material to "gate identity must be stable":

1. **Name uniqueness is application-level only, and racy.**
   `hasNameCollision` (`tableController.js:20-27`) does a read-then-write across
   all elements, case-insensitively. There is **no unique index** on
   `(event_id, lower(table_name))`. Two concurrent creates can both pass, and any
   direct database write bypasses it entirely. If gate names are to key an audit
   trail, this needs a real constraint.

2. **An entrance can be deleted freely today.**
   `deleteTable` blocks deletion only when `seating_assignments` reference the
   element (`409 TABLE_NOT_EMPTY`). Parties are assigned to *tables*, never to
   entrance zones — so **that guard never fires for a gate.** Nothing currently
   prevents deleting an entrance that has a paired device or historical check-ins,
   which is precisely the orphaning the amendment forbids.

   Related: `seating_assignments.table_id` is `ON DELETE CASCADE`. Any new foreign
   key from `event_devices` to a gate must choose its delete behaviour
   **deliberately** (`RESTRICT`, or `SET NULL` with a soft-delete flag) rather than
   inherit that pattern.

### Rules as amended

- **Binding.** `event_devices` references a gate (the `tables` row) instead of
  carrying a free-text `device_label`. The label shown in audit trails and reports
  is the gate's `table_name`.
- **Not unique.** Multiple devices may share one gate — a busy main entrance
  legitimately runs two tablets. The D-16 cap (6, configurable) is a **separate**
  limit: gate binding constrains *where*, the cap constrains *how many*.
- **Deletion.** Deleting an entrance with a paired device or historical check-ins
  is blocked or soft-handled; it must never orphan an audit trail. Requires a new
  guard in `deleteTable` — the existing one does not cover this case.
- **Reassignment.** A device may be moved to another gate mid-event from the
  supervisor view, recorded in the audit trail.
- **History is immutable.** Check-ins already recorded keep the gate they were
  performed at.

  **This one already holds.** §18.6 requires attribution be denormalised and
  written at creation time, and the Phase 1 migration implements exactly that:
  `check_ins.device_label` is a snapshot, not a join. Reassignment updates
  `event_devices` and must **never** rewrite `check_ins` — a rule to preserve, not
  new work.
- **Provisioning is gated on the map.** Device provisioning is unavailable until
  the map defines at least one named entrance. Not a silent empty state: state
  plainly that gates come from the seating map, and link to the editor. The same
  condition appears as an explicit blocker in the readiness view (A-16 item 3).

### As implemented

Migration `20260814000000` was edited in place (it was unapplied):

- `event_devices.gate_table_id` → `tables(id)`, plus `device_label` as the name
  snapshot; `event_device_pairing_codes` carries the gate through redemption.
- `check_ins.gate_table_id` alongside the existing `device_label` snapshot. Both,
  not one: the label is the immutable §18.6 attribution the audit trail reads, and
  the id is what lets the map answer "were guests admitted here?" before allowing a
  deletion — a name alone cannot, once names can be reused.
- Partial unique index on entrance names, with a de-duplication pass first.

**Three judgement calls worth recording:**

1. **`ON DELETE SET NULL`, not `RESTRICT`.** `tables` and `event_devices` both
   cascade from `events`, and Postgres does not guarantee cascade order — a
   RESTRICT would have made deleting an EVENT fail intermittently. The refusal
   lives in `tableController.deleteTable`, where it can also explain itself.
2. **The unique index covers ENTRANCES only.** A whole-table index is validated
   against existing data: if any event ever raced two same-named tables past
   `hasNameCollision`, it fails and takes the deploy with it. A-17 needs gate
   identity, not table identity.
3. **De-duplication suffixes use the row id, not a counter.** `"Main" + " (2)"`
   collides when `"Main (2)"` already exists; ids cannot converge.

The gate is resolved from the DEVICE inside the batch RPC, never trusted from the
payload — a client-supplied gate could attribute an arrival to a door it never
came through.

New endpoints: `GET /gates` (with `canProvision`), `PATCH /devices/:id/gate`.

---

## Part C — Defects folded into Phase 1

| # | Finding | Handling |
|---|---|---|
| R-1 | `POST /checkin/undo` is ungated, un-roled, and hard-deletes with no audit row | Soft-delete, mandatory reason and audit row in Phase 1; **the role check was missing until the 2026-07-31 review** — see Part D |
| R-4 | `method` CHECK rejects `group` / `override` | **Fixed in Phase 1** — migration widens it |
| R-3 | Search: label-only, no Arabic normalisation | A-12; device-side in Phase 5, server-side alongside |
| R-2 | Realtime channel authorisation unsolved | **Design before Phase 4.** Not Phase 1 |
| R-6 | Per-worker rate limits | A-13 — noted, not blocking |
| R-7 | CSRF guard vs. native client | A-14 item 1 — verify before Phase 1 sign-off |
| R-5 | 10 000-party export cap, silent | Note in the report generator; below the stated ceiling |

---

## Part D — Review of 2026-07-31

A full read-through of everything built for check-in. Ten findings, all fixed.
Backend unit tests: **499 pass** (488 before, 11 added here).

### D-1 · Undo and override were reachable by any paired device — CRITICAL

`DELETE …/check-ins/:clientCheckinId` accepted a device token, and the handler
performed **no role check at all**. `method: 'override'` in a batch was equally
unvalidated. The only gates were `ScannerViewModel.override()` and
`GuestListScreen`'s `canUndo` — both client-side, which §18.2 explicitly forbids
as a sole gate. Every usher's tablet holds a device token.

**Fixed.** `checkinDeviceService.authorizeStaff(eventId, staffId, role)` resolves
the acting staff against the event's active roster and checks the role. An undo
over a device token now requires a `staffId` naming an **active supervisor**; an
organizer session still passes on event ownership. `override` claimed by a
non-supervisor is downgraded to `manual_search` rather than honoured — the
arrival still lands, because the unique index is what prevents a double
admission, not the label.

The Android side queues `staff_id` alongside the reason, captured at the moment
of the decision rather than looked up at send time: a drain can run hours later,
after a process restart, under a different operator.

### D-2 · Attribution was client-asserted — CRITICAL

`staff_id` and `staff_display_name` were written into the §18.6 immutable
attribution straight from the request body. A device could pin any admission on
any named person.

**Fixed.** The name is always resolved from the roster and the payload's copy is
discarded. An unrecognised staff id **drops the attribution but keeps the
arrival** — §21.3 makes discarding a queued check-in permanent data loss, and a
roster edit between scan and sync is routine. Undos record the acting supervisor
in new `undone_by_staff_id` / `undone_by_staff_name` columns, kept separate from
`deleted_by` because the two actors live in different id namespaces. The XLSX
report now names who reversed an admission, not just why.

> **`verifyStaffPin` is not this gate and never could be.** It was written for
> this purpose and left unwired. The server cannot re-verify a PIN entered
> offline hours earlier — there is nothing to re-present at sync time. Its
> docstring has been corrected; the function is retained as the server half of
> the PIN round-trip that pins the hash format `PinVerifier.kt` must match.

### D-3 · A-17's unique index had no `23505` handling — HIGH

`uq_tables_event_entrance_name` was added without touching the three writers,
which all use a read-then-write `hasNameCollision` and `throw` on any DB error.
A race that previously succeeded silently now returned a **generic 500 on a core
seating-map operation**. `createTable`, `updateTable` and `duplicateTable` now
translate that one constraint to the same 409 the pre-flight check produces.

### D-4 · Android "switch staff" was a dead end — MEDIUM

`MainActivity` commented that the nav host handled sign-out. It did not:
`signOut()` nulled the session, the overlay disappeared, and the tablet landed
back on the scanner with no operator and no route to login. `SessionGate` now
shares the `NavHostController` and navigates to login for the armed event,
clearing the outgoing operator's history off the back stack.

Also fixed: `SessionLockOverlay` invoked `onUnlocked()` **during composition**
rather than from a `LaunchedEffect`.

### D-5 · Remaining items

| Finding | Fix |
|---|---|
| `CheckinLive` showed a raw error and re-polled every 15 s on a plan without check-in | 403 + `FEATURE_*` renders an upgrade prompt and stops polling. `apiFetch` now attaches `status`/`code` to the thrown error (additive; every existing caller reads `message`) |
| Search fallback read up to 3 000 parties **with** guests, seating and check-ins embedded, per keystroke — the common path for Arabic, where the byte-exact ILIKE almost always misses | Three passes: label ILIKE, companion-name ILIKE, then a **narrow** normalized scan that hydrates only the rows that matched |
| `MAX_TRUNCATED_FOLLOWUPS` declared twice, tunable apart | `SyncCoordinator` reads `SyncRepository`'s |
| `DeviceManagement` kept a `selectedGate` pointing at a deleted gate | Selection validated against the reloaded list |
| The inline delta echoed the uploading device's own writes back to it | Filtered by `device_id` — as an OR that admits `NULL`, since `device_id <> x` is NULL for kiosk rows and a plain `neq` would starve devices of every desk check-in |

### Still unverified

Unchanged by this review, and the same as before it:

- **No Kotlin has been compiled.** D-4 is read off the source, not observed.
- **Neither migration has been applied.** All SQL here is unrun, including
  `uq_tables_event_entrance_name` and the two new undo columns.
- The 65 integration tests still need `supabase start` (Docker).

`checkin_undo` gained two parameters. Because adding defaulted parameters
creates an **overload** rather than replacing the function — and PostgREST
resolves RPCs by parameter name, so a 4-key call would match two candidates and
fail as ambiguous — migration `20260814000000` now drops the 4-argument form
explicitly. It is edited in place rather than superseded, as it has never been
applied anywhere.
