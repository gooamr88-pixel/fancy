/**
 * Pure pricing math for SMS message purchases.
 *
 * Extracted from paymentController so the charge calculation can be unit-tested
 * without a Stripe/DB round-trip, and so there is a single source of truth for
 * the markup + volume-discount rules.
 *
 * The volume discount used to be one hard-coded tier (12.5% off at 500+). It is
 * now a tiered table the super admin edits, normalized by config/smsPricing.js.
 * The default table reproduces that original single tier exactly, so a platform
 * that never touches the dashboard prices identically to before.
 */

const { DEFAULT_SMS_PRICING, discountPctFor, normalizeSmsPricing } = require('../config/smsPricing');

/**
 * Compute the total charge for a bundle of SMS messages, in integer cents.
 *
 * Base carrier cost (unitPriceCents × creditCount) → apply admin markup → apply
 * the best matching volume discount → round ONCE at the end. Rounding only at the
 * end, rather than per credit, preserves the markup and discount cents in the
 * final charge: rounding per unit collapsed an intended 2188¢ to 2000¢.
 *
 * @param {Object}   opts
 * @param {number}   opts.unitPriceCents      Carrier cost per segment, in cents.
 * @param {number}   opts.creditCount         Segments being purchased.
 * @param {number}   [opts.markupPct=0]       Platform markup, e.g. 40 = +40%.
 * @param {Array}    [opts.volumeDiscounts]   Tier table; defaults to the shipped one.
 * @returns {number} Total charge in integer cents.
 */
function computeSmsChargeCents({ unitPriceCents, creditCount, markupPct = 0, volumeDiscounts }) {
  const markup = Number(markupPct) || 0;
  const tiers = volumeDiscounts || DEFAULT_SMS_PRICING.volume_discounts;

  let total = unitPriceCents * creditCount * (1 + markup / 100);

  const discountPct = discountPctFor(creditCount, tiers);
  if (discountPct > 0) total *= (1 - discountPct / 100);

  // Defense-in-depth: updatePricingConfig validates these inputs at save time,
  // but a stale/malformed config row (or a future caller that skips that
  // validation) must never be able to hand Stripe a negative unit_amount.
  return Math.max(0, Math.round(total));
}

/**
 * The same calculation, itemized — for the admin dashboard's margin view.
 *
 * The dashboard's whole purpose is to answer "if I change this, what do we
 * actually earn?", and that question cannot be answered from the total alone.
 * Returning the carrier cost alongside the charge makes the margin explicit
 * rather than something an admin has to recompute in their head — which is how
 * a markup gets set below cost without anyone noticing.
 *
 * @returns {{
 *   segments:number, baseCostCents:number,
 *   discountPct:number, discountCents:number, chargeCents:number,
 *   profitCents:number, marginPct:number, effectiveCentsPerSegment:number,
 *   belowCost:boolean
 * }}
 */
function describeSmsCharge({ unitPriceCents, creditCount, markupPct = 0, volumeDiscounts }) {
  const segments = Math.max(0, Number(creditCount) || 0);
  const unit = Math.max(0, Number(unitPriceCents) || 0);
  const markup = Number(markupPct) || 0;
  const tiers = volumeDiscounts || DEFAULT_SMS_PRICING.volume_discounts;

  const baseCostCents = Math.round(unit * segments);
  const afterMarkup = unit * segments * (1 + markup / 100);
  const discountPct = discountPctFor(segments, tiers);
  const chargeCents = computeSmsChargeCents({ unitPriceCents: unit, creditCount: segments, markupPct: markup, volumeDiscounts: tiers });
  const discountCents = Math.max(0, Math.round(afterMarkup) - chargeCents);
  const profitCents = chargeCents - baseCostCents;

  return {
    segments,
    baseCostCents,
    discountPct,
    discountCents,
    chargeCents,
    profitCents,
    // Margin on REVENUE (profit ÷ charge), the figure a finance reader expects —
    // not markup on cost, which for the same numbers reads far higher and
    // flatters the result.
    marginPct: chargeCents > 0 ? Math.round((profitCents / chargeCents) * 1000) / 10 : 0,
    effectiveCentsPerSegment: segments > 0 ? Math.round((chargeCents / segments) * 100) / 100 : 0,
    /**
     * True when this order earns less than it costs us to deliver.
     *
     * The admin form CLAMPS bad input rather than rejecting it — deliberately,
     * because rejecting a save can leave an admin unable to fix a bad row through
     * the UI. The cost of that choice is that a mistyped discount saves quietly
     * and looks fine. At 1.1c cost and a 3.0c list price the break-even discount
     * is 63%, so a fat-fingered "65" in a tier is a loss on exactly the largest
     * orders that tier exists to win.
     *
     * LIMITS.discountPct.max caps tiers at 50% to make that unreachable by typo,
     * but the cap protects only the discount — a markup set too low, or a carrier
     * rate that rises, gets here by a different route. This flag is what the admin
     * price table paints red, so a loss is visible in the row that causes it
     * rather than in a monthly total three weeks later.
     */
    belowCost: segments > 0 && chargeCents < baseCostCents,
  };
}

/** Convenience: pull the tier table out of a platform config row. */
function volumeDiscountsFromConfig(config) {
  return normalizeSmsPricing(config?.sms_pricing_config).volume_discounts;
}

module.exports = {
  computeSmsChargeCents,
  describeSmsCharge,
  volumeDiscountsFromConfig,
};
