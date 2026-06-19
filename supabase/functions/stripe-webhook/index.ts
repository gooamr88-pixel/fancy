// ─────────────────────────────────────────────────────────────────────────────
// DEPRECATED — DO NOT REGISTER THIS ENDPOINT WITH STRIPE.
//
// The canonical, single source of truth for Stripe webhooks is the Express
// backend:  POST https://<host>/api/v1/payments/webhook
//           (backend/controllers/paymentController.js → stripeWebhook, which
//            delegates to backend/services/paymentFulfillment.js)
//
// This Edge Function previously duplicated that logic with a DIFFERENT schema
// path (manual wallet/ledger writes + increment_sms_credits) that drifted out
// of sync with the backend's atomic record_sms_purchase() RPC. Running both
// against the same database caused divergent, hard-to-debug behaviour.
//
// It now refuses all calls so a stale Stripe webhook configuration fails loudly
// instead of silently writing through an out-of-date code path. To re-introduce
// an Edge-Function webhook in the future, make it call the SAME fulfillment
// routine the backend uses — never a second copy.
// ─────────────────────────────────────────────────────────────────────────────
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(() =>
  new Response(
    JSON.stringify({
      error: "GONE",
      message:
        "This webhook endpoint is deprecated. Configure Stripe to POST to /api/v1/payments/webhook instead.",
    }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
)
