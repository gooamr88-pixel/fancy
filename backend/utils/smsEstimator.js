/**
 * SMS ALLOWANCE ESTIMATOR — turns "which plan did you pick?" into "how many
 * messages will this event actually need?", with the arithmetic exposed.
 *
 * The organizer buys the add-on at checkout, before a single guest exists, so the
 * only thing available to size it from is the tier's guest cap. That makes the
 * estimate a genuine forecast, and the two things it must never be are a bare
 * number the organizer has to trust, or a floor they cannot go under.
 * `estimateAllowance` therefore returns a per-type BREAKDOWN for the UI to show,
 * and the recommendation is a starting position — not a minimum.
 *
 * ── Why the numbers are what they are ──
 *
 * Everything is counted in SEGMENTS, not messages, because segments are what the
 * carrier bills and what sms_credit_wallets debits. A 200-character message is
 * two segments and costs twice a 140-character one; an estimator that counted
 * "messages" would understate every Arabic event by roughly 3x.
 *
 * ── The ladder ──
 *
 * The previous model multiplied a flat per-type frequency by party count, so a
 * 3,000-guest event was quoted almost exactly ten times a 300-guest one. That is
 * arithmetically consistent and commercially useless: large events are where
 * texting has to feel affordable, and it made them look ruinous.
 *
 * Now a single per-invitation budget comes from `guest_bands` — 3 messages for an
 * intimate wedding, 1.5 for a 3,000-person gala — and is SPLIT across the guest
 * message types by their relative `type_weights`. Two consequences worth stating:
 *
 *   • Adding a fifth guest type does not raise anyone's bill. It takes a share of
 *     the same budget. That is deliberate: the budget describes how much texting
 *     a guest will tolerate, which does not change because we invented a new
 *     reason to text them.
 *   • Disabling a type LOWERS the total rather than redistributing it. The
 *     denominator is the weight of ALL guest types, not just the enabled ones —
 *     so an organizer who switches something off is quoted less, not the same
 *     amount rearranged. Quoting for messages that can never send is overcharging.
 */

const { SMS_MESSAGE_TYPES, isTypeEnabled } = require('../config/smsMessageTypes');
const {
  DEFAULT_SMS_PRICING,
  normalizeSmsPricing,
  bandForGuests,
} = require('../config/smsPricing');

/**
 * Every assumption this estimator makes — guests per invitation, segments per
 * message in each script, the ladder, the type weights, the purchase bounds — is
 * super-admin editable and read from super_admin_config.sms_pricing_config via
 * config/smsPricing.js, which supplies the shipped defaults for anything unset.
 * There are deliberately NO local copies of those values: a second definition is
 * a second answer waiting to disagree with what the customer is actually charged.
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
 *   messagesPerParty: number,
 *   band: { max_guests: number|null, messages_per_party: number },
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

  // The ladder is keyed on the GUEST count, not the party count — it is a
  // statement about how big the event is, and "300 guests" is the number the
  // organizer picked their plan by and the one the pricing page shows them.
  const band = bandForGuests(effectiveGuests, cfg.guest_bands);
  const messagesPerParty = band.messages_per_party;

  // The denominator is every guest type's weight, INCLUDING disabled ones. That
  // is what makes switching a type off reduce the quote instead of silently
  // handing its share to the others.
  const totalWeight = SMS_MESSAGE_TYPES.reduce((sum, type) => {
    if (type.audience === 'organizer') return sum;
    const configured = cfg.type_weights[type.key];
    return sum + (Number.isFinite(configured) ? configured : (type.weight || 0));
  }, 0);

  const breakdown = [];
  let totalSegments = 0;

  for (const type of SMS_MESSAGE_TYPES) {
    const enabled = isTypeEnabled(smsSettings, type.key);

    let messages;
    if (type.audience === 'organizer') {
      // A flat handful per EVENT — an organizer gets the same few reports whether
      // they invite 20 people or 2,000, so it must not be multiplied by parties.
      const configured = cfg.type_frequencies[type.key];
      messages = Number.isFinite(configured) ? configured : (type.perEventEstimate || 0);
    } else if (totalWeight > 0) {
      const configured = cfg.type_weights[type.key];
      const weight = Number.isFinite(configured) ? configured : (type.weight || 0);
      messages = messagesPerParty * (weight / totalWeight) * estimatedParties;
    } else {
      // An admin who zeroed every weight is saying "budget nothing for guest
      // texts". Legitimate, if unusual — honour it rather than dividing by zero.
      messages = 0;
    }

    if (!enabled) messages = 0;

    // Ceil per type, before summing, so the breakdown the organizer reads on
    // screen adds up to the total they are quoted. Sum-then-ceil is one segment
    // cheaper and makes the table appear not to add up, which costs far more in
    // support than it saves in carrier fees.
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
    // Echoed so the purchase screen can say "about 3 messages per invitation on
    // a plan your size" without re-deriving the band and risking a different
    // answer than the one the maths actually used.
    messagesPerParty,
    band,
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
 * The organizer adjusts a number, but the value reaching Stripe must be an
 * integer inside the bounds — a hand-rolled request must not be able to buy 0
 * segments (a free "purchase" that flips sms_addon_purchased_at) or 10 million.
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
