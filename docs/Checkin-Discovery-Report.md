# Fancy RSVP Check-in System — Phase 0 Discovery Report

**Spec under review:** `FANCY_RSVP_CHECKIN_SPEC.md` v1.0
**Method:** static code analysis of this repository (no live server, no DB connection)
**Date:** 2026-07-29
**Status:** Phase 0 deliverable per spec §2.2. No feature code written.

---

## 0. Executive summary

The platform is **not** what the spec assumed on two counts, and both are architecturally load-bearing:

1. **The QR code is a signed JWT scoped to a *party*, not a guest — and the QR image encodes a *URL*, not the token.** The spec's `qr_index` table (§6.1, "single indexed primary-key lookup") cannot be built as described, because the code value is not a stable opaque string known in advance — it is a JWT whose exact bytes depend on when it was signed. A different, workable design is proposed in §3.
2. **There is already a working check-in subsystem** — DB table, service, controller, routes, feature gates, tests, and a web kiosk page. This is not a greenfield build. It is an offline-capable Android front end plus additive backend work on top of an existing, correct, online-only implementation. Reuse is high; the spec's "these endpoints do not yet exist and must be created" (§7) is only partly true.

Three things the spec asked for turned out to already exist and be correct: the server-side uniqueness constraint (§5.3 Layer 3), a race-safe check-in path, and Supabase Realtime (§17.2 "best case").

Four things do not exist at all and are net-new: **guest categories/VIP**, **an event staff roster**, **device provisioning**, and **any idempotency key on a check-in**.

One thing is a live defect for this project: the platform publishes realtime broadcasts that **nothing subscribes to**. The pipe is write-only today, so it has never been exercised end to end.

---

## 1. Confirmed / corrected assumptions

Every `[ASSUMPTION]` in the spec, resolved.

| Spec ref | Assumption | Verdict | Reality |
|---|---|---|---|
| §2.1 | Web platform is Next.js | **Confirmed** | Next.js App Router, `frontend/src/app`, run under pm2 via `next start -p 3000` ([ecosystem.config.js:30-50](ecosystem.config.js#L30-L50)). |
| §2.1 | Datastore is Postgres via Supabase with RLS | **Confirmed, with a critical qualifier** | Supabase Postgres, RLS enabled on all tables. **But the platform does not use Supabase Auth.** RLS policies key off `auth.uid()` ([schema.sql:2912](supabase/schema.sql#L2912)), which is always null here — authentication is a custom HS256 JWT in an httpOnly cookie plus a server-side `sessions` table ([middleware/auth.js:112-162](backend/middleware/auth.js#L112-L162)). All data access goes through an **Express API using the service-role key**, which bypasses RLS entirely ([config/supabase.js:19](backend/config/supabase.js#L19)). **Consequence: the Android app must never talk to Supabase directly for data. RLS provides it no protection.** |
| §6.1 | "Field names below are indicative" | **Corrected** | See §2 — the real schema is party-centric, not guest-centric, and several spec fields have no source at all. |
| §7 | "These endpoints do not yet exist and must be created" | **Partly wrong** | `POST /scan`, `POST /manual`, `GET /search`, `POST /undo` already exist under `/api/v1/events/:eventId/checkin` ([routes/checkinRoutes.js](backend/routes/checkinRoutes.js)). The bundle, batch, and delta endpoints genuinely do not exist. |
| §4 | Min SDK / tablet choice | **Unaffected** — no repo dependency | Still a hardware decision. |

---

## 2. The real schema

### 2.1 The core shape: party → guests

The unit of RSVP is a **party** (a household/invitation group). Individual people are `guests` rows hanging off it.

```
events (id, org_id, slug, title, event_date, location_name, location_address,
        status, is_paid, tier_name, custom_colors, template_data, …)
  └── rsvp_parties (id, event_id, label, response, max_party_size, notes,
                    side, sms_consent, …)
        ├── guests (id, party_id, event_id, full_name, email, phone,
        │           is_primary_contact, meal_selection, dietary_notes,
        │           age_group, relationship, gender)
        ├── seating_assignments (id, event_id, party_id, table_id)  → tables
        ├── check_ins (id, event_id, guest_id, party_id, checked_in_at,
        │              checked_in_by, method)
        ├── custom_answers (party_id, guest_id, field_id, answer_value)
        └── invitations (party_id, event_id, channel, token, status, …)
```

Sources: [schema.sql:1654-1663](supabase/schema.sql#L1654-L1663) (`check_ins`), [1773-1816](supabase/schema.sql#L1773-L1816) (`events`), [1820-1838](supabase/schema.sql#L1820-L1838) (`guests`), [1968-1982](supabase/schema.sql#L1968-L1982) (`rsvp_parties`), [1999-2006](supabase/schema.sql#L1999-L2006) (`seating_assignments`), [2082-2101](supabase/schema.sql#L2082-L2101) (`tables`).

### 2.2 `check_ins` — the existing table

```sql
CREATE TABLE public.check_ins (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id      uuid NOT NULL REFERENCES events(id)       ON DELETE CASCADE,
    guest_id      uuid NOT NULL REFERENCES guests(id)       ON DELETE CASCADE,
    party_id      uuid NOT NULL REFERENCES rsvp_parties(id) ON DELETE CASCADE,
    checked_in_at timestamptz DEFAULT now(),
    checked_in_by uuid,           -- audit-only, NO foreign key (migration 20260728000000)
    method        text CHECK (method IN ('qr_scan','manual_search','self_service')),
    UNIQUE (event_id, guest_id)   -- ← spec §5.3 Layer 3, already present
);
```

Indexes: `idx_check_ins_event_id`, `idx_check_ins_party_id`.

**Reads against the spec:**

| Spec §6.2 wants | Reality |
|---|---|
| `UNIQUE (event_id, guest_id)` | ✅ Already exists ([schema.sql:2140](supabase/schema.sql#L2140)) |
| `client_checkin_id` unique (idempotency key) | ❌ Absent — **the single most important additive change** |
| `device_id` | ❌ Absent |
| `staff_id` | ~ `checked_in_by uuid` exists but currently holds the *organizer's* user id |
| `method` ∈ `scan\|manual_search\|group\|override` | ❌ CHECK constraint allows only `qr_scan\|manual_search\|self_service` — needs widening |
| Soft-delete undo with audit trail (§7) | ❌ `undoPartyCheckIn` is a **hard `DELETE`** ([guestService.js:755-760](backend/services/guestService.js#L755-L760)) |
| `server_seq` for realtime ordering (§17.4) | ❌ Absent |
| `event_check_in_conflicts` | ❌ Absent |
| `event_staff` | ❌ Absent |
| `event_devices` | ❌ Absent — note the existing `devices` table is *organizer login-device trust*, unrelated ([schema.sql:1715-1723](supabase/schema.sql#L1715-L1723)) |

### 2.3 Fields the spec's Room schema assumes that have **no server-side source**

Do not model these until they exist server-side, or the app will carry permanently dead columns:

| Spec field (§6.1) | Status |
|---|---|
| `guests.category` (`standard\|vip\|family`) | **Does not exist.** There is no VIP or tier concept anywhere. See §5. |
| `guests.photo_local_path` | **No guest photo exists** on any table. Drop it, or it's an unfunded feature. |
| `guests.parent_guest_id` / `is_companion` | **Not modelled that way.** A "companion" is just another `guests` row in the same party with `is_primary_contact = false`. There is no parent/child link between guests. |
| `guests.party_id` | ✅ Exists and is exactly the grouping key the spec wants. |
| `guests.name_normalized` | Does not exist server-side; compute on-device during bundle ingest. Fine. |
| `events.venue` | Closest is `location_name` + `location_address`. |
| `events.total_invited` | Not stored; derive as `count(guests)` for the event. |
| `events.branding_primary_color` | Derivable from `events.custom_colors` (jsonb). |
| `events.branding_logo_path` | No per-event logo column. There is org-level profile branding (migration `20260707000000_profile_branding`) and `events.cover_image_url`. Needs a product decision — see D-19. |

---

## 3. QR codes — the most important finding

### 3.1 What is actually encoded

The QR **image** encodes a URL:

```
https://<frontend-origin>/ticket/<urlencoded-JWT>
```

[publicRoutes.js:228-240](backend/routes/publicRoutes.js#L228-L240), [invitationService.js:188-189](backend/services/invitationService.js#L188-L189).

The `<JWT>` is HS256, signed with `QR_JWT_SECRET`, payload:

```json
{ "partyId": "<uuid>", "eventId": "<uuid>", "tableName": "Table 4",
  "partySize": 3, "purpose": "qr_ticket", "iat": …, "exp": … }
```

[tokenService.js:93-107](backend/services/tokenService.js#L93-L107).

- **Signed:** yes, HS256, with an explicit `purpose` discriminator that is verified — a deliberate fix for a prior vulnerability where any token signed with that secret was accepted as a ticket.
- **Expiry:** yes — `event_date + 24h`, falling back to 30 days if the event date is missing or already past.
- **Granularity: per PARTY.** One code admits the entire party. There is no per-guest QR anywhere in the codebase.
- The existing web kiosk strips the token back out of the URL with `/\/ticket\/([^/?#]+)/` and accepts a bare token as a fallback for older emailed tickets ([checkin/page.js:23-27](frontend/src/app/checkin/page.js#L23-L27)).

### 3.2 Why this breaks the spec's `qr_index` design

Spec §6.1 wants `qr_index(code_value PK → guest_id)`, populated during preparation, so scanning is one indexed lookup with "no parsing or computing at scan time."

That cannot work here:

- The code value is a **JWT**, not a stable identifier. Two tokens minted for the same party at different moments have different `iat` and therefore **different bytes**. Any guest holding an older emailed ticket carries a code value the server would have to have remembered.
- Tokens are minted **on demand in at least four places** ([rsvpController.js:321](backend/controllers/rsvpController.js#L321), [:350](backend/controllers/rsvpController.js#L350), [:930](backend/controllers/rsvpController.js#L930), [eventController.js:516](backend/controllers/eventController.js#L516), [invitationService.js:180](backend/services/invitationService.js#L180)) and are **not persisted** except opportunistically in `invitations.token` when a QR email is actually sent.
- Tokens are ~250–400 chars. An index keyed on them is workable but pointless.

### 3.3 Recommended replacement (for the spec update)

**Verify the JWT on-device, then look up by `partyId`.**

1. Bundle download ships the event's `QR_TICKET_PUBLIC_VERIFY` material and a `parties` table keyed by `party_id`.
2. At scan time the device: extracts the token from the URL → verifies signature, `purpose`, `exp`, and `eventId` → reads `partyId` → single indexed lookup on `parties.id`.
3. Local index becomes `parties(id PK)` + `guests(party_id indexed)`. Still one indexed lookup; the added cost is one HMAC verification (microseconds — nowhere near the 1 s budget).

This also *strengthens* offline behaviour: a forged or wrong-event code is rejected locally with no server round trip, which the `qr_index` design could not do.

> **⚠️ Security decision required (D-20).** Local verification of an HS256 token requires the **shared secret on the tablet** — a symmetric secret that can mint valid tickets for every event on the platform if extracted. Options:
> - **(a) Migrate QR tickets to asymmetric signing (RS256/EdDSA)** and ship only the public key. Cleanest. Requires a backend change and a dual-verify window while old HS256 tickets are still in circulation.
> - **(b) Keep HS256 and do *not* verify on-device** — parse the JWT payload without verifying, look up `partyId` locally, and let the server reject forgeries on sync. Weaker (a forged code admits someone at the door), but the spec's §5.3 "the door is never blocked by uncertainty" already accepts a fully-audited bad admission over a blocked legitimate guest.
> - **(c) Per-event derived key** shipped in the bundle (HMAC of the master secret with the event id). Contains blast radius to one event. Middle ground; still symmetric.
>
> **Recommendation: (a).** (b) is acceptable for v1 if the backend change is unwelcome, but it must be a conscious choice, not a default.

---

## 4. Companions and plus-ones (spec §2.1 q3, §9.1)

- Companions are **plain `guests` rows** in the same party, distinguished only by `is_primary_contact = false`.
- **Companions do not have their own QR codes.** Every party shares one.
- Consequence: **spec §9.1's first bullet — "scanning a companion's own code checks in that companion only" — is unimplementable and should be deleted from the spec.** Only the shared-invitation path exists.
- The good news: **§9.1's real requirement (partial arrivals) is already supported at the data layer.** `check_ins` is per-guest with `UNIQUE(event_id, guest_id)`, so a party of four arriving as two-then-two produces four correct individual rows.
- The bad news: **the existing server behaviour does not expose that.** `checkInParty` checks in *every* unchecked guest in the party in one shot ([guestService.js:693-752](backend/services/guestService.js#L693-L752)), and it returns `ALREADY_CHECKED_IN` only when *all* guests are already in. Selecting *who* is arriving now requires a new endpoint that accepts an explicit `guest_ids[]`.
- Organizer-added companions are auto-named `Guest 2`, `Guest 3`, … ([guestService.js:164-166](backend/services/guestService.js#L164-L166)). The scan-result screen will show those placeholder names. Worth flagging to the client.

---

## 5. Guest categories / VIP (spec §2.1 q8, §9.4)

**Does not exist.** Nothing on `guests`, `rsvp_parties`, or `events` expresses tier, category, or VIP.

The nearest neighbours, and why none of them substitute:

- `rsvp_parties.side` — `partner1 | partner2` only, i.e. bride's/groom's side ([schema.sql:3337-3341](supabase/schema.sql#L3337-L3341)).
- `guests.relationship` — free text, ≤60 chars, organizer-authored. Uncontrolled; unsuitable as a gate for the VIP welcome screen.
- `guests.age_group` — `adult | teen | child | infant`.
- `rsvp_parties.notes` — free text.

**Therefore spec §9.4 (VIP treatment) and §8.4 (VIP welcome state) are blocked on new platform work**: a category column, an organizer UI to set it, and its inclusion in the bundle. That is web-platform work, which spec §3.2/§3.3 place out of scope. **This is a scope contradiction the client must resolve** — see D-4.

---

## 5A. Entrances / gates — addendum, 2026-07-30

Added for amendment A-17, which required this be confirmed rather than assumed.

**An entrance is `element_type = 'zone'` AND `shape = 'entrance'`.** There is no
dedicated entrance table. Confirmed at all three layers, which agree:

- DB: [20260616000000_seating_elements_scale.sql:24,39](supabase/migrations/20260616000000_seating_elements_scale.sql#L24-L39) — `element_type IN ('table','zone')`; `'entrance'` is listed among the non-seating zone shapes.
- API: [tableController.js:7](backend/controllers/tableController.js#L7) — `ZONE_SHAPES` contains `'entrance'`.
- Editor: [seating-map/page.js:44](frontend/src/app/dashboard/seating-map/page.js#L44) — `entrance: { cat: 'zone' }`.

Three findings that bear on using entrances as stable gate identities:

| # | Finding | Consequence |
|---|---|---|
| 1 | **Entrances already have names.** `tables.table_name` is `NOT NULL`, and `createTable` rejects a blank name with 400 for every element type ([tableController.js:38-44](backend/controllers/tableController.js#L38-L44)). | A-17's premise that entrances "have no guaranteed name today" is **incorrect**. No migration or new editor enforcement is needed. |
| 2 | **Name uniqueness is application-level and racy.** `hasNameCollision` ([tableController.js:20-27](backend/controllers/tableController.js#L20-L27)) reads-then-writes across all elements case-insensitively. There is **no unique index**. | Two concurrent creates can both pass; a direct DB write bypasses it. Needs a real constraint if gate names key an audit trail. |
| 3 | **An entrance can be deleted freely.** `deleteTable` only blocks when `seating_assignments` reference the element ([tableController.js:251-268](backend/controllers/tableController.js#L251-L268)). Parties are assigned to tables, never to entrance zones, so that guard **never fires for a gate**. | Nothing prevents deleting an entrance with a paired device or historical check-ins — exactly the orphaning A-17 forbids. Needs a new guard. |

Also note `seating_assignments.table_id` is `ON DELETE CASCADE`; any new FK from
`event_devices` to a gate must choose its delete behaviour deliberately rather
than inherit that pattern.

---

## 6. Seating (spec §2.1 q4)

Table resolution is a join, not a column:

```
rsvp_parties → seating_assignments (party_id, table_id) → tables.table_name
```

- Assignment is **per party**, never per guest. Everyone in a party shares one table.
- `tables` doubles as the venue-layout table: `element_type IN ('table','zone')` and shapes including `stage`, `dance_floor`, `bar`, `entrance`. **The bundle must filter to `element_type = 'table'`** or the app will offer to seat guests at the DJ booth.
- There is **no table→zone parent relationship** — zones are standalone elements ([invitationService.js:191-193](backend/services/invitationService.js#L191-L193)). A ticket therefore carries no zone label, and the app cannot show "Table 12, Garden Marquee".
- Unassigned parties resolve to the literal string `"Unassigned"`.
- Existing scan flow **re-queries the live assignment** rather than trusting the token's `tableName` ([checkinController.js:32-40](backend/controllers/checkinController.js#L32-L40)) — a deliberate design the offline app must replicate against its local bundle.

---

## 7. Auth (spec §2.1 q5)

| | Reality |
|---|---|
| Mechanism | Custom HS256 JWT (`JWT_SECRET`), httpOnly cookie `fancy_session`, `sameSite: lax` |
| Bearer support | ✅ `Authorization: Bearer <jwt>` accepted, explicitly "for mobile clients" ([auth.js:60-64](backend/middleware/auth.js#L60-L64)) |
| Lifetime | **24 h, fixed** ([authController.js:114](backend/controllers/authController.js#L114)) |
| Refresh token | ❌ **None exists** |
| Revocation | ✅ Server-side via `sessions.jti`, fail-closed ([auth.js:74-103](backend/middleware/auth.js#L74-L103)) |
| Device credentials | ❌ Cannot currently be issued. Every token is a *user* token belonging to an organizer or admin. |
| Authorisation | `verifyEventOwner` — the caller must be the event's `organizations.owner_user_id`, or a super admin |

**Gap against spec §18:** the platform has exactly one identity, and it is the organizer's. There is no device identity, no staff identity, no role below organizer, and no refresh token. **Spec §18 is net-new backend work in full** — `event_staff`, `event_devices`, pairing codes, device tokens, refresh rotation, and a role matrix.

**Positive:** the existing revocation model (`sessions.jti`, fail-closed lookup) is a sound pattern to extend to device tokens, and spec §18.4's 24 h access-token lifetime already matches the platform default.

**Watch out:** requiring a paired tablet to authenticate as the organizer would hand door staff full dashboard access — including guest deletion and payment data. That is unacceptable and is precisely why §18's two-identity model must be built, not shortcut.

---

## 8. Reusable API surface (spec §2.1 q6)

Base: `/api/v1`. Envelope: `{ success: true, … }` / `{ success: false, error: 'CODE', message }` (`utils/responseEnvelope`).

### 8.1 Already exists and is directly reusable

| Endpoint | Notes |
|---|---|
| `POST /events/:eventId/checkin/scan` | Body `{ token }`. Verifies JWT, checks event match, checks in whole party, logs activity, broadcasts. Gated `requireFeature('qr_checkin')`. |
| `POST /events/:eventId/checkin/manual` | Body `{ partyId }`. Gated `requireFeature('manual_checkin')`. |
| `GET /events/:eventId/checkin/search?query=` | Server-side `ILIKE` on `rsvp_parties.label` only. **Ungated.** |
| `POST /events/:eventId/checkin/undo` | Body `{ partyId }`. **Ungated, hard-deletes, no role check, no audit row.** See §11. |
| `GET /events` | Organizer's event list. |
| `GET /events/:eventId` / `/stats` | Event detail and dashboard metrics. |
| `GET /events/:eventId/rsvps` | Paginated party list via `get_event_parties` RPC, max 100/page. **The bundle's natural backbone.** |
| `GET /events/:eventId/rsvps/export` / `export-excel` | CSV + XLSX, already include `checked_in_at` and `method` ([guestService.js:597-614](backend/services/guestService.js#L597-L614)). **Spec §9.7's XLSX report is ~70% built.** PDF is not. |
| `GET /events/:eventId/seating/guests` / `/summary` | Attending-guest list with tables. |
| `GET /events/:eventId/tables` | Venue layout. |

### 8.2 Genuinely net-new

`GET /checkin/events`, `GET …/bundle`, `POST …/check-ins` (batch), `DELETE …/check-ins/{id}` (soft), `GET …/delta`, `GET …/guest-delta`, `POST /checkin/devices/pair`, plus the whole staff/device/conflict surface.

### 8.3 Constraints the Android client inherits

- **Rate limiting** — 1000 req / 15 min per IP on `/api` ([app.js:147-156](backend/app.js#L147-L156)). Spec §21.9 requires an end-of-event drain of several hundred queued check-ins never to be throttled. **A batch endpoint makes this a non-issue; per-record posting would not.** Note also that with `instances: 'max'` in cluster mode and no `REDIS_URL`, limits are per-worker and non-deterministic ([app.js:124-133](backend/app.js#L124-L133)).
- **CSRF origin guard** ([middleware/csrf.js](backend/middleware/csrf.js)) — runs on all state-changing requests. **Verify a native client sending no `Origin` header is not rejected** before Phase 1 sign-off. Not confirmed in this pass.
- **CORS allowlist** — native clients send no `Origin`, which the resolver already permits (`if (!origin) callback(null, true)`, [app.js:49](backend/app.js#L49)).
- **Feature gating** — check-in is a **paid** feature (`qr_checkin`, `manual_checkin`, `freeDefault: false`, [featureRegistry.js:35-36](backend/config/featureRegistry.js#L35-L36)). Gates resolve per event from `events.tier_name` against `super_admin_config.pricing_tiers[].features`. **The app must handle 403 `FEATURE_NOT_AVAILABLE` at preparation time, and must not let a tier change mid-event kill a device already at a venue.**

---

## 9. Realtime (spec §2.1 q7, §17.2) — Supabase Realtime, but never yet consumed

**Available: yes.** Spec §17.2's "best case" is the actual case. `[realtime] enabled = true` in `supabase/config.toml`, and the backend already publishes.

The backend uses the **REST broadcast endpoint** (`POST /realtime/v1/api/broadcast`), fire-and-forget, 2 s abort, never awaited on the critical path, never throws ([utils/realtime.js](backend/utils/realtime.js)). Topic is `event-<eventId>` — already per-event, matching spec §17.3's requirement.

Existing message types: `checkin_update`, `rsvp_submitted`, `rsvp_updated`, `seating_update`, `table_layout_updated`.

**The problem: nothing subscribes.** A full-repo search for `.subscribe(` / `channel(` on the client side returns **zero** hits. The frontend imports Supabase for **Storage only** ([utils/supabaseClient.js](frontend/src/app/utils/supabaseClient.js)). The web check-in kiosk polls; it does not subscribe.

Implications for the spec:

1. **The realtime path has never been exercised end to end.** Treat "Supabase Realtime is available" as *provisioned but unproven*. Spec §17.1's "implement and test the polling fallback first, then add realtime on top" is exactly right, and now has a concrete justification.
2. **Channel authorisation is unresolved.** For an Android device to subscribe it needs a Supabase key. With the **anon key on a public channel, any holder of that key can subscribe to any event's topic** — a cross-tenant guest-data leak. Supabase Realtime Authorization (RLS policies on `realtime.messages`) is the fix, but **no such policies exist in this repo**, and they would depend on `auth.uid()`, which this platform never populates. → **D-11 is not a simple "which mechanism" question; it is a design task.**
3. **Current payloads carry guest names in plaintext** over the broadcast (`guestName`), which compounds (2).
4. **No `server_seq`.** Spec §17.4 makes it mandatory. Net-new: a per-event monotonic sequence, assigned server-side, on every check-in.

**Fallback available today:** Server-Sent Events or a WebSocket are both viable — the API is a long-running pm2 Node process, not serverless ([ecosystem.config.js:3-28](ecosystem.config.js#L3-L28)). One caveat the spec should record: it runs in **cluster mode with `instances: 'max'`**, so a self-hosted WebSocket/SSE would need sticky sessions or a shared pub/sub bus. Supabase Realtime sidesteps that entirely, which is a further argument for it.

---

## 10. What already works well and should be preserved

Not everything needs replacing. These are correct and should be reused rather than re-derived:

- **Race-safe check-in.** `checkInParty` catches Postgres `23505`, re-reads, and retries with only the still-missing guests ([guestService.js:717-743](backend/services/guestService.js#L717-L743)). Spec §5.3 Layer 3 is done.
- **Purpose-discriminated tokens.** Every JWT is signed *and* verified against an explicit `purpose` claim, closing a real prior vulnerability ([tokenService.js:1-11](backend/services/tokenService.js#L1-L11)).
- **Ticket minting is decoupled from seating.** A "yes" party gets a ticket immediately; the table resolves at scan time ([tokenService.js:109-133](backend/services/tokenService.js#L109-L133)). This is exactly the behaviour an offline door needs.
- **`checked_in_by` is server-derived**, never client-supplied — a comment records that a kiosk once sent a device label here and crashed the insert. **Do not regress this**: the Android app must send `staff_id`/`device_id` in *new* columns, never in `checked_in_by`.
- **Existing tests:** `backend/test/checkinController.test.js` covers event mismatch, invalid ticket, and success. Extend rather than replace.

---

## 11. Defects and risks found during discovery

Not part of the brief, but they touch the check-in surface directly and would otherwise be inherited.

| # | Finding | Severity | Detail |
|---|---|---|---|
| R-1 | **`POST /checkin/undo` is ungated, un-roled, and hard-deletes** | **High** | No `requireFeature`, no role check, and `undoPartyCheckIn` issues a bare `DELETE … .select()` ([guestService.js:755-760](backend/services/guestService.js#L755-L760)). No `activity_logs` row is written. Spec §7 and §9.6 both require soft-delete with an audit trail. Any organizer-authenticated caller can erase arrival evidence without trace. |
| R-2 | **Realtime broadcasts carry guest names to a channel with no authorisation model** | **High** | See §9(2)/(3). Blocks Phase 4 until resolved. |
| R-3 | **`checkin/search` matches only `rsvp_parties.label`** | Medium | `.ilike('label', …)` ([guestService.js:773](backend/services/guestService.js#L773)) — searching a companion's own name finds nothing, and there is **no Arabic normalisation** (spec §8.5 requires diacritic-, hamza-, and alef-insensitive matching). The offline device index must do better; the server endpoint should be improved to match. |
| R-4 | **`method` CHECK constraint is closed** | Medium | Inserting `group` or `override` fails at the DB. Migration required before Phase 5. |
| R-5 | **Export cap is 10 000 rows, silently** | Low | `exportParties` warns to the log only ([guestService.js:618-622](backend/services/guestService.js#L618-L622)). Below the spec's stated ceiling; note it and move on. |
| R-6 | **Rate limits are per-worker without Redis** | Medium | `instances: 'max'` + MemoryStore ⇒ effective limit is N× and non-deterministic ([app.js:124-133](backend/app.js#L124-L133)). Matters when 6 devices drain simultaneously. |
| R-7 | **CSRF origin guard vs. native client — unverified** | Medium | Must be confirmed before Phase 1 sign-off. |

---

## 12. Corrections to apply to the specification

Before Phase 1 begins, the spec should be amended:

1. **§6.1 `qr_index`** → replace with party-keyed lookup + on-device JWT handling (§3.3 above).
2. **§9.1 bullet 1** ("scanning a companion's own code") → **delete**. No per-companion codes exist.
3. **§6.1 `guests`** → remove `photo_local_path`, `parent_guest_id`, `is_companion`. Add `is_primary_contact`. Mark `category` as blocked on new platform work.
4. **§6.1 `events`** → `venue` → `location_name`; `total_invited` is derived; `branding_logo_path` has no per-event source.
5. **§7** → mark `/scan`, `/manual`, `/search`, `/undo` as existing; scope the section to bundle/batch/delta/pairing only.
6. **§6.2 `event_check_ins`** → **do not create a new table.** Extend the existing `check_ins` additively (`client_checkin_id`, `device_id`, `staff_id`, `server_seq`, `deleted_at`, widened `method`). A parallel table would fork the organizer dashboard, the exports, and `getEventStats`, and directly violates the spec's own §2 ground rule 2.
7. **§9.4 / §8.4 (VIP)** → mark blocked pending D-4.
8. **§17.2** → record Supabase Realtime as available-but-never-consumed, and add channel authorisation as a design task, not a selection.
9. **§18** → record that no device identity, staff identity, sub-organizer role, or refresh token exists; all of §18 is net-new.
10. **§12 / §20.6** → note that RLS is inert on this platform (no Supabase Auth) and provides the app no protection.

---

## 13. `[DECISION NEEDED]` — all open items for you

Items marked ✅ are **answered by discovery** and need no input. The rest need your answer before Phase 1.

### 13.0 Decisions recorded — 2026-07-30

| # | Decision | Answer |
|---|---|---|
| **D-20** | QR verification on-device | **(b) Skip local verification.** No signing-algorithm migration. The device parses the JWT payload without verifying the signature. See §13.1 for the consequences, which include one new spec gap. |
| **D-4** | VIP / guest category | **Add `guests.category`** plus a minimal organizer UI, and include it in the bundle. §9.4 and §8.4 are unblocked. |
| **D-18** | §21 operational rules | **All three accepted** — prepared spare device at every event, no app updates within 48 h, no backend deploys touching check-in endpoints within 48 h. |
| D-1, D-5 to D-17, D-19, D-21 | Remaining 15 items | **Proceed on the §13 recommendations as defaults.** Any that turn out to be load-bearing get re-raised at the phase where they bite. |

Phase 0 is therefore **complete**: report written, every `[DECISION NEEDED]` answered, spec amendments recorded in `docs/Checkin-Spec-Amendments.md`.

### 13.1 Consequences of D-20 — better than the framing implied, but one new gap

I framed (b) as "a forged code admits someone at the door." Working it through against the actual design, **the practical exposure is materially narrower than that**, and it is worth stating precisely so nobody re-litigates this later:

- The device resolves a scanned token by looking `partyId` up **in the downloaded bundle**. The bundle is therefore an allowlist. A forged token carrying an invented `partyId` resolves to **"not found"**, exactly like any unknown code.
- To forge a code that admits anyone, an attacker must supply a `partyId` that is a **real party in that event** — a v4 UUID they have no way to guess.
- The realistic attack is not forgery at all: it is **photographing a genuine guest's ticket**. That is already handled by spec §9.5 — the code is consumed on first check-in, so the second presentation resolves to "already checked in" and admission requires a supervisor override that lands in the audit trail.
- Even unverified, the device should still **read and act on `eventId`, `exp`, and `purpose` from the payload**, because they produce the correct UX (wrong-event, expired) at zero cost. They are simply not trustworthy against a deliberate tamper — and a tamperer still needs a real `partyId`, so tampering buys nothing.

**Net: (b) is a defensible choice, and the bundle-as-allowlist is doing most of the work the signature would have done.**

**The new gap.** Spec §7's batch element is `{client_checkin_id, guest_id, checked_in_at, staff_id, device_id, method}` — **no token**. So for any check-in queued offline, the server never sees the scanned token and cannot verify it. The claim "the server rejects forgeries on sync" is therefore **not true as specified**; the server just records an arrival for a `guest_id` the device asserted.

**Recommendation (folded into the amendment record as A-11):** for `method = 'scan'`, include the raw scanned token in the batch element. The server verifies it properly (it holds `QR_JWT_SECRET`), and marks any check-in whose token fails verification as an **anomaly on the post-event report** rather than rejecting it — consistent with §5.3's "the door is never blocked by uncertainty." This restores end-to-end auditability for a few hundred bytes per record, and it is the only place a forged scan can ever be detected. Without it, D-20 has no server-side backstop at all.

### Answered by discovery — no action needed

| # | Question | Answer |
|---|---|---|
| D-2 | What is encoded in the QR codes? | Signed HS256 JWT `{partyId, eventId, tableName, partySize, purpose}` wrapped in a `/ticket/<token>` URL. §3.1. |
| D-3 | Do companions receive individual QR codes? | **No.** One code per party. §4. |
| D-4a | Does a VIP/category concept exist? | **No.** §5. (The *scope* question below remains open.) |
| D-11 | Which realtime mechanism is available? | Supabase Realtime — provisioned, already published to, **never subscribed to**. §9. |

### Require your answer

| # | Question | Why it matters | My recommendation |
|---|---|---|---|
| **D-20** | **QR verification on-device: migrate to asymmetric signing (a), skip local verification (b), or per-event derived key (c)?** | Determines whether a symmetric platform-wide secret sits on hired tablets. Blocks the entire scanning layer. | **(a)** — migrate to RS256/EdDSA with a dual-verify window. |
| **D-4** | **VIP/category: add it to the web platform, or cut VIP treatment from v1?** | §9.4 and §8.4 are unbuildable without it, and adding it contradicts §3.2/§3.3 ("no new web functionality"). | Add a single `guests.category` column + minimal organizer UI. Small work; VIP treatment is a large part of the perceived premium. |
| **D-1** | Which tablet model will be purchased? | Validation target for every §11 non-functional number. | Spec's floor: 8", ≥8 MP autofocus rear camera, 4 GB RAM, Android 12+. |
| **D-5** | Organizer push notification on VIP arrival in v1? | Requires FCM infrastructure that does not exist. | Defer to v2. Also depends on D-4. |
| **D-6** | May supervisors add walk-in guests from the app? | Contradicts §3.3 ("read-plus-attendance-write only"). Backend already has `add_guest_manual` (paid feature) to reuse. | Yes, supervisor-only, flagged as walk-in in the report — but **only if it can be queued offline**, which is real work. |
| **D-7** | Concurrent devices at the largest expected event? | Sizes realtime fan-out and rate limits. | — |
| **D-8** | Largest guest count to support? | `max_party_size` is capped at 20; export caps at 10 000 parties. | — |
| **D-9** | Multiple events live on one device on the same night? | Materially complicates bundle/session/purge logic. | No for v1. |
| **D-10** | Entrance display: same tablet or separate hardware? | Same tablet cannot scan and display simultaneously. | Separate hardware, or a second paired tablet. |
| **D-12** | Local retention window after event end? | §20.5. | 7 days, as proposed. |
| **D-13** | Certificate pinning, and who owns rotation? | A rotation without a coordinated update bricks every field device. | **No pinning for v1** unless you own a documented rotation procedure. |
| **D-14** | Who may register/revoke devices — Fancy admins only, or agencies too? | Shapes the whole §18.3 provisioning UI. | Fancy admins + the event's own organizer. |
| **D-15** | Tablets owned per client, or shared across clients? | Determines how aggressive the purge policy must be. | — |
| **D-16** | Max devices per event? | §21.7. | 6, as proposed, configurable. |
| **D-17** | Break-glass supervisor code? | Eliminates a total-stoppage scenario. | Yes — cheap, and removes a catastrophic failure mode. |
| **D-18** | **Do you accept §21's operational rules** — a prepared spare device at every event, no app updates within 48 h of an event, no backend deploys within 48 h of an event? | These are the difference between "reliable" and "reliable most nights". | Accept all three. Non-negotiable if reliability is the promise. |
| **D-19** | Per-event logo for white-label branding (§9.8) — use org profile branding, `events.cover_image_url`, or add a column? | No per-event logo exists. | Reuse org profile branding for v1. |
| **D-21** | **Check-in is a paid feature.** What should a device do if a tier changes mid-event and the gate starts returning 403? | A 403 mid-event must never stop the door. | Bundle-time gate check only; never re-gate a live device. |

---

## 14. Status and next step

**Phase 0 is complete** as of 2026-07-30. All `[DECISION NEEDED]` items are answered (§13.0), and the resulting spec amendments are recorded in `docs/Checkin-Spec-Amendments.md` (v1.0 → v1.1).

**Phase 1 — Backend foundation** is now unblocked and consists of:

1. An additive migration: `check_ins` gains `client_checkin_id` (unique), `device_id`, `staff_id`, `server_seq`, `deleted_at`, `deleted_by`, `undo_reason`, `scan_token`, `token_verified`; `method` CHECK widened to include `group` and `override`; `guests` gains `category`.
2. New tables: `event_staff`, `event_devices`, `event_device_pairing_codes`, `event_check_in_conflicts`.
3. A per-event monotonic `server_seq` allocator (§17.4 makes it mandatory).
4. `GET …/bundle` — paginated, resumable, gzip, with `record_count` + `content_hash` (§21.1).
5. `POST …/check-ins` — batch, with the replay/duplicate/conflict semantics of §7.
6. `DELETE …/check-ins/{clientCheckinId}` — soft-delete with audit trail, replacing the current hard `DELETE` (fixes R-1).
7. Automated tests proving replay, duplicate, and conflict handling — the phase's stated definition of done.

R-1 (ungated hard-delete undo) and R-4 (closed `method` CHECK) are fixed as part of items 1 and 6 rather than deferred, since Phase 1 touches exactly that code.

R-2 (realtime channel authorisation) is **not** Phase 1 work but must be designed before Phase 4; it is the one open architectural question left.

**One process note:** all findings here are from static analysis. No server was started and no database was queried. Anything that depends on runtime behaviour — the CSRF guard's treatment of a native client (R-7), whether Supabase Realtime replication is actually enabled on the hosted project, and whether the deployed schema matches `supabase/schema.sql` — is marked as such above and needs a live check before Phase 1 sign-off.
