# Fancy RSVP — Check-in App (Android)

Offline-first door check-in for Fancy RSVP. Built to `FANCY_RSVP_CHECKIN_SPEC.md`
v1.0 **as amended by** `../docs/Checkin-Spec-Amendments.md` — the amendment record
wins on any disagreement.

> **Status: Phases 2–7 complete. Compiles, assembles, and passes its tests.**
> First successful build 2026-07-31 on Ubuntu 24.04 / JDK 17 / Gradle 8.9 /
> SDK 35: `assembleDebug` produces a 63 MB debug APK and `testDebugUnitTest`
> passes **108/108**. All four cross-language contracts are verified by
> execution against the backend, not by reasoning.
>
> Still unverified: **nothing has run on a real device.** No instrumented tests
> exist, PBKDF2 cost on tablet hardware is unmeasured, and the camera pipeline
> has never seen a physical QR code. See [Verification status](#verification-status).

---

## Build

> Requires **JDK 17** (not 21 — match AGP 8.7.3) and **Android SDK API 35**
> (`platforms;android-35`, `build-tools;35.0.0`). The wrapper is committed and
> pinned to Gradle 8.9; `./gradlew` works out of the box.
>
> **Do not bump AGP, Kotlin, Gradle plugins, `compileSdk`/`targetSdk`, or any
> dependency** to make an error go away. The pins are internally consistent and
> were verified against each other; a bump usually just moves the error. The one
> exception is a pin that genuinely fails to resolve — that is a *proven*
> incompatibility, and only that pin changes.
>
> Full setup, including a headless VPS build: `../docs/Checkin-Next-Phases.md` §8.

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

## SQLCipher must be loaded explicitly — do not remove this

`CheckinDatabase.build()` calls `System.loadLibrary("sqlcipher")` before creating
the `SupportOpenHelperFactory`. **This is required, and its absence does not fail
anywhere near where it is caused.**

`net.zetetic:sqlcipher-android` does not self-initialise. The older
`android-database-sqlcipher` artifact loaded itself via
`SQLiteDatabase.loadLibs(context)`; the rewrite dropped that for an explicit
call. Without it the build succeeds, `build()` succeeds — Room is lazy — and the
failure lands at the **first query**, as an `UnsatisfiedLinkError`.

That is a `java.lang.Error`, not an `Exception`, so it passes through every
`catch (e: Exception)` in the app. In this app the first query happens inside
`DeviceHealthInterceptor` during device pairing, so it presented as a pairing
failure on the tablet: type the code, press the button, app gone. It took a
purpose-built crash recorder to see it, because a tablet at a venue has no adb.

**Corollary, applied throughout the app:** boundaries that must never kill the
process catch `Throwable`, not `Exception` — `DeviceHealthProvider.snapshot()`,
`DeviceHealthInterceptor.intercept()`, `DeviceRepository.pair()`,
`PairViewModel.submit()`. OkHttp makes this sharper than usual: `AsyncCall`
reports an `IOException` to the caller and then **rethrows the original on its
own dispatcher thread**, where no caller-side catch can reach it. An `Error`
escaping an interceptor is therefore unsurvivable no matter how the call site is
written.

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
- **Instrumented / device testing.** Nothing here has ever executed on hardware.
- **Instrumented tests.** There is no `app/src/androidTest/`. The Room migration
  tests §21.2 requires need one, and the baseline to test against now exists.

---

## Verification status

**Verified by execution** (2026-07-31, Ubuntu 24.04 / JDK 17 / Gradle 8.9 / SDK 35):

- `:app:dependencies` resolves — **every pin in `libs.versions.toml` is good**,
  including the bundled ML Kit model and SQLCipher. No version needed changing.
- `:app:compileDebugKotlin` — 56 files, **0 errors, 0 warnings**.
- `:app:assembleDebug` — **63 MB debug APK**. `libbarhopper_v3.so` is packaged,
  which is empirical proof the **bundled** ML Kit model is on the classpath and
  not the Play-Services download variant (§4).
- `:app:testDebugUnitTest` — **108/108 pass**, all six classes.
- **All four cross-language contracts verified against the backend.** The PIN
  hash agrees despite the hex-string-salt quirk; Arabic normalisation matches
  Node byte-for-byte; the bundle canonicaliser produces the identical SHA-256
  (`9908c857…dc9a`) that `checkinBundleHashContract.test.js` pins.
- Room schema baseline exported and committed: version 1, 9 entities,
  identityHash `5e1247bb14c14de72a4461c929d4cc2c`.

Two real defects were found and fixed in that pass: a `return` inside an
expression body in `SecureStore.kt` (would never compile), and an unsatisfiable
assertion string in `BundleIntegrityTest.kt` (searched for a `"` that the format
never produces, so it could not pass regardless of the implementation).

**Release build (2026-07-31).** `assembleRelease` produces a **signed 44 MB APK**
(63 MB debug → 44 MB, so R8 and resource shrinking are doing real work).
`apksigner verify` passes with **APK Signature Scheme v2**, which is what minSdk
26 uses. Signing credentials come from `local.properties` / environment via the
existing `prop()` helper — never from the build file.

> **The signing key is irreplaceable.** Android identifies an app by its signing
> key, so an APK signed with a different one is a *different app* that cannot
> upgrade an installed copy. Back up the keystore and its password off-server.
>
> Certificate SHA-256:
> `e3f3109e74349d15e50150a4f3fa2f9dd3de8d0320f66824abdeb8c3ba0977ed`

Building release surfaced a bug no debug build could: `AppModule` referenced
`HttpLoggingInterceptor` under an `if (BuildConfig.DEBUG)` guard, but the
library is `debugImplementation` and therefore absent from the release compile
classpath — and Kotlin resolves types regardless of which branch can run. The
fix is a debug/release source-set split (`src/{debug,release}/…/di/HttpLogging.kt`)
rather than promoting the dependency to `implementation`, so the logging library
stays **physically absent** from the release APK instead of merely switched off.
Those request bodies carry guest names and device tokens (§20.7).

**Not verified — treat as unknown:**

- **Nothing has run on a device.** No emulator, no tablet. The camera pipeline,
  CameraX binding and ML Kit decoding have never processed a real QR code.
- **R8 output is unproven at runtime.** The build succeeding proves R8 *ran*, not
  that it kept everything reflection needs. Over-aggressive shrinking of
  kotlinx-serialization or Room shows up as failures on a device, never at build
  time — which is exactly the risk the rules in `proguard-rules.pro` anticipate
  but cannot demonstrate.
- PBKDF2 cost on tablet hardware is unmeasured (decision D-1, below).
- No instrumented tests exist, so the Room migration path is untested.

## Known items needing a decision or a measurement

- **PBKDF2 cost on real hardware.** 600k SHA-512 iterations is ~0.2–0.5 s on a
  desktop and can be several times that on a low-end tablet. Acceptable once per
  shift, but §18.5 wants staff switching fast because handover happens mid-rush.
  Measure on the purchased device (decision D-1). If it exceeds ~1.5 s the fix is
  a progress indicator, **not** fewer iterations.
- **Realtime channel authorisation is unresolved** (finding R-2). Blocks Phase 4,
  not Phase 2. Polling is built first by design (§17.1).
