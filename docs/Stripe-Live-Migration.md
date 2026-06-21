# Fancy RSVP — Complete Stripe Live Mode Migration Report

**Status:** Operations runbook for Test → Live cutover
**Scope:** Event Activation fees + Twilio SMS Credit purchases
**Prepared for:** Deployment day
**Constraint honored:** No application logic or files were modified to produce this report. This is analysis + procedure only.

---

## 0. Executive Summary & Architecture-Specific Caveats

Before the matrices, three facts about *your* implementation override the generic Stripe-migration playbook. Acting on the generic assumptions would waste effort or break the cutover.

| Common assumption | Reality in this codebase | Consequence |
|---|---|---|
| Frontend needs `pk_live_…` publishable key | **No publishable key is used anywhere.** Checkout sessions are created server-side; the browser only does `window.location.href = checkoutUrl` ([EventsTab.js:326](../frontend/src/app/dashboard/components/EventsTab.js#L326)). No `loadStripe`, no Stripe.js. | **No `pk_` variable to migrate.** Skip it. |
| Products/Prices are pre-created; migrate the `price_id`s | **Pricing is fully dynamic / inline.** Every session uses `price_data` + `product_data` with `unit_amount` computed at request time from `super_admin_config` ([paymentController.js:142](../backend/controllers/paymentController.js#L142), [:243](../backend/controllers/paymentController.js#L243)). | **There are zero stored `price_id`/`product_id` values** in code or DB. Nothing to recreate in the Live Products catalog. See §3. |
| Live webhook secret looks like `whsec_live_…` | Live signing secrets are just `whsec_…`. The mode is determined by *which dashboard issued it*, not a prefix. | Don't search for a `_live_` infix; you won't find one. |
| Stripe Customer IDs carry over between modes | They **do not**. `organizations.stripe_customer_id` holds Test-mode `cus_…` values. | **This is the single highest-risk DB item.** A Test `cus_…` sent to a Live key throws `No such customer`. See §3. |

**The real migration surface for your app is therefore small and precise:**
1. Two env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) + Twilio live credentials.
2. One Live webhook endpoint with the correct 5 event types subscribed.
3. One DB cleanup: null out `organizations.stripe_customer_id`.

---

## 1. Environment Variables Matrix

These are the variables actually read by the running code (verified against `process.env` references in `backend/`).

### 1.1 Stripe (must change for Live)

| Variable | Read at | Test value | Live value | Notes |
|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | [paymentController.js:2](../backend/controllers/paymentController.js#L2), [stripeRefundService.js:1](../backend/services/stripeRefundService.js#L1) | `sk_test_…` | `sk_live_…` | App throws at boot if missing ([paymentController.js:3](../backend/controllers/paymentController.js#L3)). The **only** Stripe API credential the app uses. |
| `STRIPE_WEBHOOK_SECRET` | [paymentController.js:280](../backend/controllers/paymentController.js#L280) | `whsec_…` (from Test endpoint) | `whsec_…` (from the **Live** endpoint — different value) | Listed in `REQUIRED_ENV` ([app.js:11](../backend/app.js#L11)); boot fails if absent. There is **one** secret per endpoint — generate it when you create the Live endpoint (§2). |

> **Not present / not needed:** `STRIPE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_STRIPE_*`. Your integration is server-redirect only. Do **not** add one expecting it to be used.

### 1.2 Twilio (SMS credits delivery)

Important: Twilio does **not** have a Stripe-style "test key → live key" switch. It has (a) a single live Account SID/Auth Token and (b) optional **Test Credentials** + **magic phone numbers** used only to simulate sends. Your code defaults the from-number to `+15005550006`, which is a **Twilio magic test number** ([twilioClient.js:27](../backend/utils/twilioClient.js#L27)). Going live means using your real Account SID/Auth Token and a **purchased, SMS-capable** number.

| Variable | Read at | Test / Dev value | Live value | Notes |
|---|---|---|---|---|
| `TWILIO_ACCOUNT_SID` | [twilioClient.js:8](../backend/utils/twilioClient.js#L8) | Test Credentials SID (`AC…`) or unset (mock mode) | Live `AC…` SID | If unset, code silently runs **mock mode** and logs SMS to console ([twilioClient.js:11-14](../backend/utils/twilioClient.js#L11)) — a real risk: a missing live value means credits get charged but no SMS sends. |
| `TWILIO_AUTH_TOKEN` | [twilioClient.js:9](../backend/utils/twilioClient.js#L9) | Test auth token | Live auth token | Must pair with the live SID (both-or-neither). |
| `TWILIO_PHONE_NUMBER` (preferred) or `TWILIO_FROM_NUMBER` (fallback) | [twilioClient.js:27](../backend/utils/twilioClient.js#L27) | `+15005550006` (magic) | Your purchased E.164 number, e.g. `+1XXXXXXXXXX` | If both unset it **falls back to the magic test number** — which will not deliver real SMS. Set this explicitly in Live. |

### 1.3 Supporting vars that gate a correct cutover (not Stripe/Twilio, but required for the payment flow to behave in production)

| Variable | Read at | Why it matters for this migration |
|---|---|---|
| `FRONTEND_URL` | [app.js:30](../backend/app.js#L30), [paymentController.js:14](../backend/controllers/paymentController.js#L14), [csrf.js:22](../backend/middleware/csrf.js#L22) | Doubles as the **CORS allowlist** *and* the **Checkout return-URL allowlist** (`resolveReturnBase`, [paymentController.js:28-42](../backend/controllers/paymentController.js#L28)). Must be the production HTTPS origin(s), comma-separated. If a prod origin is missing here, users get bounced to the fallback origin after paying and effectively log out (see the comment at [paymentController.js:19-27](../backend/controllers/paymentController.js#L19)). |
| `BREVO_API_KEY` / `BREVO_FROM_EMAIL` / `BREVO_FROM_NAME` | [notificationService.js:15-17](../backend/utils/notificationService.js#L15) | Payment receipt / activation emails (e.g. `manualCashApproval`). Use production sender identity. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | [config/supabase.js:9-10](../backend/config/supabase.js#L10) | Confirm these point at the **production** project — the DB cleanup in §3 must run against the same project the live app reads. |
| `NODE_ENV` | multiple | `production` (already set in [ecosystem.config.js:18](../ecosystem.config.js#L18)). Affects cookie `Secure`/`SameSite` in auth middleware. |

---

## 2. Stripe Dashboard Configuration (Live Mode)

Do all of this with the **dashboard toggle set to "Live mode"** (top-left). Test-mode objects are invisible to Live keys and vice versa.

### 2.1 Activate the Live account
1. Complete Stripe **account activation** (business details, bank account, identity) — required before any `sk_live_` charge succeeds.
2. Confirm payout currency is **USD** — your sessions hard-code `currency: 'usd'` ([paymentController.js:143](../backend/controllers/paymentController.js#L143), [:245](../backend/controllers/paymentController.js#L245)). No code change needed; just confirm the account supports USD settlement.

### 2.2 Create the Live API key
1. **Developers → API keys** (Live mode) → reveal/create the **Secret key** (`sk_live_…`).
2. Place it in the production secret store as `STRIPE_SECRET_KEY`. Do **not** commit it.

### 2.3 Create the Live Webhook endpoint
Your handler verifies signatures and is mounted at a fixed path with a **raw body** ([app.js:55-56](../backend/app.js#L55), route [paymentRoutes.js:8](../backend/routes/paymentRoutes.js#L8)).

1. **Developers → Webhooks → Add endpoint** (Live mode).
2. **Endpoint URL:**
   ```
   https://<your-production-api-domain>/api/v1/payments/webhook
   ```
   - Must be **HTTPS** and publicly reachable.
   - The path is exact — `app.js` only captures `req.rawBody` for URLs starting with `/api/v1/payments/webhook` ([app.js:55](../backend/app.js#L55)). A different path → signature verification fails because the body was JSON-parsed instead of raw.
3. **Events to send** — subscribe to **exactly these 5**, which are the only types the handler acts on ([paymentController.js:300-306](../backend/controllers/paymentController.js#L300)):
   - `checkout.session.completed`  → fulfillment (event activation + SMS credits)
   - `charge.refunded`             → reverts payment/activation, deducts SMS credits
   - `charge.dispute.created`
   - `charge.dispute.updated`
   - `charge.dispute.closed`
   > Subscribing to extra types is harmless (handler ignores them and returns `{received:true}`), but keep it tight to reduce noise.
4. **API version:** accept the account default. Your code reads only stable, long-standing fields (`session.id`, `payment_intent`, `amount_total`, `currency`, `metadata`, `charge.payment_intent`, `dispute.*`), so no version pinning is required.

### 2.4 Capture the Live Webhook Signing Secret
1. Open the newly created Live endpoint → **Signing secret** → reveal (`whsec_…`).
2. Set it as `STRIPE_WEBHOOK_SECRET` in the production secret store.
3. This value is **distinct** from your Test endpoint's secret. If you ever run more than one endpoint (e.g. a separate disputes consumer), each has its own secret — but your single handler expects one secret, so use **one Live endpoint**.

### 2.5 Products & Prices — **No action required**
Because pricing is generated inline per request (`price_data`/`product_data`), you do **not** need to create any Products or Prices in the Live catalog. The Live dashboard's Products page can stay empty. Stripe will auto-create ad-hoc product entries from the `product_data.name` strings (`"Fancy RSVP - <Tier> License"`, `"Fancy RSVP - SMS Credits (<n> Pack)"`) at charge time — this is expected and needs no configuration.

> If you *want* a clean Products catalog for reporting, that is an optional enhancement to the code (switch to `price` IDs), **out of scope** for this no-code-change cutover and explicitly excluded by your brief.

### 2.6 (Recommended) Configure Live-mode operational settings
- **Radar rules / fraud:** review default Radar rules for Live; Test mode never blocks.
- **Customer emails / receipts:** decide whether Stripe sends its own receipts (you also send Brevo receipts for manual approvals; avoid double-emailing for card payments if you enable Stripe receipts).
- **Statement descriptor:** set a recognizable descriptor so cardholders don't dispute unfamiliar charges (reduces `charge.dispute.created` volume).

---

## 3. Database & Code References — what actually changes

### 3.1 Price IDs / Product IDs — **none exist**
A repo-wide check confirms there is **no `price_id` or `product_id` stored** in code or DB. The flows:
- **Event fee:** `unit_amount: tier.price_cents` from `super_admin_config.pricing_tiers` ([paymentController.js:144-148](../backend/controllers/paymentController.js#L144)).
- **SMS credits:** `unit_amount: totalCents` computed by `computeSmsChargeCents(...)` from `super_admin_config.sms_rate_cents_per_credit` and `sms_markup_percentage` ([paymentController.js:205-209](../backend/controllers/paymentController.js#L205), [:243-253](../backend/controllers/paymentController.js#L243)).

These pricing values live in the **`super_admin_config`** singleton row (`id = 00000000-0000-0000-0000-000000000000`, [paymentController.js:535](../backend/controllers/paymentController.js#L535)). They are **currency amounts in cents and are mode-independent** — they carry over to Live unchanged. **No swap needed.** Just verify the production `super_admin_config` row has the prices you intend to charge real money for (via the admin Pricing screen → `updatePricingConfig`).

### 3.2 The one real mode-bound DB value: `organizations.stripe_customer_id`
This is **the** migration-critical item.

- It is populated with **Test-mode** `cus_…` IDs during test runs ([paymentController.js:120-135](../backend/controllers/paymentController.js#L120)).
- Both flows reuse it: event checkout passes it as `customer` ([:139-140](../backend/controllers/paymentController.js#L139)); SMS purchase **requires** it and errors `NO_STRIPE_CUSTOMER` if absent ([:226-234](../backend/controllers/paymentController.js#L226)).
- A Test `cus_…` sent with a Live `sk_live_` key → Stripe error **`No such customer`** → checkout creation fails.

**Required cleanup (run once, against the production DB, at cutover):**

```sql
-- Clear Test-mode Stripe customer IDs so the Live flow recreates them on first charge.
-- createCheckoutSession auto-creates a fresh Live cus_… when this is NULL.
UPDATE organizations
SET    stripe_customer_id = NULL
WHERE  stripe_customer_id IS NOT NULL;
```

Behavior after this:
- **Event checkout** transparently recreates a Live customer on the org's next payment ([paymentController.js:121-135](../backend/controllers/paymentController.js#L121)) — no user impact.
- **SMS-credit purchase** intentionally blocks with `NO_STRIPE_CUSTOMER` until that org has completed at least one event payment ([:228-234](../backend/controllers/paymentController.js#L228)). This is existing, correct behavior — just be aware customers must do an event payment first in Live, exactly as in Test.

> If production has **never** processed Test charges (fresh DB), this column is already NULL and the statement is a no-op — run it anyway; it's safe and idempotent.

### 3.3 Historical Stripe references in payment tables — leave as-is
`event_payments` (`stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_refund_id`) and `sms_credit_ledger` (`stripe_payment_intent_id`) may contain **Test** `cs_…`/`pi_…`/`re_…` strings from QA. These are inert historical records:
- Live webhooks carry Live intent IDs, which won't collide with stored Test IDs (idempotency lookups simply won't match old rows — correct).
- **Recommendation:** if this is a shared DB that also held UAT data, consider archiving/cleaning test `event_payments`/`sms_credit_ledger` rows so financial reporting doesn't mix test and real money. Optional, and a data-hygiene decision — not required for correctness.

### 3.4 No code edits required
Every Stripe/Twilio value the code needs comes from `process.env` or `super_admin_config`. The cutover is **configuration + one SQL statement**, consistent with your "do not alter files" constraint.

---

## 4. Production Readiness & Pre-Flight Checklist

Run top-to-bottom on deployment day. Each item is verifiable.

### 4.1 Secrets & environment
- [ ] `STRIPE_SECRET_KEY` = `sk_live_…` in prod secret store (not in git, not in `ecosystem.config.js`).
- [ ] `STRIPE_WEBHOOK_SECRET` = the **Live endpoint's** `whsec_…` (from §2.4).
- [ ] `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` = **live** credentials (not test, not blank → else silent mock mode).
- [ ] `TWILIO_PHONE_NUMBER` = purchased, SMS-capable E.164 number (not `+15005550006`).
- [ ] `BREVO_*` = production sender; from-address domain authenticated (SPF/DKIM) so receipts don't spam-folder.
- [ ] `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` = **production** project (the same DB the SQL in §3.2 was run against).
- [ ] All seven `REQUIRED_ENV` present ([app.js:11](../backend/app.js#L11)) — the app **refuses to boot** otherwise; confirm a clean start in logs.

### 4.2 Database
- [ ] `UPDATE organizations SET stripe_customer_id = NULL …` executed (§3.2) and verified (`SELECT count(*) FROM organizations WHERE stripe_customer_id IS NOT NULL;` → `0`).
- [ ] `super_admin_config` pricing (`pricing_tiers`, `sms_rate_cents_per_credit`, `sms_markup_percentage`) reflects **real** intended charges — you are now billing real cards.
- [ ] Required migrations applied (notably `20260616300000` for manual-payment columns, referenced by [paymentController.js:45-62](../backend/controllers/paymentController.js#L45); and `20260618000000` for the activation/`pending_review` flow).

### 4.3 HTTPS & networking
- [ ] Production API served over **HTTPS** with a valid cert (required for the Stripe webhook and for `Secure` auth cookies).
- [ ] Webhook URL `https://<api-domain>/api/v1/payments/webhook` is reachable from the public internet (test with `curl` → expect `400 Webhook Error: …` for an unsigned request, which proves the route + signature check are live, **not** a 404/502).
- [ ] No proxy/CDN buffering or body-rewriting in front of `/api/v1/payments/webhook` — the handler needs the **exact raw bytes** for signature verification ([app.js:55-56](../backend/app.js#L55)). If behind a reverse proxy, confirm it forwards the unmodified body.

### 4.4 CORS & return URLs
- [ ] `FRONTEND_URL` contains every production browser origin (comma-separated, no trailing slash issues — code trims them, [paymentController.js:16](../backend/controllers/paymentController.js#L16)).
- [ ] Confirm post-payment redirect lands back on the **same** origin the user started on (test the full Checkout round-trip; a mismatch logs the user out — see [paymentController.js:19-27](../backend/controllers/paymentController.js#L19)).
- [ ] CORS rejects unknown origins (the allowlist callback, [app.js:31-42](../backend/app.js#L31)) — spot-check that a random origin gets blocked.

### 4.5 Webhook delivery, retries & idempotency
- [ ] In the Stripe Live dashboard, the endpoint shows **"Enabled"** and a recent successful test delivery (use **Send test webhook** → `checkout.session.completed`).
- [ ] Confirm the handler **always returns 200** even on processing error (by design — [paymentController.js:307-313](../backend/controllers/paymentController.js#L307)) so Stripe doesn't enter a retry storm; failures are logged, not surfaced as 5xx.
- [ ] Verify idempotency end-to-end with a **real low-value live charge**:
  - One event payment → exactly one `event_payments` row, event → `pending_review`, `is_paid = true` ([paymentFulfillment.js:39-55](../backend/services/paymentFulfillment.js#L39)).
  - Re-trigger the same webhook from the dashboard → **no duplicate** row (`alreadyProcessed`, unique `stripe_checkout_session_id` / `record_sms_purchase` guard).
  - The synchronous `/verify` redirect and the async webhook both fulfilling → still single-write (race handled at [paymentFulfillment.js:57-64](../backend/services/paymentFulfillment.js#L57)).
- [ ] Refund path: issue a real refund from the dashboard → `charge.refunded` reverts the event to `paused`/`is_paid=false` ([paymentFulfillment.js:135-149](../backend/services/paymentFulfillment.js#L135)); confirm no double-deduction on retry.

### 4.6 SMS (Twilio) live validation
- [ ] Confirm **not** in mock mode: trigger one real SMS send and verify it arrives on a real handset (mock mode only logs to console — [twilioClient.js:11-14](../backend/utils/twilioClient.js#L11)).
- [ ] Twilio number is provisioned for the destination geographies (and A2P 10DLC / sender registration complete for US traffic, or sends will be filtered/blocked by carriers).
- [ ] One real SMS-credit purchase → `record_sms_purchase` credits the wallet exactly once; webhook replay = `already_processed` no-op.

### 4.7 Logging & monitoring (first 24–72h)
- [ ] PM2 cluster up, logs flowing to `logs/backend-*.log` ([ecosystem.config.js:25-26](../ecosystem.config.js#L25)).
- [ ] Alert/watch for these specific log lines:
  - `CRITICAL: STRIPE_WEBHOOK_SECRET is not configured!` ([paymentController.js:282](../backend/controllers/paymentController.js#L282))
  - `Webhook signature verification failed:` ([paymentController.js:293](../backend/controllers/paymentController.js#L293)) — usually means wrong secret or a body-mutating proxy (§4.3).
  - `Stripe webhook processing error` ([paymentController.js:310](../backend/controllers/paymentController.js#L310)) — a fulfillment threw; Stripe got 200, so **these need active monitoring**, they won't auto-retry forever.
  - `Twilio credentials not set …(mock mode)` ([twilioClient.js:12](../backend/utils/twilioClient.js#L12)) — credits charged, no SMS sent.
  - `[optional-columns] … run migration 20260616300000` ([paymentController.js:58](../backend/controllers/paymentController.js#L58)) — a migration is missing.
- [ ] Stripe Dashboard → **Webhooks → endpoint → delivery attempts**: confirm success rate ~100% in the first hours; investigate any non-2xx (should be none, since the handler returns 200 on processing errors — a non-2xx means signature/routing, i.e. §4.3).
- [ ] Reconcile the first day's Stripe **Live** payouts/balance against `event_payments` + `sms_credit_ledger` to confirm money and ledger agree.

### 4.8 Rollback plan
- [ ] Keep the Test keys and the **Test webhook endpoint** intact and documented. Rollback = swap the two env vars back to Test values and restart PM2 (`pm2 reload ecosystem.config.js`). Note: any Live `cus_…`/payments created in the meantime become invisible to Test keys — rollback is for an immediate cutover failure, not after live charges have accumulated.
- [ ] Have the Stripe Live endpoint's **Disable** toggle ready as a fast kill-switch for webhook processing without a redeploy.

---

## 5. Cutover Sequence (condensed runbook)

1. Stripe Live account activated (§2.1) and **Live secret key** retrieved (§2.2).
2. Create **Live webhook endpoint** with the 5 event types (§2.3); copy its **signing secret** (§2.4).
3. Set prod env: `STRIPE_SECRET_KEY=sk_live_…`, `STRIPE_WEBHOOK_SECRET=whsec_…`, live `TWILIO_*`, correct `FRONTEND_URL`, prod `BREVO_*`/`SUPABASE_*` (§1, §4.1).
4. Run the **`stripe_customer_id` NULL** SQL against prod DB (§3.2) and verify pricing in `super_admin_config` (§4.2).
5. Deploy / `pm2 reload`; confirm clean boot (all `REQUIRED_ENV` satisfied).
6. Smoke test with a **real low-value charge**: event payment → activation; SMS-credit purchase → wallet + real SMS; one refund. Verify idempotency by replaying each webhook (§4.5–4.6).
7. Watch logs + Stripe delivery dashboard for 24–72h (§4.7).
8. Keep rollback ready (§4.8).

---

*End of report. No application code or configuration files were modified in producing this document.*
