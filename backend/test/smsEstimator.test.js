require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  estimateAllowance, sanitizeAllowanceRequest, scriptForLanguage,
  MIN_ALLOWANCE, MAX_ALLOWANCE, ROUNDING_STEP,
} = require('../utils/smsEstimator');

/**
 * ALLOWANCE ESTIMATOR.
 *
 * The organizer buys SMS at checkout, before any guest exists, so this forecast is
 * the only thing standing between them and either an allowance that runs out
 * mid-event or one they wildly overpaid for. Two properties matter most:
 *
 *   • Arabic must cost materially more. UCS-2 caps a segment at 70 characters
 *     instead of 160, so the same guest list is 2-3x the segments. Pricing Arabic
 *     events on the Latin assumption under-funds them by more than half — and the
 *     failure shows up as reminders silently not arriving, days later.
 *
 *   • The recommendation is a STARTING POINT, not a floor. sanitizeAllowanceRequest
 *     is what actually bounds the purchase, and it must accept a smaller number
 *     than the recommendation while rejecting nonsense.
 */

test('scales with the tier guest cap', () => {
  const small = estimateAllowance({ maxGuests: 50 });
  const large = estimateAllowance({ maxGuests: 500 });

  assert.ok(large.recommendedSegments > small.recommendedSegments);
  assert.ok(large.estimatedParties > small.estimatedParties);
});

test('counts PARTIES, not guests — SMS reaches one primary contact per party', () => {
  const est = estimateAllowance({ maxGuests: 220, guestsPerParty: 2.2 });
  assert.equal(est.estimatedParties, 100,
    'a 220-guest cap is ~100 messageable contacts; estimating per guest would more than double every quote');
});

test('Arabic costs roughly double Latin for the same guest list', () => {
  const latin = estimateAllowance({ maxGuests: 300, script: 'latin' });
  const arabic = estimateAllowance({ maxGuests: 300, script: 'arabic' });

  assert.ok(arabic.recommendedSegments > latin.recommendedSegments * 1.5,
    'UCS-2 segments are less than half the size, and the estimate must reflect that');
  assert.equal(arabic.script, 'arabic');
  assert.equal(latin.segmentsPerMessage < arabic.segmentsPerMessage, true);
});

test('an unlimited tier (null cap) still produces a finite, sane number', () => {
  const est = estimateAllowance({ maxGuests: null });
  assert.ok(Number.isInteger(est.recommendedSegments));
  assert.ok(est.recommendedSegments >= MIN_ALLOWANCE);
  assert.ok(est.recommendedSegments <= MAX_ALLOWANCE);
});

test('the breakdown lists every type, including disabled ones', () => {
  const est = estimateAllowance({
    maxGuests: 200,
    smsSettings: { campaign: false, decline_ack: false },
  });

  const campaign = est.breakdown.find((b) => b.key === 'campaign');
  assert.equal(campaign.enabled, false);
  assert.equal(campaign.segments, 0, 'a disabled type costs nothing');
  assert.ok(est.breakdown.length >= 7,
    'disabled types still appear so the organizer can see what enabling one would add');
});

test('disabling types lowers the recommendation', () => {
  const all = estimateAllowance({ maxGuests: 200 });
  const fewer = estimateAllowance({
    maxGuests: 200,
    smsSettings: { campaign: false, rsvp_reminder: false, event_reminder: false },
  });

  assert.ok(fewer.recommendedSegments < all.recommendedSegments);
});

test('the organizer-directed type is costed per EVENT, not per party', () => {
  const small = estimateAllowance({ maxGuests: 20 });
  const large = estimateAllowance({ maxGuests: 2000 });

  const reportOf = (e) => e.breakdown.find((b) => b.key === 'organizer_report').messages;
  assert.equal(reportOf(small), reportOf(large),
    'an organizer gets the same handful of reports whether they invite 20 people or 2,000');
});

test('recommendations are rounded to a sellable step', () => {
  for (const maxGuests of [37, 120, 355, 900]) {
    const { recommendedSegments } = estimateAllowance({ maxGuests });
    assert.equal(recommendedSegments % ROUNDING_STEP, 0,
      `allowances are sold in round units, got ${recommendedSegments}`);
  }
});

/* ── The value that actually reaches Stripe ─────────────────────────────── */

test('sanitizeAllowanceRequest lets the organizer buy LESS than recommended', () => {
  assert.equal(sanitizeAllowanceRequest(100), 100,
    'the recommendation is a starting point on a slider, never a minimum purchase');
});

test('sanitizeAllowanceRequest clamps to the sellable range', () => {
  assert.equal(sanitizeAllowanceRequest(1), MIN_ALLOWANCE);
  assert.equal(sanitizeAllowanceRequest(999999), MAX_ALLOWANCE);
});

test('sanitizeAllowanceRequest rejects values that are not a purchase', () => {
  // A zero-segment "purchase" would be a $0 checkout that still flips
  // sms_addon_purchased_at — free SMS access via a hand-rolled request.
  for (const bad of [0, -50, null, undefined, '', 'abc', NaN, {}]) {
    assert.equal(sanitizeAllowanceRequest(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('sanitizeAllowanceRequest returns whole segments', () => {
  assert.equal(Number.isInteger(sanitizeAllowanceRequest(150.7)), true);
});

test('scriptForLanguage detects Arabic from a language tag', () => {
  assert.equal(scriptForLanguage('ar'), 'arabic');
  assert.equal(scriptForLanguage('ar-EG'), 'arabic');
  assert.equal(scriptForLanguage('en'), 'latin');
  assert.equal(scriptForLanguage(null), 'latin');
});
