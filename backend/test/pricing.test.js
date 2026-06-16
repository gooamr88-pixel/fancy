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

test('applies the 12.5% volume discount at the 500-credit threshold', () => {
  // 5¢ × 500 × 0.875 = 2187.5 → 2188¢ (rounded once at the end)
  assert.equal(computeSmsChargeCents({ unitPriceCents: 5, creditCount: 500 }), 2188);
});

test('does not apply the volume discount just below the threshold', () => {
  // 5¢ × 499 = 2495¢ (no discount)
  assert.equal(computeSmsChargeCents({ unitPriceCents: 5, creditCount: 499 }), 2495);
});

test('markup and volume discount compose, rounding only once', () => {
  // 5¢ × 500 × 1.20 × 0.875 = 2625¢
  assert.equal(computeSmsChargeCents({ unitPriceCents: 5, creditCount: 500, markupPct: 20 }), 2625);
});

test('discount cents are NOT lost (regression for the per-unit rounding bug)', () => {
  // The old code charged round(total/count) × count. For this input that path
  // yielded 2000¢ instead of the intended discounted total. Guard against it.
  const total = computeSmsChargeCents({ unitPriceCents: 5, creditCount: 500 });
  const oldPerUnitCharge = Math.round(total / 500) * 500;
  assert.equal(total, 2188);
  assert.notEqual(total, oldPerUnitCharge);
});

test('treats a null/invalid markup as zero', () => {
  assert.equal(computeSmsChargeCents({ unitPriceCents: 5, creditCount: 100, markupPct: null }), 500);
  assert.equal(computeSmsChargeCents({ unitPriceCents: 5, creditCount: 100, markupPct: undefined }), 500);
});
