# Fancy RSVP — Check-in App (Android)

Offline-first door check-in for Fancy RSVP. Built to `FANCY_RSVP_CHECKIN_SPEC.md`
v1.0 **as amended by** `../docs/Checkin-Spec-Amendments.md` — the amendment record
wins on any disagreement.

> **Status: Phases 2–7 structurally complete, NOT YET COMPILED.**
> No Android SDK or Gradle was available in the environment where this was
> written, so no Kotlin here has ever been compiled or run. Expect syntax and
> type errors. Everything is unverified until `./gradlew :app:testDebugUnitTest`
> passes. See [Verification status](#verification-status).

---

## Build

> **There is no `gradlew` in this directory yet.** The wrapper was never
> generated — no Gradle existed in the environment where this was written.
> Generate and commit it first, or the commands below cannot run:
>
> ```bash
> cd android && gradle wrapper --gradle-version 8.9
> ```
>
> Requires **JDK 17** (`jvmTarget = "17"`) and **Android SDK API 35**.
> Full sequence: `../docs/Checkin-Next-Phases.md`.

```bash
cd android
# Point at a backend. Untracked; see app/build.gradle.kts.
cat > local.properties <<'EOF'
sdk.dir=/path/to/Android/sdk
API_BASE_URL_DEBUG=http://10.0.2.2:5000/api/v1/
API_BASE_URL_RELEASE=https://fancyrsvp.com/api/v1/
EOF

./gradlew :app:testDebugUnitTest    # JVM tests — no device needed
./gradlew :app:assembleDebug
```

The trailing slash on `API_BASE_URL` is required — Retrofit resolves relative
paths against it and silently drops the last segment without one.

---

## The three cross-language contracts

These are the highest-risk part of the client, because each fails **silently and
fleet-wide**. Each is pinned by a golden vector asserted on *both* sides; neither
side may change without the other.

| Contract | Kotlin | Backend | Failure if they diverge |
|---|---|---|---|
| Bundle content hash | `util/BundleIntegrity.kt` | `services/checkinSyncService.js` → `canonicalizeGuests` | Every bundle fails verification. No device can be armed. Presents as "preparation is broken". |
| Staff PIN hashing | `data/security/PinVerifier.kt` | `controllers/authController.js` → `hashPassword` | Every PIN is rejected at the door. |
| Name normalisation | `util/NameNormalizer.kt` | `utils/normalize.js` → `normalizeNameForSearch` | Staff at one door get different search results from staff at another. |
| QR ticket payload | `scan/TicketResolver.kt` | `services/tokenService.js` → `signQrTicket` | Every scan resolves to "not found". |

Test pairs:
`BundleIntegrityTest.kt` ↔ `checkinBundleHashContract.test.js`,
`PinVerifierTest.kt` ↔ `checkinPinHashContract.test.js`,
`NameNormalizerTest.kt` ↔ `checkinNameNormalizeContract.test.js`,
`TicketResolverTest.kt` ↔ `checkinTicketParseContract.test.js`.

**The ticket contract is about SHAPE, not the signature.** Decision D-20 removed
on-device verification, so the app parses without verifying — see
`TicketResolver`'s comment for why the downloaded bundle acting as an allowlist
makes that defensible. One test exists because an RSVP invite link is signed with
the *same secret*: only the `purpose` claim separates a login link from a door pass.

**The PIN trap, recorded so nobody "fixes" it:** the server passes the salt to
`crypto.pbkdf2` as a **hex string**, so Node uses its 32 ASCII bytes as salt
material — *not* the 16 bytes it decodes to. A natural Kotlin port decodes the hex
first and rejects every PIN. Verified: the two derivations differ.

---

## Two source conventions, both from real bugs

1. **No raw control characters or literal Arabic in code.** Character sets are
   built from code points (`NameNormalizer.charClass`), and escape sequences are
   built by concatenation. A literal form feed or combining mark is invisible in
   review, vanishes in a diff, and is silently rewritten by reformatting tools —
   and one altered byte breaks a contract above for the entire fleet.
2. **`fallbackToDestructiveMigration` is a release blocker** (§21.2). It deletes
   check-ins that exist nowhere else. Its absence in `CheckinDatabase` is
   deliberate; a failed migration must fail loudly, never wipe.

---

## What is built

```
util/BundleIntegrity.kt        canonical hash + verification (§21.1)
util/NameNormalizer.kt         Arabic/Latin search folding (§8.5)
data/security/PinVerifier.kt   offline PIN verification (§18.5)
data/security/SecureStore.kt   Keystore AES-GCM for tokens + DB passphrase (§20.2)
data/local/                    Room entities, DAOs, encrypted DB (§20.3)
data/remote/                   Retrofit API, DTOs, device auth + health interceptors
data/repo/BundleRepository.kt  resumable download -> verify -> atomic promote
data/repo/DeviceRepository.kt  pairing, purge, wipe handling (§18.3, §20.5)
device/DeviceHealthProvider.kt battery/storage/queue reporting (§21.7)
di/AppModule.kt                Hilt graph
ui/theme/                      palette + arm's-length type scale
ui/pair/                       pairing screen + ViewModel
ui/prepare/                    event selection, readiness, real-count progress
ui/login/                      staff picker, on-screen keypad, lockout
ui/CheckinNavHost.kt           pair -> prepare -> login -> scanner
MainActivity.kt                FLAG_SECURE + KEEP_SCREEN_ON (§20.4, §21.9)

scan/TicketResolver.kt         scanned string -> partyId, 6 outcome states (A-1)
scan/QrAnalyzer.kt             ML Kit bundled model + 3s value-keyed debounce
data/repo/CheckInRepository.kt Layer 1 guard, local write + enqueue, search
ui/scanner/ScannerScreen.kt    CameraX preview, framing guide, torch, status strip
ui/scanner/ScanResultScreen.kt the six result states (§8.4)
ui/scanner/ManualSearchOverlay.kt  offline search, one tap from anywhere (§8.5)
```

```
sync/SyncPolicy.kt             retry ladder, jitter, poll schedule, outcome mapping
sync/ConnectionMonitor.kt      §17.6 state machine, VALIDATED-aware
sync/SyncQueueWorker.kt        WorkManager drain, survives process death
sync/SyncCoordinator.kt        polling loop, regain fetch, guest-delta timer
data/repo/SyncRepository.kt    drain, delta apply, control caching

ui/dashboard/                  live attendance, arrivals chart, supervisor block
ui/guests/                     browsable list, filters, supervisor undo
ui/entrance/                   entrance display mode (§8.8)
ui/session/                    inactivity + background lock, PIN re-entry (§20.4)
ui/close/                      event close, purge BLOCKED on unsent work (§20.5)
ui/scanner/BatteryWarning.kt   20% banner, 10% blocking modal (§21.9)
ui/theme/EventBranding.kt      white-label colour with a contrast floor (§9.8)
device/DeviceStatusMonitor.kt  battery + storage, incl. pre-travel storage guard
```

All seven phases are structurally complete: an unpaired tablet can pair, arm an
event, log a staff member in, scan tickets, record arrivals offline, drain them
when a network appears, show a live dashboard, browse and correct the guest list,
present an entrance display, lock itself, and be safely wiped at the end.

## Owner amendments applied (v1.2)

- **A-15 — the batch response carries the delta inline.** `CheckInBatchRequest`
  sends `since_seq`; `SyncRepository.drainOnce` applies `response.delta` and
  follows up directly when it is truncated. During a rush, uploads converge the
  fleet in a second or two instead of at the next poll tick. Live-event poll
  interval tightened 20 s → 10 s, which now matters most at a QUIET gate, where
  nothing is being uploaded and the timer is the only channel.
- **A-17 — gates come from the seating map.** A device binds to a named
  `entrance` element rather than a typed label. The Android side reads
  `deviceLabel` as an opaque string throughout, so the change here is small —
  but the label is now guaranteed to match a gate the organizer actually has.

## What is not built

- **Realtime (§17).** Deliberate. §17.1 says build and test polling *first*, and
  polling satisfies every §9.2 criterion. It is also blocked by discovery finding
  **R-2**: the Supabase channel has no authorisation model, and subscribing with
  the anon key would let any holder read any event's guest data.
- **Localisation.** `strings.xml` is English only; Arabic and French (§9.9) were
  explicitly descoped by the owner, as was the VIP audio cue (§9.4). RTL layout
  has never been exercised.
- **Per-event logo** (§9.8). No such column exists on the platform (amendment
  A-5 / decision D-19), so branding is colour-only.
- **Release signing.** `app/build.gradle.kts` has no signing config, so
  `assembleRelease` produces nothing installable.
- **The Gradle wrapper** and the Room `schemas/` baseline — see above and §21.2.

---

## Verification status

**Verified:** every `.kt` file scanned for stray control bytes (clean, 56 files).
All backend contract halves pass (`npm test` in `../backend`, 499/499).

**Not verified — treat as unknown:**

- Nothing has been compiled. There may be syntax or type errors.
- Library versions in `gradle/libs.versions.toml` are pinned but were never
  resolved against a repository. Expect at least one to need nudging.
- All Kotlin tests are written but unrun.
- Room schema JSON has never been generated, so there is no baseline for the
  migration tests §21.2 requires.

## Known items needing a decision or a measurement

- **PBKDF2 cost on real hardware.** 600k SHA-512 iterations is ~0.2–0.5 s on a
  desktop and can be several times that on a low-end tablet. Acceptable once per
  shift, but §18.5 wants staff switching fast because handover happens mid-rush.
  Measure on the purchased device (decision D-1). If it exceeds ~1.5 s the fix is
  a progress indicator, **not** fewer iterations.
- **Realtime channel authorisation is unresolved** (finding R-2). Blocks Phase 4,
  not Phase 2. Polling is built first by design (§17.1).
