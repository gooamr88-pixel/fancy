const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeSmsChargeCents } = require('../utils/pricing');

test('base cost with no markup and no discount', () => {
  // 5¢ × 100 credits = 500¢
  assert.equal(computeSmsChargeCents({ unitPriceCents: 5, creditCount: 100 }), 500);
});

test('applies the platform markup', () => {
  // 5¢ × 100 × 1.20 = 600¢
  assert.equal(computeSmsChargeCents({ unitPriceCents: 5, creditCount: 100, markupPct: 20 }), 600);
});

test('applies the 10% volume discount at the 500-message threshold', () => {
  // 5¢ × 500 × 0.90 = 2250¢
  assert.equal(computeSmsChargeCents({ unitPriceCents: 5, creditCount: 500 }), 2250);
});

test('does not apply the volume discount just below the threshold', () => {
  // 5¢ × 499 = 2495¢ (no discount)
  assert.equal(computeSmsChargeCents({ unitPriceCents: 5, creditCount: 499 }), 2495);
});

test('markup and volume discount compose, rounding only once', () => {
  // 5¢ × 500 × 1.20 × 0.90 = 2700¢
  assert.equal(computeSmsChargeCents({ unitPriceCents: 5, creditCount: 500, markupPct: 20 }), 2700);
});

test('deeper tiers apply as the order grows', () => {
  // The ladder exists so a large order is cheaper PER MESSAGE, not merely bigger.
  const per = (n) => computeSmsChargeCents({ unitPriceCents: 5, creditCount: n }) / n;
  assert.ok(per(10000) < per(5000));
  assert.ok(per(5000) < per(2000));
  assert.ok(per(2000) < per(500));
});

test('a FRACTIONAL carrier rate survives to the total', () => {
  // The whole reason sms_rate_cents_per_credit became NUMERIC. The real rate is
  // 1.1¢; as an INTEGER column it stored 1, understating cost by ~9% everywhere.
  // 1.1¢ × 400 × 2.7273 = 1200.01 → 1200¢ = exactly $12.00, no discount at 400.
  assert.equal(
    computeSmsChargeCents({ unitPriceCents: 1.1, creditCount: 400, markupPct: 172.73 }),
    1200,
  );
});

test('discount cents are NOT lost (regression for the per-unit rounding bug)', () => {
  // The old code charged round(total/count) × count. That path discards the
  // fractional cents a discount creates — guard against its return.
  const total = computeSmsChargeCents({ unitPriceCents: 5, creditCount: 2000 });
  const oldPerUnitCharge = Math.round(total / 2000) * 2000;
  assert.notEqual(total, oldPerUnitCharge);
});

test('belowCost flags an order that earns less than it costs to deliver', () => {
  const { describeSmsCharge } = require('../utils/pricing');

  const healthy = describeSmsCharge({ unitPriceCents: 1.1, creditCount: 400, markupPct: 172.73 });
  assert.equal(healthy.belowCost, false);
  assert.ok(healthy.marginPct > 50);

  // A markup below zero sells under cost. The admin form CLAMPS bad input rather
  // than rejecting it, so a loss can be saved silently — this flag is what paints
  // the offending row red instead of leaving it to a monthly total.
  const loss = describeSmsCharge({ unitPriceCents: 1.1, creditCount: 400, markupPct: -50 });
  assert.equal(loss.belowCost, true);
});

test('treats a null/invalid markup as zero', () => {
  assert.equal(computeSmsChargeCents({ unitPriceCents: 5, creditCount: 100, markupPct: null }), 500);
  assert.equal(computeSmsChargeCents({ unitPriceCents: 5, creditCount: 100, markupPct: undefined }), 500);
});
