require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_SMS_PRICING, LIMITS, normalizeSmsPricing, discountPctFor, describeSmsPricingAdjustments,
} = require('../config/smsPricing');
const { computeSmsChargeCents, describeSmsCharge } = require('../utils/pricing');
const { estimateAllowance, sanitizeAllowanceRequest } = require('../utils/smsEstimator');

/**
 * ADMIN-CONTROLLED SMS PRICING.
 *
 * The whole commercial model for text messaging — carrier rate, Fancy's markup,
 * volume discounts, purchase limits, and the assumptions behind the bundle we
 * recommend — is now edited from the dashboard and stored as jsonb.
 *
 * jsonb means the database enforces nothing. A partial row, an older row, or a
 * hostile payload flows straight into a Stripe `unit_amount`. Getting that wrong
 * does not fail loudly: it silently charges every organizer the wrong price, or
 * hands Stripe an amount it rejects and breaks checkout for everyone at once.
 *
 * These tests own that boundary. The two that matter most:
 *   • the SHIPPED DEFAULTS must price identically to the hard-coded constants
 *     they replaced, so deploying this changed nobody's bill;
 *   • no input, however malformed, may produce a negative, free, or NaN charge.
 */

/* ── Defaults must be a no-op ───────────────────────────────────────────── */

test('the shipped defaults reproduce the SHIPPED pricing exactly', () => {
  // The real economics: 1.1c carrier cost, 172.73% markup, 3.0c list price.
  const rate = 1.1, markup = 172.73;

  // Below the 500 threshold: markup only.
  assert.equal(
    computeSmsChargeCents({ unitPriceCents: rate, creditCount: 400, markupPct: markup }),
    1200,
    '400 messages at 3.0c is exactly $12.00 — and only a NUMERIC rate column can hold the 1.1',
  );

  // At and above it: the 10% volume discount.
  assert.equal(
    computeSmsChargeCents({ unitPriceCents: rate, creditCount: 500, markupPct: markup }),
    Math.round(1.1 * 500 * 2.7273 * 0.90),
  );
});

test('an unconfigured platform (null config) still yields a complete model', () => {
  const cfg = normalizeSmsPricing(null);
  assert.deepEqual(cfg, normalizeSmsPricing(DEFAULT_SMS_PRICING));
  assert.ok(cfg.bounds.min > 0 && cfg.bounds.max > cfg.bounds.min);
  assert.ok(cfg.guest_bands.length > 0, 'the ladder must always exist');
  assert.ok(Object.keys(cfg.type_weights).length >= 3, 'every guest type needs a share');
  assert.ok(Object.keys(cfg.type_frequencies).length >= 1, 'the organizer type is absolute, per event');
});

/* ── The ladder ─────────────────────────────────────────────────────────── */

test('guest bands are sorted ascending with the open band forced last', () => {
  const cfg = normalizeSmsPricing({
    guest_bands: [
      { max_guests: null, messages_per_party: 1 },   // deliberately first
      { max_guests: 1000, messages_per_party: 2 },
      { max_guests: 100, messages_per_party: 3 },
    ],
  });

  assert.deepEqual(cfg.guest_bands.map((b) => b.max_guests), [100, 1000, null],
    'band selection is "the first one you fit inside", so order is load-bearing');
});

test('a table with NO open band gets one anyway', () => {
  const cfg = normalizeSmsPricing({
    guest_bands: [
      { max_guests: 100, messages_per_party: 3 },
      { max_guests: 500, messages_per_party: 2 },
    ],
  });

  assert.equal(cfg.guest_bands[cfg.guest_bands.length - 1].max_guests, null,
    'without an open band, an event above every threshold prices at ZERO messages — '
    + 'a free purchase that unlocks the add-on and then cannot send anything');
});

test('a broken or empty ladder falls back to the shipped one', () => {
  for (const bad of [{ guest_bands: [] }, { guest_bands: 'nonsense' }, { guest_bands: [null, 3] }]) {
    const cfg = normalizeSmsPricing(bad);
    assert.ok(cfg.guest_bands.length > 0);
    assert.ok(cfg.guest_bands.every((b) => b.messages_per_party >= 0));
  }
});

test('duplicate band thresholds are dropped rather than resolved arbitrarily', () => {
  const cfg = normalizeSmsPricing({
    guest_bands: [
      { max_guests: 300, messages_per_party: 3 },
      { max_guests: 300, messages_per_party: 1 },
      { max_guests: null, messages_per_party: 1.5 },
    ],
  });
  assert.equal(cfg.guest_bands.filter((b) => b.max_guests === 300).length, 1);
});

test('type weights are keyed off the DEFAULTS, so an unknown type cannot be injected', () => {
  const cfg = normalizeSmsPricing({
    type_weights: { invitation: 2, some_type_we_never_shipped: 99 },
  });
  assert.equal(cfg.type_weights.invitation, 2, 'a known weight is honoured');
  assert.equal(cfg.type_weights.some_type_we_never_shipped, undefined,
    'an admin payload must not be able to introduce a message type');
});

test('a PARTIAL config keeps defaults for everything it omits', () => {
  const cfg = normalizeSmsPricing({ bounds: { min: 25 } });

  assert.equal(cfg.bounds.min, 25, 'the specified field is honoured');
  assert.equal(cfg.bounds.max, DEFAULT_SMS_PRICING.bounds.max, 'the omitted one falls back');
  assert.equal(cfg.estimator.guests_per_party, DEFAULT_SMS_PRICING.estimator.guests_per_party);
});

/* ── Nothing may produce a free or negative charge ──────────────────────── */

test('a 100% discount is capped so messages can never become free', () => {
  const cfg = normalizeSmsPricing({ volume_discounts: [{ min_segments: 10, discount_pct: 100 }] });
  assert.equal(cfg.volume_discounts[0].discount_pct, LIMITS.discountPct.max);

  const charge = computeSmsChargeCents({
    unitPriceCents: 8, creditCount: 100, markupPct: 40,
    volumeDiscounts: cfg.volume_discounts,
  });
  assert.ok(charge > 0, 'a capped discount still leaves a payable amount');
});

test('negative and absurd values are clamped, not stored', () => {
  const cfg = normalizeSmsPricing({
    volume_discounts: [{ min_segments: -5, discount_pct: -20 }],
    bounds: { min: -100, max: 99999999, step: 0 },
    estimator: { guests_per_party: 0, segments_per_message_latin: -3 },
    type_frequencies: { organizer_report: -10 },
    type_weights: { invitation: -5 },
    guest_bands: [{ max_guests: -50, messages_per_party: -2 }],
  });

  assert.ok(cfg.bounds.min >= LIMITS.bound.min);
  assert.ok(cfg.bounds.step >= LIMITS.step.min);
  assert.ok(cfg.estimator.guests_per_party >= LIMITS.guestsPerParty.min,
    'zero guests per party would divide by nothing and produce Infinity recipients');
  assert.ok(cfg.estimator.segments_per_message_latin >= LIMITS.segmentsPerMsg.min);
  assert.ok(cfg.type_frequencies.organizer_report >= 0);
  assert.ok(cfg.type_weights.invitation >= 0,
    'a negative weight would hand another type more than 100% of the budget');
  assert.ok(cfg.guest_bands.every((b) => b.messages_per_party >= 0));
});

test('an inverted min/max is swapped rather than making every purchase impossible', () => {
  const cfg = normalizeSmsPricing({ bounds: { min: 5000, max: 100, step: 50 } });
  assert.ok(cfg.bounds.min < cfg.bounds.max);
  assert.equal(cfg.bounds.min, 100);
  assert.equal(cfg.bounds.max, 5000);
});

test('garbage types cannot reach the pricing maths', () => {
  for (const junk of [null, undefined, 'nope', 42, [], { volume_discounts: 'no' }]) {
    const cfg = normalizeSmsPricing(junk);
    const charge = computeSmsChargeCents({
      unitPriceCents: 8, creditCount: 200, markupPct: 40, volumeDiscounts: cfg.volume_discounts,
    });
    assert.ok(Number.isInteger(charge) && charge >= 0, `bad charge for ${JSON.stringify(junk)}`);
  }
});

/* ── Tiered discounts ───────────────────────────────────────────────────── */

test('the BEST qualifying tier applies, and tiers never stack', () => {
  const cfg = normalizeSmsPricing({
    volume_discounts: [
      { min_segments: 500, discount_pct: 10 },
      { min_segments: 2000, discount_pct: 25 },
      { min_segments: 10000, discount_pct: 40 },
    ],
  });

  assert.equal(discountPctFor(100, cfg.volume_discounts), 0);
  assert.equal(discountPctFor(500, cfg.volume_discounts), 10);
  assert.equal(discountPctFor(1999, cfg.volume_discounts), 10);
  assert.equal(discountPctFor(2000, cfg.volume_discounts), 25);
  assert.equal(discountPctFor(50000, cfg.volume_discounts), 40,
    'stacking 10+25+40 would be 75% off — the single best tier must win');
});

test('zero-discount and duplicate-threshold tiers are dropped as ambiguous', () => {
  const cfg = normalizeSmsPricing({
    volume_discounts: [
      { min_segments: 500, discount_pct: 10 },
      { min_segments: 500, discount_pct: 30 },  // same threshold — which one wins?
      { min_segments: 900, discount_pct: 0 },   // not a discount
    ],
  });
  assert.equal(cfg.volume_discounts.length, 1);
  assert.equal(cfg.volume_discounts[0].discount_pct, 10, 'the first of the pair is kept, deterministically');
});

/* ── The estimator follows the config ───────────────────────────────────── */

test('changing guests-per-party changes the recommendation', () => {
  const tight = estimateAllowance({ maxGuests: 220, pricingConfig: { estimator: { guests_per_party: 1 } } });
  const loose = estimateAllowance({ maxGuests: 220, pricingConfig: { estimator: { guests_per_party: 4 } } });

  assert.equal(tight.estimatedParties, 220);
  assert.equal(loose.estimatedParties, 55);
  assert.ok(tight.recommendedSegments > loose.recommendedSegments);
});

test('changing the guest ladder changes the recommendation', () => {
  const base = estimateAllowance({ maxGuests: 200 });
  const leaner = estimateAllowance({
    maxGuests: 200,
    pricingConfig: { guest_bands: [{ max_guests: null, messages_per_party: 1 }] },
  });
  assert.ok(leaner.recommendedSegments < base.recommendedSegments,
    'the ladder is what the whole quote is built from — lowering it must lower the price');
});

test('changing the organizer frequency changes the recommendation', () => {
  const base = estimateAllowance({ maxGuests: 200 });
  const noReports = estimateAllowance({
    maxGuests: 200, pricingConfig: { type_frequencies: { organizer_report: 0 } },
  });
  assert.ok(noReports.recommendedSegments < base.recommendedSegments);
});

test('admin bounds drive both the recommendation and the purchase clamp', () => {
  const cfg = { bounds: { min: 10, max: 200, step: 10 } };

  const est = estimateAllowance({ maxGuests: 5000, pricingConfig: cfg });
  assert.ok(est.recommendedSegments <= 200, 'the recommendation respects the admin ceiling');
  assert.equal(est.recommendedSegments % 10, 0, 'and the admin step');

  assert.equal(sanitizeAllowanceRequest(5, cfg), 10, 'below the floor clamps up');
  assert.equal(sanitizeAllowanceRequest(9999, cfg), 200, 'above the ceiling clamps down');
  assert.equal(sanitizeAllowanceRequest(150, cfg), 150, 'in range is untouched');
});

test('organizer-audience messages are counted per EVENT even when reconfigured', () => {
  const cfg = { type_frequencies: { organizer_report: 5 } };
  const small = estimateAllowance({ maxGuests: 20, pricingConfig: cfg });
  const large = estimateAllowance({ maxGuests: 5000, pricingConfig: cfg });

  const reportOf = (e) => e.breakdown.find((b) => b.key === 'organizer_report').messages;
  assert.equal(reportOf(small), 5);
  assert.equal(reportOf(large), 5,
    'multiplying organizer alerts by guest count would inflate every large plan');
});

/* ── The margin figures the dashboard shows ─────────────────────────────── */

test('describeSmsCharge itemizes cost, charge and margin', () => {
  const d = describeSmsCharge({ unitPriceCents: 8, creditCount: 1000, markupPct: 40 });

  assert.equal(d.segments, 1000);
  assert.equal(d.baseCostCents, 8000, 'what the carrier charges us');
  assert.equal(d.discountPct, 10, 'the 500-message tier applies at 1000');
  assert.ok(d.chargeCents > d.baseCostCents, 'and we are still profitable at the default markup');
  assert.equal(d.profitCents, d.chargeCents - d.baseCostCents);
  assert.ok(d.marginPct > 0 && d.marginPct < 100);
  assert.equal(d.belowCost, false);
});

test('a below-cost markup surfaces as a NEGATIVE margin rather than looking fine', () => {
  const d = describeSmsCharge({ unitPriceCents: 8, creditCount: 100, markupPct: -50 });

  assert.ok(d.profitCents < 0, 'selling under carrier cost must be visible as a loss');
  assert.ok(d.marginPct < 0, 'this is the number the dashboard turns red');
  assert.equal(d.belowCost, true,
    'and the flag the admin price table paints red must agree with the margin');
});

test('the discount cap keeps a large order above cost', () => {
  // Break-even at 1.1c cost and 3.0c list is a 63% discount. LIMITS.discountPct
  // caps tiers at 50 precisely so a mistyped 65 cannot save and quietly lose
  // money on the largest orders — the ones the tier exists to win.
  const cfg = normalizeSmsPricing({
    volume_discounts: [{ min_segments: 500, discount_pct: 85 }],
  });
  assert.ok(cfg.volume_discounts[0].discount_pct <= LIMITS.discountPct.max);

  const d = describeSmsCharge({
    unitPriceCents: 1.1, creditCount: 10000, markupPct: 172.73,
    volumeDiscounts: cfg.volume_discounts,
  });
  assert.equal(d.belowCost, false, 'the clamp must leave even the deepest tier profitable');
});

test('margin is expressed on revenue, not as markup on cost', () => {
  // 100% markup: cost 100, charge 200 → 50% margin on revenue (not 100%).
  const d = describeSmsCharge({ unitPriceCents: 100, creditCount: 1, markupPct: 100 });
  assert.equal(d.chargeCents, 200);
  assert.equal(d.marginPct, 50,
    'reporting markup-on-cost here would flatter the result to a finance reader');
});

/* ── Admin feedback ─────────────────────────────────────────────────────── */

test('adjustments are described back to the admin', () => {
  const raw = {
    volume_discounts: [
      { min_segments: 500, discount_pct: 99 },
      { min_segments: 500, discount_pct: 5 },
    ],
    bounds: { min: 900, max: 100, step: 50 },
  };
  const notes = describeSmsPricingAdjustments(raw, normalizeSmsPricing(raw));

  assert.ok(notes.length >= 2, 'a silently-clamped value must not be a mystery next time they look');
  assert.ok(notes.some((n) => /capped/i.test(n)));
  assert.ok(notes.some((n) => /swapped/i.test(n)));
});

test('a clean config produces no noise', () => {
  const raw = { volume_discounts: [{ min_segments: 500, discount_pct: 12.5 }], bounds: { min: 50, max: 5000, step: 50 } };
  assert.deepEqual(describeSmsPricingAdjustments(raw, normalizeSmsPricing(raw)), []);
});
