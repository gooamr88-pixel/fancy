# Fancy RSVP — Playwright E2E + Smoke Suite

Cross-browser & mobile End-to-End tests for the real UI. Covers:

| Task | Covered by |
|---|---|
| **10 — Cross-browser** | matrix: Desktop Chrome + Desktop Safari (WebKit) |
| **11 — Mobile responsive** | matrix: Mobile Chrome (Pixel 5 / Android) + Mobile Safari (iPhone 13) + `expectNoHorizontalScroll` checks |
| **15 — Smoke testing** | `@smoke`-tagged specs, runnable post-deploy in seconds |
| **20 — End-to-End** | `tests/journey.spec.js`: login → create event → public RSVP → guest submits → dashboard live update |

---

## 1. Install (once)

```bash
cd e2e
npm install
npx playwright install --with-deps   # downloads Chromium, WebKit & OS deps
cp .env.example .env                  # then edit (see below)
```

## 2. Configure (`e2e/.env`)

```ini
BASE_URL=http://localhost:3000        # the running frontend under test
ORG_EMAIL=organizer@example.com       # a verified test organizer
ORG_PASSWORD=Secret123!
LIVE_SLUG=demo                        # an ACTIVE event the organizer OWNS
```

**Prerequisites (mirror the platform's real rules):**
- The **frontend and backend must be running** and reachable at `BASE_URL`.
- A freshly created event is **`pending_review`** (paid + admin-approval gate), so guests can't RSVP to it yet. Steps 3–5 therefore use **`LIVE_SLUG`** — an already-active event. The built-in **`demo`** event is always live and is the safe default for the guest flow.
- For the **live-dashboard-update** step (5), the test organizer must **own** the `LIVE_SLUG` event (so it appears on their dashboard). If `demo` isn't owned by your test org, point `LIVE_SLUG` at an active event that org owns.

## 3. Run

```bash
# Full matrix (all 4 browser/device projects), all specs
npx playwright test

# One project only
npx playwright test --project="Desktop Chrome"
npx playwright test --project="Mobile Safari"

# Just the E2E journey, headed, to watch it
npx playwright test journey --project="Desktop Chrome" --headed

# Interactive debugging
npx playwright test --ui

# Open the HTML report after a run
npx playwright show-report
```

## 4. Smoke testing (Task 15) — post-deploy

The `@smoke` subset is read-only/login-only and fast. Run it against a freshly deployed URL; a non-zero exit code fails your deploy gate.

```bash
# Fastest: smoke on Desktop Chrome only, against a deployed environment
BASE_URL=https://staging.fancyrsvp.com npm run test:smoke:chrome

# Smoke across the FULL device matrix (cross-browser + mobile confidence)
BASE_URL=https://staging.fancyrsvp.com npm run test:smoke
```

Example post-deploy gate (any CI):
```bash
cd e2e && npm ci && npx playwright install --with-deps \
  && BASE_URL="$DEPLOY_URL" ORG_EMAIL="$E2E_ORG_EMAIL" ORG_PASSWORD="$E2E_ORG_PASSWORD" \
     npm run test:smoke:chrome
```

## 5. The cross-browser & mobile matrix

Defined in `playwright.config.js`:

| Project | Engine | Emulates |
|---|---|---|
| Desktop Chrome | Chromium | Desktop Chrome/Edge |
| Desktop Safari | WebKit | Desktop Safari |
| Mobile Chrome | Chromium | Pixel 5 (Android) |
| Mobile Safari | WebKit | iPhone 13 (iOS) |

Every spec runs on **all four** by default, so one `npx playwright test` gives cross-browser **and** responsive coverage. Failures capture a **trace**, **screenshot**, and **video** automatically (`playwright-report/`).

---

## 6. Selector contract (`data-testid` — now injected into the UI)

The journey/smoke specs are **deterministic**: these `data-testid` hooks have been added to the real components and are committed alongside this suite (attributes only — zero behavior change). The page objects target them first and keep role/text fallbacks for resilience.

| `data-testid` | Element (file) |
|---|---|
| `wizard-next` | wizard advance button — Templates **and** Configure stages (`Stage1_TemplatesSimulator.js`, `Stage2_FormConfiguration.js`) |
| `event-slug` | the slug `<input>` on the Configure step (`Stage2_FormConfiguration.js`) |
| `rsvp-search` | the **Search** button (`[slug]/rsvp/page.js`, step 1) |
| `rsvp-continue-new` | the **continue as new guest** button (step 1, no-match branch) |
| `attendance-yes` / `attendance-maybe` / `attendance-no` | the attendance choice cards (auto-set in `AttendanceCard`, `GuestUI.js`) — the journey clicks `attendance-yes` |
| `rsvp-next` | the step **Continue** button (details → questions) |
| `rsvp-submit` | the final **Submit RSVP** button |
| `event-card-<slug>` | each event card on the dashboard (`EventsTab.js`) — slug-interpolated |
| `tab-rsvps` | the **RSVPs** tab in the dashboard nav (`dashboard/page.js`, generic `tab-<key>`) |

> If you tweak copy/translations later, these IDs keep the suite green without touching the specs.

---

## 7. Optional: GitHub Actions

```yaml
# .github/workflows/e2e.yml
name: E2E (Playwright)
on: [workflow_dispatch]
jobs:
  e2e:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: e2e } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22.x' }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:smoke
        env:
          BASE_URL: ${{ secrets.E2E_BASE_URL }}
          ORG_EMAIL: ${{ secrets.E2E_ORG_EMAIL }}
          ORG_PASSWORD: ${{ secrets.E2E_ORG_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: playwright-report, path: e2e/playwright-report }
```

## 8. Troubleshooting
- **Login smoke skipped** → set `ORG_EMAIL` / `ORG_PASSWORD`.
- **"Event is not live — cannot RSVP"** → `LIVE_SLUG` points at a draft/pending event; use `demo` or an active, owned event.
- **Guest never appears on dashboard (step 5)** → the test org doesn't own `LIVE_SLUG`'s event, or realtime is blocked and the reload fallback can't select the event — add `event-card-<slug>` / `tab-rsvps` testids (§6).
- **A wizard/RSVP step times out** → the copy differs from the fallback regexes; add the matching `data-testid` (§6) or adjust the regex in `pages/pageObjects.js`.
- **WebKit fails to launch on Linux CI** → you skipped `npx playwright install --with-deps`.
