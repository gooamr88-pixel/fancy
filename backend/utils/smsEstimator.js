/**
 * SMS ALLOWANCE ESTIMATOR — turns "which plan did you pick?" into "how many
 * messages will this event actually need?", with the arithmetic exposed.
 *
 * The organizer buys the add-on at checkout, before a single guest exists, so the
 * only thing available to size it from is the tier's guest cap. That makes the
 * estimate a genuine forecast, and the two things it must never be are a bare
 * number the organizer has to trust, or a floor they cannot go under.
 * `estimateAllowance` therefore returns a per-type BREAKDOWN for the UI to show,
 * and the recommendation is a starting position on a slider — not a minimum.
 *
 * ── Why the numbers are what they are ──
 *
 * Everything is counted in SEGMENTS, not messages, because segments are what
 * Twilio bills and what sms_credit_wallets debits. A 200-character message is two
 * segments and costs twice a 140-character one; an estimator that counted
 * "messages" would understate every Arabic event by roughly 3x.
 *
 * The per-type frequencies live in config/smsMessageTypes.js next to the types
 * themselves, so adding a type updates the estimate automatically.
 */

const { SMS_MESSAGE_TYPES, isTypeEnabled } = require('../config/smsMessageTypes');
const { DEFAULT_SMS_PRICING, normalizeSmsPricing } = require('../config/smsPricing');

/**
 * Every assumption this estimator makes — guests per invitation, segments per
 * message in each script, the size assumed for unlimited plans, the purchase
 * bounds — is super-admin editable and read from
 * super_admin_config.sms_pricing_config via config/smsPricing.js, which supplies
 * the shipped defaults for anything unset. There are deliberately NO local copies
 * of those values: a second definition is a second answer waiting to disagree
 * with what the customer is actually charged.
 *
 * The three below are re-exported purely as the shipped defaults, for tests and
 * for callers that need the sellable range without loading a config.
 */
const ROUNDING_STEP = DEFAULT_SMS_PRICING.bounds.step;
const MIN_ALLOWANCE = DEFAULT_SMS_PRICING.bounds.min;
const MAX_ALLOWANCE = DEFAULT_SMS_PRICING.bounds.max;

const roundUpTo = (n, step) => Math.ceil(n / step) * step;
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

/**
 * Estimate the SMS allowance an event should start with.
 *
 * @param {object}  opts
 * @param {number|null} opts.maxGuests      the tier's guest cap (null = unlimited)
 * @param {string}  [opts.script='latin']   'latin' | 'arabic' — drives segment cost
 * @param {object}  [opts.smsSettings]      per-type switches; defaults are used when absent
 * @param {number}  [opts.guestsPerParty]
 * @returns {{
 *   recommendedSegments: number,
 *   estimatedParties: number,
 *   segmentsPerMessage: number,
 *   script: string,
 *   breakdown: Array<{key,label,audience,enabled,messages,segments}>,
 *   bounds: { min: number, max: number, step: number }
 * }}
 */
function estimateAllowance({
  maxGuests,
  script = 'latin',
  smsSettings = null,
  guestsPerParty = null,
  pricingConfig = null,
} = {}) {
  // One normalized model for the whole calculation. Passing a raw config row, a
  // partial object, or nothing at all all produce a complete, sane model.
  const cfg = normalizeSmsPricing(pricingConfig);
  const est = cfg.estimator;
  const bounds = cfg.bounds;

  const normalizedScript = script === 'arabic' ? 'arabic' : 'latin';
  const segmentsPerMessage = normalizedScript === 'arabic'
    ? est.segments_per_message_arabic
    : est.segments_per_message_latin;

  const effectiveGuests = Number.isFinite(Number(maxGuests)) && Number(maxGuests) > 0
    ? Number(maxGuests)
    : est.unlimited_tier_assumed_guests;

  // An explicit argument still wins — callers that model a specific event's real
  // party size should not be overridden by a platform-wide average.
  const perParty = Number(guestsPerParty) > 0 ? Number(guestsPerParty) : est.guests_per_party;
  const estimatedParties = Math.max(1, Math.ceil(effectiveGuests / perParty));

  const breakdown = [];
  let totalSegments = 0;

  for (const type of SMS_MESSAGE_TYPES) {
    const enabled = isTypeEnabled(smsSettings, type.key);

    // Frequency comes from the admin-editable table, falling back to the value
    // declared on the type itself for anything the config has not been extended
    // to cover yet.
    const configured = cfg.type_frequencies[type.key];
    const frequency = Number.isFinite(configured)
      ? configured
      : (type.perEventEstimate != null ? type.perEventEstimate : (type.perPartyEstimate || 0));

    // organizer_report and anything else addressed to the organizer is a flat
    // handful per EVENT — an organizer gets the same few reports whether they
    // invite 20 people or 2,000, so it must not be multiplied by party count.
    const isPerEvent = type.audience === 'organizer';
    const messages = enabled
      ? (isPerEvent ? frequency : frequency * estimatedParties)
      : 0;
    const segments = Math.ceil(messages * segmentsPerMessage);

    // A disabled type contributes nothing to the cost but still appears in the
    // breakdown — the organizer needs to see what turning it on would add, not
    // just what they are being charged for now.
    if (enabled) totalSegments += segments;
    breakdown.push({
      key: type.key,
      label: type.label,
      audience: type.audience,
      enabled,
      messages: Math.round(messages),
      segments,
    });
  }

  const recommendedSegments = clamp(
    roundUpTo(Math.max(totalSegments, bounds.min), bounds.step),
    bounds.min,
    bounds.max,
  );

  return {
    recommendedSegments,
    estimatedParties,
    segmentsPerMessage,
    script: normalizedScript,
    breakdown,
    bounds,
    // Echoed back so the purchase screen can say "your plan covers up to 200
    // guests" without separately resolving the tier it was built from — and so
    // the sentence can never quote a different cap than the maths used.
    maxGuests: Number.isFinite(Number(maxGuests)) && Number(maxGuests) > 0 ? Number(maxGuests) : null,
  };
}

/**
 * Coerce a client-supplied allowance size into the sellable range.
 *
 * The organizer moves a slider, but the value reaching Stripe must be an integer
 * inside the bounds — a hand-rolled request must not be able to buy 0 segments
 * (a free "purchase" that flips sms_addon_purchased_at) or 10 million.
 * Returns null when the input is not a usable number at all, which callers treat
 * as "no add-on requested" rather than silently substituting a default.
 */
function sanitizeAllowanceRequest(raw, pricingConfig = null) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const { bounds } = normalizeSmsPricing(pricingConfig);
  return clamp(Math.round(n), bounds.min, bounds.max);
}

/** 'arabic' when the event's language is Arabic — the only script that changes cost. */
function scriptForLanguage(lang) {
  return String(lang || '').toLowerCase().startsWith('ar') ? 'arabic' : 'latin';
}

module.exports = {
  estimateAllowance,
  sanitizeAllowanceRequest,
  scriptForLanguage,
  MIN_ALLOWANCE,
  MAX_ALLOWANCE,
  ROUNDING_STEP,
};
