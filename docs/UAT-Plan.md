<div align="center">

# Fancy RSVP
## User Acceptance Testing (UAT) — Executive Summary & Sign-off Pack

**Event Management · RSVP · Invitations · SMS Credits · Payments Platform**

</div>

### Document control
| | |
|---|---|
| **Document** | UAT Plan & Client Sign-off |
| **Version** | 1.0 |
| **Date** | `____ / ____ / ______` |
| **Prepared for** | `____________________` (Client / Stakeholder) |
| **Prepared by** | `____________________` (QA / Project Lead) |
| **Environment** | Staging — `____________________` (test mode; no real charges) |
| **Status** | ☐ Draft  ☐ In Testing  ☐ Signed Off |

### Executive summary
This pack lets the client confirm — in their own words and at their own pace — that **Fancy RSVP** delivers the agreed experience and is **ready for launch**. It walks four real end-to-end journeys on a safe staging environment (Stripe **test mode**, no real money). Each journey lists the exact screens to use, what should happen at every step, clear **pass/fail** criteria, and a tick-box checklist. Anything that doesn't behave as expected is captured in a **Defect Log**, and the pack ends with a formal **sign-off**.

### What's being verified (scope)
| # | Journey | Confirms that the client can… |
|---|---|---|
| 1 | **Create an Event** | design, configure, **pay for**, and finalize an event through the 5-step wizard |
| 2 | **Buy SMS Credits** | top up the prepaid SMS wallet and see the **exact** balance update (no double-charge) |
| 3 | **Track RSVPs** | view live responses, search/filter, see counts, and **export** the guest list |
| 4 | **Guest Experience** | a guest can be invited → **RSVP** → receive a **QR ticket** → be **checked in** at the door |

### Out of scope (for this UAT)
Platform-administrator tooling, billing reconciliation/accounting, load & security testing (covered separately), and production data. UAT runs on **staging only**.

### Acceptance (entry & exit criteria)
- **Entry:** staging is reachable; a test organizer login exists; the Stripe **test card** is available.
- **Exit / "Accepted":** all four journeys meet their pass criteria, **or** the only open items are agreed **Low**-severity defects logged below and accepted by the client.
- **Reject:** any **High**-severity defect (money handled wrongly, event can't be created, guests can't RSVP, or a ticket can't be checked in) remains open.

### Sign-off at a glance
| Journey | Result |
|---|---|
| 1 · Create an Event | ☐ Pass  ☐ Pass w/ notes  ☐ Fail |
| 2 · Buy SMS Credits | ☐ Pass  ☐ Pass w/ notes  ☐ Fail |
| 3 · Track RSVPs | ☐ Pass  ☐ Pass w/ notes  ☐ Fail |
| 4 · Guest Experience | ☐ Pass  ☐ Pass w/ notes  ☐ Fail |
| **Overall decision** | ☐ **Accept**  ☐ **Accept with conditions**  ☐ **Reject** |

> Detailed step-by-step test cases, checklists, the defect log, the final signature block, and a data-reset appendix follow on the next pages.

\newpage

# Fancy RSVP — User Acceptance Testing (UAT) Plan

**Audience:** the client / non-technical stakeholder signing off the product.
**Purpose:** confirm the four core client journeys work end-to-end and the experience is acceptable for launch.

> How to use this document: work top to bottom. For each step, do the **Action**, then check the **Expected result** matches what you see. Tick **Pass** or **Fail** in the sign-off checklists. If anything fails, note it in the **Defect Log** at the end.

---

## A. Before you start (environment & global preconditions)

| Item | Detail |
|---|---|
| **Test site** | Staging URL: `__________` (ask the dev team — do **not** use the live production site) |
| **Browser** | Latest Chrome, Edge, or Safari; allow pop-ups for the test site (the SMS checkout opens in a new tab) |
| **Test organizer account** | Email: `__________`  ·  Password: `__________` (create via the Register screen if you don't have one) |
| **Stripe TEST card** | Number `4242 4242 4242 4242`, any future expiry (e.g. `12/34`), any CVC (e.g. `123`), any ZIP. **No real money is charged in test mode.** |
| **A note on "going live"** | After a card payment, an event is marked **Paid – Pending Review**. A platform administrator approves it before it becomes visible to guests. This is by design (quality gate). UAT for "create event" ends at *Pending Review*; the admin then flips it to *Active* so you can run the RSVP-tracking journey. |

**Roles in these tests**
- **Client / Organizer** — you, performing the journeys.
- **Administrator** — the platform owner who approves an event to go live (one action, noted where needed).
- **Guest** — an invitee; you'll simulate one from the public event link.

**Screen ↔ address map (for reference)**

| Screen | Address (after the test site URL) |
|---|---|
| Register / Login | `/register` · `/login` |
| Dashboard (events list & tracking) | `/dashboard` |
| Create Event wizard | `/dashboard/create-event` |
| SMS Campaign Manager | `/dashboard/campaigns` |
| Public event page (what guests see) | `/<your-event-link>` |
| Guest RSVP page | `/<your-event-link>/rsvp` |

---

# Journey 1 — Client creates an Event

**Goal:** an organizer can design, configure, pay for, and finalize an event through the 5-step wizard.

The wizard has five steps shown along the top: **Templates → Configure → Payment → Tables → Distribute**.

### 1.1 Preconditions & test data
- You are logged in (Login screen → redirected to `/dashboard`).
- Test data to use:
  - **Title:** `Sophia & Julian's Wedding`
  - **Event date:** any date ~2 months in the future
  - **Location:** any venue name/address
  - **Pricing tier:** `Essential` (cheapest) — fine for testing
  - **Template:** `Royale Wedding`

### 1.2 Steps, actions & expected results

| # | Screen / Step | Action | Expected result (what you should see) | Behind the scenes |
|---|---|---|---|---|
| 1 | `/dashboard` | Click **Create Event** | The wizard opens on the **Templates** step | — |
| 2 | Templates | Click the **Royale Wedding** card, then pick a colour preset (e.g. *Royale Gold*); click **Next** | The card highlights as selected; a live preview reflects the colour; you advance to **Configure** | — |
| 3 | Configure | Enter the **Title**. Watch the **event link (URL)** field | A URL is auto-generated from the title (e.g. `sophia-julians-wedding`) and shows a green **"available"** check | `GET /api/v1/public/events/<slug>` returns 404 → "available" |
| 3a | Configure | (Optional) Type a link that already exists | Shows **"taken"** with a suggested alternative (e.g. `…-2026`) | same endpoint returns the event → "taken" |
| 4 | Configure | Fill **Event date**, location, and any template fields; click **Next / Continue** | The draft event is saved and you advance to **Payment**. If required fields are missing you see *"Please complete the title, URL, and date…"* | `POST /api/v1/events` creates a **draft** (status `draft`, unpaid) |
| 5 | Payment | Review the pricing tiers; the **Essential** tier is selectable | Tier prices load and one tier is pre-selected | `GET /api/v1/payments/pricing-config` |
| 6 | Payment (card) | With a tier selected, click **Pay with Card** | You're redirected to **Stripe Checkout** (hosted, secure) | `POST /api/v1/payments/events/<id>/create-checkout` → returns Stripe URL |
| 7 | Stripe | Enter the test card `4242…`, submit | Stripe shows success and returns you to the wizard **Payment** step | Stripe redirects back with `?payment=success&session_id=…` |
| 8 | Payment (return) | Observe the banner | Green banner: **"Payment received — your event is now under review. It goes live to guests once approved; you can keep setting it up in the meantime."** | `GET /api/v1/payments/verify?session_id=…` confirms payment; event → **`pending_review`** |
| 8-alt | Payment (manual) | *(Alternative to cards)* choose a manual/offline method and submit | A **reference number** (e.g. `CASH-AB12CD`) is shown; event stays unpaid until an admin approves the transfer | `POST /api/v1/payments/events/<id>/manual-payment` |
| 9 | Payment | Click **Continue** | You advance to **Tables** | — |
| 10 | Tables | (Optional) add a table or two, or skip; click **Continue** | Tables you add appear; you advance to **Distribute** | `POST /api/v1/events/<id>/tables` (if you add any) |
| 11 | Distribute | Review sharing options (Link is always on; QR / SMS optional). Your event **link** is shown | The public event link is displayed and copyable | — |
| 12 | Distribute | Click **Finish / Create Event** | You're redirected to `/dashboard`; the new event appears in your events list | Any custom form fields saved via `POST /api/v1/events/<id>/fields`; redirect to dashboard |
| 13 | `/dashboard` | Find the new event in the list | Event shows with a **Paid / Pending Review** status | — |

### 1.3 Acceptance criteria (Pass/Fail)
- ✅ The wizard advances through all five steps without errors or dead-ends.
- ✅ The auto-generated event link shows correct **available / taken** feedback.
- ✅ Missing required fields are blocked with a clear message (cannot create an empty event).
- ✅ Card payment with the test card returns to the app and shows the **"under review"** confirmation.
- ✅ After finishing, the event appears on the dashboard as **Paid / Pending Review**.
- ❌ **Fail** if: the wizard crashes, payment success isn't confirmed, the event isn't created, or a paid event is shown as unpaid.

### 1.4 Client sign-off checklist — Create Event
| Check | Pass | Fail | Notes |
|---|:--:|:--:|---|
| I could pick a template & colours | ☐ | ☐ | |
| The event link suggestion / "taken" check worked | ☐ | ☐ | |
| I could not proceed with required fields empty | ☐ | ☐ | |
| Card checkout (test card) completed and returned | ☐ | ☐ | |
| "Payment received / under review" message appeared | ☐ | ☐ | |
| The event appears on my dashboard afterwards | ☐ | ☐ | |

---

# Journey 2 — Client buys SMS Credits

**Goal:** an organizer can top up the prepaid SMS wallet used to text invitations, and see the balance update.

> **Important precondition (by design):** SMS credits can only be purchased **after** the organization has completed at least one **card** event payment. (That first card payment registers the billing customer.) If you try before, you'll see *"Please complete your first event payment before purchasing SMS credits."* — complete Journey 1 with **Pay with Card** first.

There are two entry points that behave identically: the **Distribute** step of the wizard, and the **SMS Campaign Manager** page (`/dashboard/campaigns`). This journey uses the Campaign Manager.

### 2.1 Preconditions & test data
- Journey 1 completed with a **card** payment (so a billing customer exists).
- An event is selected/active in your dashboard.
- Test data:
  - **Credits to buy:** `100` (then optionally repeat with `500` to see the volume discount)
  - **Stripe test card:** `4242 4242 4242 4242`

### 2.2 Steps, actions & expected results

| # | Screen / Step | Action | Expected result | Behind the scenes |
|---|---|---|---|---|
| 1 | `/dashboard` | Open **SMS Campaign Manager** (Campaigns) | The page shows a **wallet** (Purchased / Consumed / Remaining) and a message composer with a live phone preview | `GET /api/v1/events/<id>/campaigns/history` (wallet + ledger); `GET /api/v1/payments/pricing-config` (rate) |
| 2 | Campaigns | Note the **Remaining Balance** | Shows current credits (e.g. `0 Credits` first time) | — |
| 3 | Campaigns | Click **Buy SMS Credits** | A modal opens: number-of-credits input + a price breakdown | — |
| 4 | Buy modal | Enter `100` | Subtotal updates live (e.g. `100 × 8¢ = $8.00`); **Total** shown | client-side calc mirrors server pricing |
| 4a | Buy modal | Enter `500` | A **Volume Discount (12.5%)** line appears and the Total reflects it | discount applies at 500+ (matches server `computeSmsChargeCents`) |
| 4b | Buy modal | Enter `49` and submit | Blocked with **"Minimum purchase is 50 credits."** | validated client + server (`creditCount` 50–50,000) |
| 5 | Buy modal | With `100`, click **Proceed to Checkout** | A **new tab** opens with Stripe Checkout (this page stays put, keeping your draft message) | `POST /api/v1/payments/events/<id>/sms-credits` → Stripe URL opened in new tab |
| 6 | Stripe (new tab) | Pay with the test card | Stripe succeeds and redirects back to **Campaigns** with a success flag | returns to `/dashboard/campaigns?purchase=success&session_id=…` |
| 7 | Campaigns (return) | Read the banner | Green banner: **"Payment received — 100 SMS credits added to your wallet."** | `GET /api/v1/payments/verify?session_id=…` confirms; credits applied **once** (idempotent) |
| 8 | Campaigns | Look at the wallet | **Purchased** and **Remaining** increase by 100; a **purchase** row appears in **Transaction History** | wallet/ledger refreshed |
| 9 | Campaigns | (Optional) switch tabs away and back | Balance stays correct; it does **not** double-count on refresh | verify + webhook are both idempotent |

### 2.3 Acceptance criteria (Pass/Fail)
- ✅ The wallet shows Purchased / Consumed / Remaining clearly.
- ✅ Price preview is correct, and the **12.5% discount** appears at 500+ credits.
- ✅ Purchases under 50 credits are blocked with a clear message.
- ✅ After paying, the **exact** number of credits is added (not zero, not double), and a purchase line appears in history.
- ✅ Returning to the page / refreshing does **not** add the credits again.
- ❌ **Fail** if: balance doesn't update, the wrong amount is added, credits are added twice, or the discount math is wrong.

### 2.4 Client sign-off checklist — Buy SMS Credits
| Check | Pass | Fail | Notes |
|---|:--:|:--:|---|
| Wallet balance is clearly displayed | ☐ | ☐ | |
| Price preview & discount (500+) are correct | ☐ | ☐ | |
| Under-50 purchase is blocked | ☐ | ☐ | |
| Checkout opened and returned with success message | ☐ | ☐ | |
| Correct credits added exactly once | ☐ | ☐ | |
| Transaction history shows the purchase | ☐ | ☐ | |

---

# Journey 3 — Client tracks responses / RSVPs

**Goal:** an organizer can see who's coming, search/filter/sort responses, watch them update live, and export the list.

> **Precondition (by design):** guests can only RSVP once the event is **Active** (paid **and** approved by an admin). Ask the administrator to approve the event from Journey 1, **or** use the built-in **`demo`** event which is always open for testing. You also need at least one or two responses to track — create them in step 3.1 below.

### 3.1 Preconditions & test data (generate some responses first)
1. Confirm the event is **Active** (admin-approved) — or use the demo event link.
2. Generate test responses one of two ways:
   - **As a guest:** open the public link `/<your-event-link>`, click **RSVP**, and submit as e.g. *Alex Smith — Attending — Party of 2*. Repeat with a *Declined* guest. (Endpoint: `POST /api/v1/public/events/<slug>/rsvp`.)
   - **As the organizer:** on the dashboard, use **Add Guest** to add a guest manually.
3. Now you have data to track.

### 3.2 Steps, actions & expected results

| # | Screen / Step | Action | Expected result | Behind the scenes |
|---|---|---|---|---|
| 1 | `/dashboard` | Select your event from the list | The event dashboard opens on **Overview** | `GET /api/v1/events/<id>/stats`, `/rsvps`, `/tables` |
| 2 | Overview | Read the summary | Totals for **Attending / Declined / Pending** (parties & guests) match what you submitted | `/stats` aggregation |
| 3 | Dashboard | Open the **RSVPs / Guests** tab | A table of guests with name, response **badge** (Accepted / Declined / Pending), party size, and timestamp | `GET /api/v1/events/<id>/rsvps` |
| 4 | RSVPs tab | Use the **search** box (type part of a guest name) | The list filters to matching guests | server-side `?search=` |
| 5 | RSVPs tab | Use the **response filter** (Accepted / Declined / Pending) | Only matching responses are shown | `?response=` |
| 6 | RSVPs tab | If there are many guests, use the **pagination** controls | Pages of ~10 guests navigate correctly | client paging over fetched rows |
| 7 | Live update | Keep the dashboard open; in another tab, submit a **new** RSVP from the public link | The new response appears on the dashboard **without a manual refresh** (live), and the Overview counts increase | realtime broadcast on channel `event-<id>` |
| 8 | RSVPs / Guests | Click **Send Invitations** (if testing email invites) | A summary like *"Invitations sent: N"* appears; invited guests are marked | `POST /api/v1/events/<id>/rsvps/send-invitations` |
| 9 | Export | Click **Export** (CSV) | A `.csv` file downloads with the guest list (name, email, phone, response, party size, table, meals, check-in) | `GET /api/v1/events/<id>/rsvps/export` |
| 9a | Export | Click **Export Excel** (if present) | An `.xlsx` file downloads | `GET /api/v1/events/<id>/rsvps/export-excel` |
| 10 | Edit | Open a guest and **edit** their response/party size; save | The change is reflected in the table and the Overview counts | `PATCH /api/v1/events/<id>/rsvps/<rsvpId>` |

### 3.3 Acceptance criteria (Pass/Fail)
- ✅ Overview totals match the responses submitted (attending/declined/pending).
- ✅ Search, response filter, and pagination all return the correct guests.
- ✅ A newly submitted RSVP appears **live** (no manual refresh) and updates the counts.
- ✅ Export produces a downloadable file containing the correct guests and fields.
- ✅ Editing a guest updates both the list and the summary counts.
- ❌ **Fail** if: counts don't match, filters return wrong rows, live updates don't appear, or export is empty/incorrect.

### 3.4 Client sign-off checklist — Track RSVPs
| Check | Pass | Fail | Notes |
|---|:--:|:--:|---|
| Summary totals match what I submitted | ☐ | ☐ | |
| Search returns the right guest(s) | ☐ | ☐ | |
| Response filter (Accepted/Declined/Pending) works | ☐ | ☐ | |
| A new RSVP appears live without refreshing | ☐ | ☐ | |
| Export downloads a correct guest list | ☐ | ☐ | |
| Editing a guest updates the list & totals | ☐ | ☐ | |

---

# Journey 4 — The Guest Experience (invite → RSVP → ticket → check-in)

**Goal:** an invited guest can receive an invitation, submit their RSVP, receive a QR ticket once seated, and be checked in at the venue door.

> This journey crosses two "sides": the **guest** (on a phone, no login) and the **door staff** (the organizer, logged in, on the check-in page). You can play both roles.
>
> **Preconditions (by design):**
> - The event is **Active** (paid **and** admin-approved) — or use the always-open **`demo`** event. Guests cannot RSVP to an event still *Pending Review*.
> - For the **ticket** step, the guest must be **assigned to a table** — seating an attending guest is what triggers their QR ticket email.
> - **Email/SMS in test mode:** if no email/SMS provider keys are configured on staging, invitations are *simulated* (logged, not actually delivered). In that case, ask the dev team for the guest's invitation link, or use the **public link** flow below — it needs no email. Use your own inbox/number for any test guest so you receive real messages when keys *are* set.

### 4.1 Test data
- **Guest:** `Alex Smith` · email `alex+guest1@example.com` · phone `+1 555 0199` · **Attending**, party of **2** (second guest `Jamie Lee`).
- A meal option (if your event configured one), e.g. `Beef`.

### 4.2 Steps, actions & expected results

**Part A — Receive the invite & submit the RSVP**

| # | Screen / Step | Action | Expected result | Behind the scenes |
|---|---|---|---|---|
| 1 | Organizer dashboard | (As organizer) send invitations — **Send Invitations** (email) or an **SMS campaign** (Journey 2) | Guest receives an email **"You're Invited: <event>"** with **Accept / Decline / Maybe** buttons + a "manage my RSVP" link; or an SMS with a personal link | email: `sendInvitationEmail` (signed token); SMS: `/<slug>/rsvp?g=<guestId>` |
| 2A | Guest email → `/rsvp?token=…` | (As guest) tap **Accept** in the email | A landing page resolves the invite and greets the guest by name, pre-selecting **Attending** | `GET /api/v1/public/rsvp/invite?token=…` (read-only) |
| 3A | `/rsvp?token=…` | Confirm party size and submit | **"Your response has been recorded."** | `POST /api/v1/public/rsvp/respond` |
| 2B | Public link → `/<event-link>` | *(Alternative, no email needed)* open the public event page, click **RSVP** | The event page loads (only if Active); the RSVP form opens at `/<event-link>/rsvp` | `GET /api/v1/public/events/<slug>` |
| 3B | `/<event-link>/rsvp` | If opened from a personal link (`?g=…`), your details pre-fill. Choose **Attending**, set party **2**, enter the 2nd guest's name (and meal if asked), submit | Inline validation enforces party 1–20, requires each additional guest's name, and a required meal if configured; on success a **confirmation** screen | `POST /api/v1/public/events/<slug>/rsvp` (the atomic `submit_rsvp`) |
| 4 | — | (As guest) try to RSVP again with the **same email** | Friendly **"An RSVP with this email already exists…"** message (no duplicate created) | duplicate-email guard |
| 5 | Organizer dashboard | (As organizer) watch the RSVPs tab | The guest's response appears **live** and the counts update (ties to Journey 3) | realtime broadcast |

**Part B — Receive the ticket (QR)**

| # | Screen / Step | Action | Expected result | Behind the scenes |
|---|---|---|---|---|
| 6 | Organizer → Seating | (As organizer) assign **Alex Smith** (attending) to a table | Seat assigned; the system **emails the guest a QR ticket** | `assign_seat` auto-fires `sendQRTicketEmail` |
| 7 | Guest inbox | (As guest) open the ticket email | Email **"Your Ticket & Table Assignment: <event>"** shows the **table name** and a scannable **QR code** | signed ticket token → QR image |
| 7a | `/<event-link>/rsvp` | *(Optional)* the guest searches their name to view their table on the page | Their assigned table is shown (their own party only — never other guests) | `…/seating/guest/<guestId>` |

**Part C — Check-in at the venue**

| # | Screen / Step | Action | Expected result | Behind the scenes |
|---|---|---|---|---|
| 8 | `/checkin` (door staff) | (As organizer) open the check-in page and select the event | The scanner page loads with a **camera scanner** + a manual token box and an **arrivals** counter | `GET /api/v1/events` then `…/stats` |
| 9 | `/checkin` | Scan the guest's QR (camera) **or** paste the ticket token | Success overlay: **"<name> checked in"** with their **table** and **party size**; **Total Arrivals** increases by 1 | `POST /api/v1/events/<id>/checkin/scan` |
| 10 | `/checkin` | Scan the **same** QR again | Blocked: **"Guest already checked in"** (shows the original time) | duplicate → `409 ALREADY_CHECKED_IN` |
| 11 | `/checkin` | Scan a QR issued for a **different** event | Blocked: **"This ticket belongs to a different event."** | `EVENT_MISMATCH` |
| 12 | `/checkin` | *(Fallback)* search the guest **by name** and tap **Check In** (no QR) | Guest is checked in; arrivals count increases | `…/checkin/search` then `POST …/checkin/manual` |

### 4.3 Acceptance criteria (Pass/Fail)
- ✅ The guest can open and submit the RSVP from **both** the email button **and** the public link.
- ✅ Validation prevents invalid party sizes, missing additional-guest names, and missing required meals.
- ✅ Submitting twice with the same email is rejected gracefully (no duplicate).
- ✅ A seated guest **receives a QR ticket email** showing their table.
- ✅ A valid QR checks the guest in **once**, and the arrivals counter increases.
- ✅ A second scan of the same ticket is rejected; a wrong-event ticket is rejected.
- ✅ Manual (by-name) check-in works as a fallback when there's no QR.
- ❌ **Fail** if: the invite link doesn't resolve, the RSVP can't be submitted, no ticket arrives after seating, a valid QR fails to check in, or a duplicate / wrong-event scan is **accepted**.

### 4.4 Client sign-off checklist — Guest Experience
| Check | Pass | Fail | Notes |
|---|:--:|:--:|---|
| Guest received the invitation (email and/or SMS) | ☐ | ☐ | |
| Guest could RSVP from the email button (token link) | ☐ | ☐ | |
| Guest could RSVP from the public event link | ☐ | ☐ | |
| Form validation worked (party size / names / meal) | ☐ | ☐ | |
| Duplicate RSVP (same email) was blocked politely | ☐ | ☐ | |
| Seated guest received a QR ticket with their table | ☐ | ☐ | |
| Valid QR checked the guest in; arrivals count rose | ☐ | ☐ | |
| Re-scan blocked as "already checked in" | ☐ | ☐ | |
| Wrong-event ticket was rejected | ☐ | ☐ | |
| Manual by-name check-in worked as a fallback | ☐ | ☐ | |

---

## B. Cross-journey / general UX acceptance
| Check | Pass | Fail | Notes |
|---|:--:|:--:|---|
| Pages load in a reasonable time (no long hangs) | ☐ | ☐ | |
| Error messages are clear and non-technical | ☐ | ☐ | |
| Nothing charges real money (Stripe test mode confirmed) | ☐ | ☐ | |
| Works on the browsers we agreed to support | ☐ | ☐ | |
| Mobile layout is usable (if in scope) | ☐ | ☐ | |

---

## C. Defect log (raise anything that failed)
| # | Journey & step | What you did | What you expected | What happened | Severity (Low/Med/High) |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

---

## D. Final UAT sign-off

By signing below, the client confirms the four core journeys (Create Event, Buy SMS Credits, Track RSVPs, and the Guest Experience) meet the agreed requirements and the experience is **acceptable for launch**, subject to any defects logged above.

| | Name | Signature | Date | Decision |
|---|---|---|---|---|
| **Client / Stakeholder** | | | | ☐ Accept  ☐ Accept with conditions  ☐ Reject |
| **Project / Dev lead** | | | | |

**Conditions / notes:**
`______________________________________________________________________`

---

## Appendix — Resetting test data between runs

UAT creates real rows (events, RSVPs, seating, check-ins, SMS wallet/ledger, and **test-mode** payments). Use the lightest reset that fits — most of the time you don't need a full wipe.

### 1. Quick reset (the client can do this) — delete the test event
On the **dashboard**, open the test event and choose **Delete event**. This removes the event **and everything attached to it** — its RSVPs, tables, seating, check-ins, SMS wallet & history, and payment records — in one step (the database cascades the deletion). The event's link/slug becomes free to reuse.
> *Behind the scenes:* `DELETE /api/v1/events/<id>`; foreign keys are `ON DELETE CASCADE`.

### 2. Re-test check-in without deleting the guest
A scanned ticket can't be scanned twice (that's the point). To re-run a check-in for the **same** guest, use **Undo check-in** on the check-in page, then scan again.
> *Behind the scenes:* `POST /api/v1/events/<id>/checkin/undo`.

### 3. Always use **unique emails** for test guests
The system blocks a second RSVP with the same email on one event (by design). To create many test guests quickly, use **plus-addressing** on one inbox: `you+guest1@gmail.com`, `you+guest2@…`, etc. — they all arrive in `you@gmail.com` but count as distinct guests.

### 4. Payments, SMS & email are in **test mode**
- **Payments:** the test card charges **no real money**. Test transactions show up only in Stripe's **Test** dashboard and can be ignored or cleared there — they never touch live finances.
- **SMS/email:** with no provider keys on staging, messages are **simulated** (logged, not sent), so you can run the journeys freely. When keys *are* configured, real messages send — keep using your own inbox/number for test guests.

### 5. Full clean slate (ask the dev team)
For a from-scratch environment — e.g. before a formal sign-off run — the dev team can reset the whole test database:
- restart the local stack so all migrations re-apply, **or**
- run the maintenance script **`supabase/clean_database.sql`** against the staging database.

This clears **all** events, guests, payments and history at once. Only do this on a **staging/test** database, never production.

### 6. Suggested reset cadence
| Situation | Recommended reset |
|---|---|
| Re-running one journey | Delete just that test event (Appendix 1) |
| Re-testing a check-in | Undo check-in (Appendix 2) |
| Starting a fresh full UAT pass | Ask the dev team for a clean slate (Appendix 5) |

