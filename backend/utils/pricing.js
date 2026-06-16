/**
 * Pure pricing math for SMS credit purchases.
 *
 * Extracted from paymentController so the charge calculation can be unit-tested
 * without a Stripe/DB round-trip, and so there is a single source of truth for
 * the markup + volume-discount rules.
 */

// Orders of this many credits or more receive the volume discount.
const VOLUME_DISCOUNT_THRESHOLD = 500;
// 12.5% off (i.e. pay 87.5%) once the threshold is met.
const VOLUME_DISCOUNT_RATE = 0.875;

/**
 * Compute the total charge for an SMS credit pack, in integer cents.
 *
 * Base carrier cost (unitPriceCents × creditCount) → apply admin markup →
 * apply volume discount → round ONCE at the end. Rounding only at the end (rather
 * than per credit) preserves the markup/discount cents in the final charge.
 *
 * @param {Object} opts
 * @param {number} opts.unitPriceCents - Carrier cost per credit, in cents.
 * @param {number} opts.creditCount    - Number of credits being purchased.
 * @param {number} [opts.markupPct=0]  - Platform markup as a percentage (e.g. 20 = +20%).
 * @returns {number} Total charge in integer cents.
 */
function computeSmsChargeCents({ unitPriceCents, creditCount, markupPct = 0 }) {
  const markup = Number(markupPct) || 0;
  let total = unitPriceCents * creditCount * (1 + markup / 100);
  if (creditCount >= VOLUME_DISCOUNT_THRESHOLD) {
    total *= VOLUME_DISCOUNT_RATE;
  }
  return Math.round(total);
}

module.exports = {
  computeSmsChargeCents,
  VOLUME_DISCOUNT_THRESHOLD,
  VOLUME_DISCOUNT_RATE,
};
