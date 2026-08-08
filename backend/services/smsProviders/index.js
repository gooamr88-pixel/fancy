/**
 * Which carrier is sending, and the one shape everything above uses.
 *
 * The transport used to be hard-wired: smsDispatch called twilio.messages.create
 * directly and both webhook handlers parsed Twilio's payload and verified
 * Twilio's signature. Adding a second carrier by branching on a flag in each of
 * those places would have scattered carrier knowledge across the consent and
 * billing layers — the parts that must not care.
 *
 * So the differences live in one file each, behind this interface:
 *
 *   name                          'twilio' | 'vonage'
 *   maxBodyLength                 longest single body the carrier accepts
 *   isConfigured()                are its credentials all present?
 *   getTransport()                truthy when a real send is possible, else null
 *   send({to, body, clientRef})   → { id, costCents } — THROWS on failure
 *   verifyStatusWebhook(req)      → boolean
 *   verifyInboundWebhook(req)     → boolean
 *   parseStatusWebhook(body)      → { id, clientRef, status, failed, errorCode, costCents }
 *   parseInboundWebhook(body)     → { from, text, messageId, keyword? }
 *   logConfigWarnings()
 *
 * `parseStatusWebhook` returns OUR vocabulary, not the carrier's, so
 * reconcile_sms_delivery keeps receiving the values it already understands and
 * needs no migration to learn a second dialect.
 */
const logger = require('../../utils/logger');

const PROVIDERS = {
  twilio: require('./twilio'),
  vonage: require('./vonage'),
};

const DEFAULT_PROVIDER = 'twilio';

/**
 * The active provider.
 *
 * Read from the environment on every call rather than cached at require-time:
 * the tests switch providers between cases, and a cached choice would make the
 * second one silently exercise the first.
 *
 * An unknown value falls back to Twilio with a loud warning rather than throwing.
 * A typo in SMS_PROVIDER should degrade to the reviewed, working carrier — not
 * take the whole API down at boot.
 */
function resolveProvider() {
  const name = String(process.env.SMS_PROVIDER || DEFAULT_PROVIDER).toLowerCase().trim();
  const provider = PROVIDERS[name];
  if (provider) return provider;

  logger.warn({ smsProvider: name }, `Unknown SMS_PROVIDER — falling back to ${DEFAULT_PROVIDER}. Valid values: ${Object.keys(PROVIDERS).join(', ')}.`);
  return PROVIDERS[DEFAULT_PROVIDER];
}

/**
 * Which carrier sent THIS webhook — not which one is sending right now.
 *
 * Delivery receipts and inbound messages arrive minutes to hours after the send,
 * and a carrier retries a failed callback for hours more. Resolving them with
 * SMS_PROVIDER meant that the moment you switched carriers, everything still in
 * flight became unreadable: old-carrier receipts failed signature verification, so
 * failed messages were never refunded, and an old-carrier STOP parsed to nothing
 * and was silently discarded — a TCPA problem, not just a lost credit.
 *
 * Identifying by payload shape instead means both carriers are understood at once
 * and a switch strands nothing. Twilio and Vonage share no webhook field names, so
 * the two shapes are unambiguous.
 *
 * SECURITY: this ROUTES, it does not AUTHORIZE. The caller must still run the
 * returned provider's own signature check, and must refuse a payload whose carrier
 * is unconfigured rather than letting it through unverified.
 *
 * @returns the matching provider, or null when the payload resembles neither.
 */
function resolveWebhookProvider(req) {
  // The active carrier is tried first so the common case is one call, and so a
  // genuinely ambiguous payload resolves to the carrier actually in use.
  const active = resolveProvider();
  if (typeof active.matchesWebhook === 'function' && active.matchesWebhook(req)) return active;

  for (const provider of Object.values(PROVIDERS)) {
    if (provider === active) continue;
    if (typeof provider.matchesWebhook === 'function' && provider.matchesWebhook(req)) return provider;
  }
  return null;
}

module.exports = { resolveProvider, resolveWebhookProvider, PROVIDERS, DEFAULT_PROVIDER };
