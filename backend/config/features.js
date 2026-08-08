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
 *
 * Requires the flag AND every credential needed to actually dispatch, mirroring
 * stripeEnabled(). A half-configured environment used to satisfy this check and
 * then silently degrade to mock mode inside getTwilioClient() — which, before the
 * transport gate in smsDispatch.sendRecipient, meant organizers were billed for
 * messages that were never sent. Reporting "not enabled" for a configuration that
 * cannot send is the honest answer, and it surfaces at boot via systemHealth
 * rather than at the first campaign.
 */
function smsEnabled() {
  if (!truthy(process.env.SMS_ENABLED)) return false;
  // Asks the ACTIVE carrier whether it can actually send, rather than checking
  // TWILIO_* specifically — otherwise a fully-configured Vonage account would
  // report SMS as disabled, and a leftover Twilio key would report it as enabled
  // while Vonage was the one selected.
  const { resolveProvider } = require('../services/smsProviders');
  return resolveProvider().isConfigured();
}

/**
 * Allow the credit ledger to be exercised against a MOCK transport (no Twilio
 * client). OFF by default, and deliberately so: without a transport there is no
 * message, and charging a wallet for a message that was never created is the
 * single most expensive failure mode this subsystem has.
 *
 * The unit suite sets it (backend/test/helpers/env.js) because it needs to assert
 * the billing path end-to-end without a network. Nothing in production should
 * ever set it — and if something does, the ledger row is still written and
 * refundable, so the damage stays visible and reversible.
 */
function smsMockBillingEnabled() {
  return truthy(process.env.SMS_MOCK_BILLING);
}

module.exports = { stripeEnabled, smsEnabled, smsMockBillingEnabled };
