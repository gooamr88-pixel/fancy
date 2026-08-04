# Fancy RSVP — SMS System Reference

**Audience:** anyone who needs to understand how text messaging works here — support,
sales, finance, or a developer touching it for the first time. It assumes **no prior
knowledge of SMS**.

**Last updated:** 2026-08-05

---

## 1. The one-paragraph version

An organizer creating an event can add **text messaging** as a paid extra, on any plan,
in the same checkout as their licence. The system works out how many messages they need
and quotes a price; they can adjust it freely. Buying it unlocks seven kinds of message
and credits the event with a **message balance**. Messages are spent automatically as the
event runs — confirmations, reminders, entry passes — and manually when the organizer
writes an announcement. **A guest is only ever texted if they personally agreed to it.**
If the balance runs low the organizer is warned in time to top up; if it runs out,
everything continues by email.

---

## 2. Vocabulary

The product never shows a customer any of the left-hand column. This table is for
**internal readers only**.

| Internal term | What we show the customer | Why it matters |
|---|---|---|
| **Segment** | "message" | The billing unit. 160 plain-English characters. A 200-character text is **two** and costs twice as much. |
| **GSM-7** | — | The encoding that fits 160 characters per segment. |
| **UCS-2** | "Arabic messages use about twice as many" | Any Arabic, emoji or accent drops a segment to **70** characters. This is the single biggest surprise in SMS costs. |
| **Credit / allowance / wallet** | "messages", "messages left" | Same thing. The database still says `credits`; the UI never does. |
| **E.164** | — | `+15551234567`. Twilio rejects anything else; we normalize on input. |
| **Add-on** | "text messaging" | The paid extra. |
| **Toll-free number** | — | The `+1 8XX…` number we send from, *verified* with the carriers — which is why the compliance rules in §9 are not optional. |
| **STOP** | "They replied STOP" | The universal opt-out word. Legally binding, immediate, permanent. |
| **TCPA** | — | US law on automated texts. Per-message statutory penalties. This is why consent is enforced so hard. |

> **The most common misunderstanding:** "message" and "segment" are not the same. The
> balance is denominated in segments; we call them messages for clarity. A long or Arabic
> message consumes more than one.

---

## 3. Who is involved

```
┌──────────┐  real money   ┌────────┐   balance    ┌────────┐   text    ┌───────┐
│ ORGANIZER│ ────────────► │ STRIPE │ ───────────► │ TWILIO │ ────────► │ GUEST │
│(customer)│               │        │              │        │           │       │
└──────────┘               └────────┘              └────────┘           └───────┘
      ▲                                                  │                   │
      │                                                  │ delivery receipt  │ STOP
      └────────── cannot send without ───────────────────┴───────────────────┘
                  the GUEST's consent
```

**Stripe and Twilio never talk to each other.** The bridge is an internal currency — the
**message balance** in `sms_credit_wallets`. Stripe turns money into balance; Twilio turns
balance into delivered texts.

There is a second currency money cannot buy: **consent**. The organizer owns the balance;
the guest owns the permission. Both are required for a single message.

---

## 4. The seven message types

| # | Type | Goes to | When | Default | Email too? |
|---|---|---|---|---|---|
| 1 | RSVP confirmation | Guest | Instantly on response | On | **Yes** — the email carries the scannable pass |
| 2 | RSVP reminder | Guest (no reply) | ~3 days before the deadline | On | No — the text replaces it |
| 3 | Event reminder | Guest (attending) | ~3 days before, with table number | On | No — the text replaces it |
| 4 | Entry pass link | Guest (attending) | When the organizer re-sends a pass | On | **Yes** — SMS cannot carry a QR image |
| 5 | Decline acknowledgement | Guest (declined) | Instantly | **Off** | No — the text replaces it |
| 6 | Organizer alerts & reports | **The organizer** | Final headcount, ~24h before | On | **Yes** — the email has the numbers |
| 7 | Custom announcement | Guest (chosen groups) | Whenever they send one | On | n/a — no email equivalent |

Defined once in [`backend/config/smsMessageTypes.js`](../backend/config/smsMessageTypes.js).
Each has its own switch on the organizer's Messages page.

**Why #5 is off by default:** the guest has just said they aren't coming. A charged text
saying "thanks anyway" is the one type that reliably reads as unwanted.

**Why #1 and #4 don't both fire on submission:** the RSVP confirmation already carries the
pass link. Sending both would put two texts on one phone and charge twice for one event.
Type 4 exists for the explicit "re-send their pass" action.

**Why some types send an email too:** a text cannot contain an image, a button or a table.
Where the email carries something SMS structurally cannot, both go out. Everywhere else
the text replaces the email — one message per guest, charged once.

---

## 5. Who actually receives a text

**One person per invitation — the primary contact.**

A family of six who RSVP'd together is **one** party with **one** primary contact. They get
one text, not six. Companions have no phone numbers in the system at all.

A guest is texted only when **all** of these hold:

1. The event bought text messaging
2. That message type is switched on
3. This exact message hasn't already been sent *(idempotency on `kind` + `ref`)*
4. The party has recorded consent
5. The primary contact has a phone number
6. That number hasn't replied STOP
7. The balance has enough left
8. Twilio is configured and reachable

Any failure and **the guest still hears from us by email**. Nothing is silently dropped,
and the reason is recorded.

### The four ways consent is obtained

| Route | Who acts | Recorded as |
|---|---|---|
| RSVP form checkbox (wizard) | The guest | `guest_optin` |
| RSVP form checkbox (full-page template) | The guest | `guest_optin` |
| Organizer confirms when adding/importing | The organizer | `host_attested` |
| Public `/sms-opt-in` page | The person themselves | `guest_optin` |

**Precedence:** a guest's own decision always outranks an organizer's claim. An attestation
can only ever apply to a party that has **never** recorded a decision.

**Consent is per event. STOP is global.** Consenting on one event says nothing about
another; STOP silences that number across every event, permanently, until they text START.

**Consent follows the number, not the party.** Editing a guest's phone number automatically
revokes consent — the new number's owner never agreed to anything. The organizer can
immediately re-confirm if they do hold that permission.

---

## 6. Money

### 6.1 Buying

The organizer picks their plan at event creation. On that same screen:

1. The system estimates how many messages the event needs, from the plan's guest cap
2. It states the number and the price — **the recommendation is the headline, not a slider**
3. They can adjust freely; choosing less produces a warning, never a block
4. It joins the **same Stripe checkout** as the licence, as a second line item

One payment, two lines on the receipt. Free-tier plans get an SMS-only checkout, so no
plan is a dead end.

### 6.2 The estimate

```
contactable guests = plan guest cap ÷ 2.2      (invitations go to households, not heads)
messages           = contactable guests × per-type frequency
segments           = messages × 1.4 (Latin)  or  × 2.6 (Arabic)
```

Worked example, a 200-guest plan in English:

| | |
|---|---|
| 200 ÷ 2.2 | ≈ **91 contactable guests** |
| RSVP confirmation (1 each) | 91 |
| RSVP reminder (~0.6 each) | 55 |
| Event reminder (~0.7 each) | 64 |
| Entry pass (~0.7 each) | 64 |
| Announcements (2 each) | 182 |
| Organizer alerts | 3 |
| **Total messages** | **≈ 459** |
| × 1.4 | **≈ 640 segments** |
| Recommended | **650** *(rounded to a sellable step)* |

The same event in Arabic needs roughly **1,200**. The purchase screen says so.

**Every number in that calculation is admin-editable** — see §8.

### 6.3 Price

```
price = messages × base rate × (1 + Fancy's markup)   − the best matching volume discount
```

Computed by [`computeSmsChargeCents`](../backend/utils/pricing.js) — one function, used
identically for the initial purchase, the top-up, and the admin's preview.

**Volume discounts are tiered and never cumulative:** a customer gets the single best tier
they qualify for. Stacking is how a discount table quietly reaches 100% off.

### 6.4 Spending

**1 segment = 1 unit of balance**, deducted the moment the message is handed to Twilio, in
one atomic row-locked transaction. Every send carries an idempotency key, so a retry at any
layer cannot double-charge.

### 6.5 Refunds — three independent paths

| Trigger | What happens |
|---|---|
| Twilio rejects it immediately | Balance refunded within milliseconds |
| Carrier reports `failed`/`undelivered` later | Webhook → balance refunded automatically |
| Organizer gets a Stripe refund | Purchased balance is deducted |

An organizer is never charged for a message that did not arrive.

### 6.6 Running low, and running out

- At **20% remaining** (admin-editable): one email, plus a banner on their Messages page.
- At **zero**: one more email, confirming that guests are now reached by email instead.

Each fires **once per depletion**. The stamps clear on top-up, so the next depletion warns
again. If an alert fails to send, the claim is released and the next flush retries it —
`email_log` prevents a retry from ever double-mailing a delivered alert.

**Topping up** is available from the Messages page, the sidebar, the low-balance banner and
the empty state, and **the price is always shown before payment**.

---

## 7. Sending limits for new accounts

| Delivered so far | Max per send |
|---|---|
| 0 – 199 | 50 |
| 200 – 999 | 500 |
| 1,000+ | unlimited |

This caps a **single send, never the total** — an organizer limited to 50 can still reach
300 guests in six goes, and the message says so.

Keyed on delivered volume rather than account age or payment history deliberately: age
punishes the organizer whose wedding is next week while a patient abuser just waits;
payment history caps every first-time customer on the one event they most need. Delivered
volume is the only signal that rises through genuine use and stays flat for a throwaway
account.

All bands are admin-editable. The check **fails open** — it is abuse friction, not an
entitlement check, and every gate protecting consent or billing already fails closed.

---

## 8. What the super admin controls

**System Configuration → SMS Pricing.** Every value is editable without a deploy, and no
control appears without its consequence shown beside it.

| Control | |
|---|---|
| Carrier cost per message | What Twilio charges us |
| Fancy markup % | Our margin |
| Volume discount tiers | Unlimited tiers; add, edit, remove |
| Purchase min / max / step | Bounds on a single order |
| Guests per invitation | The `÷ 2.2` above |
| Segments per message | Latin and Arabic, separately |
| Messages per invitation, per type | The seven frequencies the estimate is built from |
| Sending limit bands | The ramp-up in §7 |
| Low-balance warning threshold | Default 20% |

Alongside them, computed **server-side by the same function that charges the customer**:

- a **margin header** — cost / markup / sell price / gross margin, red on a loss
- a **price table** with rows either side of every discount threshold, so the step is visible
- a **per-plan preview** of exactly what each tier's customer is quoted, in both scripts

Bad input is **clamped, not rejected** — a 100% discount caps at 90%, an inverted min/max
swaps — and what was adjusted is reported back. Rejecting the save would leave an admin
unable to fix a bad row through the UI.

**Admin → Finance → Text messaging** answers "is this a business?": SMS revenue, Twilio
cost, net profit, margin, and the heaviest events. Cost is recorded per send, so this is
measured rather than estimated — and where older sends have no cost recorded, the panel
says so instead of showing an inflated profit.

---

## 9. Compliance — why the rules are strict

Our toll-free number is **verified** with the US carriers on the basis of specific promises
about how we obtain consent. Breaking them risks deregistration, which would stop SMS for
**every customer at once**.

1. **Consent is separate and optional.** The checkbox is never required to RSVP, register
   or attend, and never bundled with accepting Terms or a Privacy Policy.
2. **The wording is fixed** and lives in one component, version-stamped on every record so
   we can always prove what someone agreed to.
3. **Every message identifies us and carries opt-out instructions**, appended automatically:
   `- Fancy RSVP. Msg&data rates may apply. Reply STOP to opt out, HELP for help.`
4. **STOP works instantly, globally and permanently.**
5. **Every consent decision is logged append-only** — including refusals, because a dated
   refusal is evidence that consent was asked for separately and freely declined.

> Paying unlocks the *ability* to send. It does not buy permission. No amount of money, and
> no organizer attestation, lets us text someone who declined.

---

## 10. Troubleshooting

### "My guests didn't get the text"

The Messages page lists every text by guest name with what happened.

| Shown as | Meaning | Fix |
|---|---|---|
| They haven't agreed to receive texts | Never opted in | They can opt in on their RSVP form, or the organizer can confirm consent when editing them |
| They replied STOP | Opted out | Nothing — permanent unless they text START |
| No phone number on file | Not collected | Add it |
| You ran out of messages | Balance exhausted | Top up — then **Try again** resends that exact message |
| This kind of message is switched off | Organizer choice | Switch it back on |
| Text messaging is not switched on | Never purchased | Buy it |
| Texting was temporarily unavailable | Platform misconfiguration | **Engineering** — see below |

**Try again** appears only on failures the organizer can fix. It is deliberately absent for
STOP and missing consent: the button would imply it might override the guest's choice.

### "Nothing is sending at all"

Check `SMS_ENABLED=true` **and** all of `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_PHONE_NUMBER`. Any one missing disables SMS entirely — deliberately, and loudly.
The system will **not** pretend to send, and will **not** charge anyone.

### "An organizer was charged but nothing arrived"

This should be impossible: no balance is deducted without a working Twilio connection. If
you see it, search logs for `SMS transport unavailable` and escalate.

### "A guest got the same text twice"

Also should be impossible — every automated message is deduplicated on `kind` + `ref`, and
billing is idempotent per message. Check `sms_log` for two rows with the same pair.

---

## 11. Where things live

| Concern | File |
|---|---|
| Message type catalogue | `backend/config/smsMessageTypes.js` |
| Pricing model + validation | `backend/config/smsPricing.js` |
| Send logic (all types) | `backend/services/smsDispatch.js` |
| Message wording | `backend/utils/smsTemplates.js` |
| Balance in customer terms | `backend/utils/smsUsage.js` |
| Allowance estimator | `backend/utils/smsEstimator.js` |
| Price maths | `backend/utils/pricing.js` |
| Access + send limits | `backend/middleware/smsAddonGate.js` |
| Campaigns, settings, log, resend, webhooks | `backend/controllers/campaignController.js` |
| Purchase | `backend/controllers/paymentController.js` |
| Crediting the balance | `backend/services/paymentFulfillment.js` |
| SMS P&L | `backend/controllers/admin/financeController.js` |
| Guest-facing consent wording | `frontend/src/app/components/guest/SmsConsentText.js` |
| Purchase UI | `frontend/.../create-event/components/StagePayment.js` |
| Organizer Messages page | `frontend/src/app/dashboard/campaigns/page.js` |
| Admin pricing controls | `frontend/src/app/admin/(panel)/config/page.js` |

**Tables:** `sms_credit_wallets` (balance) · `sms_credit_ledger` (every purchase, charge and
carrier cost) · `sms_consent_log` (append-only consent history) · `sms_opt_outs` (global
STOP list) · `sms_log` (every send attempt and why it was skipped) ·
`events.sms_settings` (per-type switches) · `super_admin_config.sms_pricing_config` (the
whole pricing model).

**Migrations, in order:** `20260809000000` compliance · `20260811010000` consent log ·
`20260812010000` host attestation · `20260818000000` the add-on · `20260819000000` pricing
config · `20260820000000` usage, limits and analytics.

---

## 12. Quick answers

**Can a guest be texted without agreeing?** No.

**Does a bigger plan include SMS?** No — it's a separate purchase, available on every plan
including free ones.

**Can messages move between events?** No. Each event keeps its own balance.

**What if an organizer buys too few?** Nothing breaks. They're warned at 20%, email takes
over at zero, and they can top up at any time.

**Does Arabic really cost double?** Yes — roughly 2–3×. It's how carriers encode non-Latin
text, not a Fancy charge.

**Do we make money on SMS?** Yes: a configurable markup on every message. Admin → Finance
shows exactly how much.

**Can an organizer text people who never RSVP'd?** Only if they confirmed, per guest, that
they hold that person's permission — recorded, dated and attributed to them.

**Can a new account spam?** Not in bulk. See §7.

**What happens if we change the price?** Only future purchases are affected. Balances
already bought are unaffected.
