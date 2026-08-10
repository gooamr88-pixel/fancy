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

test('Arabic costs materially more than Latin for the same guest list', () => {
  const latin = estimateAllowance({ maxGuests: 300, script: 'latin' });
  const arabic = estimateAllowance({ maxGuests: 300, script: 'arabic' });

  /**
   * The multiplier is ~1.5x, not the ~1.9x this test used to assert, and the
   * change is real rather than a loosened expectation.
   *
   * Both figures are now MEASURED against the actual templates rather than
   * assumed. A UCS-2 segment holds 70 characters to GSM-7's 160, so the raw ratio
   * is brutal — but the compliance footer is a fixed 78 characters in BOTH
   * encodings, and short links cut another ~57 from every URL. Fixed overhead
   * that does not scale with the encoding compresses the gap.
   *
   * Asserted as a band: below 1.3x means somebody has quietly reverted to pricing
   * Arabic like Latin, which under-funds those events by a third. Above 2.5x
   * means the short links have stopped being applied and every Arabic organizer
   * is being overcharged.
   */
  const ratio = arabic.recommendedSegments / latin.recommendedSegments;
  assert.ok(ratio > 1.3, `Arabic must cost materially more; got ${ratio.toFixed(2)}x`);
  assert.ok(ratio < 2.5, `Arabic should not cost this much with short links; got ${ratio.toFixed(2)}x`);

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
    smsSettings: { invitation: false },
  });

  const invitation = est.breakdown.find((b) => b.key === 'invitation');
  assert.equal(invitation.enabled, false);
  assert.equal(invitation.segments, 0, 'a disabled type costs nothing');
  assert.equal(est.breakdown.length, 4,
    'exactly four types, and disabled ones still appear so the organizer can see what enabling one would add');
});

test('disabling a type LOWERS the total rather than redistributing it', () => {
  const all = estimateAllowance({ maxGuests: 200 });
  const fewer = estimateAllowance({
    maxGuests: 200,
    smsSettings: { event_update: false },
  });

  assert.ok(fewer.recommendedSegments < all.recommendedSegments,
    'quoting for messages that can never send is overcharging — the denominator is every '
    + 'guest type\'s weight, not just the enabled ones, precisely so this holds');

  // And the survivors must be unchanged, not inflated to absorb the freed share.
  const invitationOf = (e) => e.breakdown.find((b) => b.key === 'invitation').segments;
  assert.equal(invitationOf(fewer), invitationOf(all),
    'switching one type off must not silently make the others more expensive');
});

/* ── The guest-count ladder ─────────────────────────────────────────────────
 *
 * The model this replaced multiplied a flat frequency by party count, so a
 * 3,000-guest event was quoted almost exactly ten times a 300-guest one —
 * arithmetically consistent and commercially useless. These are the boundaries
 * the ladder turns on, and an off-by-one at any of them silently misprices every
 * event that lands on it.
 */

test('messages per invitation steps DOWN at every band boundary', () => {
  const mpp = (g) => estimateAllowance({ maxGuests: g }).messagesPerParty;

  assert.equal(mpp(300), 3, 'the boundary belongs to the band it names');
  assert.equal(mpp(301), 2.5);
  assert.equal(mpp(1000), 2.5);
  assert.equal(mpp(1001), 2);
  assert.equal(mpp(3000), 2);
  assert.equal(mpp(3001), 1.5);
});

test('a bigger event costs LESS per guest', () => {
  const perGuest = (g) => estimateAllowance({ maxGuests: g }).recommendedSegments / g;

  assert.ok(perGuest(3000) < perGuest(1000),
    'the whole point of the ladder: scale must make texting cheaper per head, not merely bigger');
  assert.ok(perGuest(1000) < perGuest(200));
});

test('the open band catches an event above every threshold', () => {
  const huge = estimateAllowance({ maxGuests: 500000 });
  assert.ok(huge.messagesPerParty > 0,
    'a table with no open band would quote zero messages — a free purchase that unlocks '
    + 'the add-on and then cannot send anything');
  assert.ok(huge.recommendedSegments > 0);
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
