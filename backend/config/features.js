/**
 * Platform feature flags — a single, env-driven source of truth for toggling
 * paid integrations on/off WITHOUT removing any code.
 *
 * Why: before go-live we run on test/no keys. Card payments (Stripe) and real
 * SMS (Twilio) must be cleanly disabled — the app stays fully functional on the
 * manual-payment path — and flipped back on by setting the env flags + live keys,
 * with no code changes and no rebuild.
 *
 * Defaults are OFF (safe): nothing real fires until explicitly enabled.
 *
 *   PAYMENTS_STRIPE_ENABLED=true   + STRIPE_SECRET_KEY set  → card checkout live
 *   SMS_ENABLED=true               + TWILIO_* set           → real SMS sends live
 */

const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v == null ? '' : v).trim());

/**
 * Card payments via Stripe (event-fee checkout + SMS-credit checkout + refunds
 * of card payments). Requires BOTH the flag AND a secret key so a half-configured
 * environment can never accidentally go live.
 */
function stripeEnabled() {
  return truthy(process.env.PAYMENTS_STRIPE_ENABLED) && !!process.env.STRIPE_SECRET_KEY;
}

/**
 * Real outbound SMS via Twilio. When false, every send path falls back to the
 * existing mock mode (logged, never dispatched) — no code is bypassed or removed.
 */
function smsEnabled() {
  return truthy(process.env.SMS_ENABLED);
}

module.exports = { stripeEnabled, smsEnabled };
