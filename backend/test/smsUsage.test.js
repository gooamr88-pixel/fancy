require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  summarizeBalance, relativeTime, coverageForGuests, explainSkip, isResendable,
} = require('../utils/smsUsage');
const { maxPerSendFor, normalizeSmsPricing } = require('../config/smsPricing');

/**
 * PLAIN-LANGUAGE USAGE STATE.
 *
 * Every number an organizer sees about their messages comes from here, and the
 * same numbers appear in four places — the SMS page, the low-balance email, the
 * dashboard banner and the top-up modal. Computing them separately would let
 * those four disagree, which reads to a customer as the platform not knowing its
 * own state. These tests pin the arithmetic and, just as importantly, the edge
 * cases where a naive version produces something alarming and wrong.
 */

/* ── Balance ────────────────────────────────────────────────────────────── */

test('summarizes a healthy balance', () => {
  const s = summarizeBalance({ credits_purchased: 2000, credits_used: 650, credits_remaining: 1350 });

  assert.equal(s.remaining, 1350);
  assert.equal(s.percentRemaining, 68);
  assert.equal(s.isLow, false);
  assert.equal(s.isEmpty, false);
});

test('an event that has bought nothing is 0% used, not 100%', () => {
  const s = summarizeBalance(null);

  assert.equal(s.percentUsed, 0,
    'dividing by a zero purchase would put a full red bar in front of someone who has done nothing wrong');
  assert.equal(s.isEmpty, false, 'never bought is not the same as ran out');
  assert.equal(s.hasWallet, false);
});

test('low and empty are distinct states', () => {
  const low = summarizeBalance({ credits_purchased: 1000, credits_used: 850, credits_remaining: 150 });
  const empty = summarizeBalance({ credits_purchased: 1000, credits_used: 1000, credits_remaining: 0 });

  assert.equal(low.isLow, true);
  assert.equal(low.isEmpty, false);
  assert.equal(empty.isEmpty, true);
  assert.equal(empty.isLow, false, 'empty must not also report as low — they send different emails');
});

test('the low threshold is admin-configurable', () => {
  const wallet = { credits_purchased: 1000, credits_used: 600, credits_remaining: 400 };

  assert.equal(summarizeBalance(wallet).isLow, false, '40% is fine at the default 20% threshold');
  assert.equal(
    summarizeBalance(wallet, { alerts: { low_balance_pct: 50 } }).isLow, true,
    'raising the threshold must take effect without a deploy',
  );
});

test('a corrupt or negative remaining never renders as a negative balance', () => {
  const s = summarizeBalance({ credits_purchased: 100, credits_used: 400, credits_remaining: -300 });
  assert.equal(s.remaining, 0);
  assert.ok(s.percentRemaining >= 0);
});

/* ── "2 hours ago" ──────────────────────────────────────────────────────── */

test('relative time reads the way a person would say it', () => {
  const ago = (ms) => relativeTime(new Date(Date.now() - ms).toISOString());

  assert.equal(ago(5 * 1000), 'just now');
  assert.equal(ago(2 * 60 * 1000), '2 minutes ago');
  assert.equal(ago(2 * 3600 * 1000), '2 hours ago');
  assert.equal(ago(26 * 3600 * 1000), 'yesterday');
  assert.equal(relativeTime(null), null);
});

test('a future timestamp reads as "just now" rather than a negative age', () => {
  // Clock skew between the app server and the database is normal; "in -3 minutes"
  // is not something to show a customer.
  assert.equal(relativeTime(new Date(Date.now() + 60_000).toISOString()), 'just now');
});

/* ── Is it enough for the guest list? ───────────────────────────────────── */

test('coverage counts INVITATIONS, not heads', () => {
  const c = coverageForGuests(10000, 220);
  assert.equal(c.invitations, 100,
    'a 220-guest list is ~100 messageable contacts; measuring per head would warn people who are fine');
});

test('a short balance reports a shortfall, and a comfortable one does not', () => {
  const short = coverageForGuests(50, 240);
  assert.equal(short.enough, false);
  assert.ok(short.shortfall > 0, 'the organizer needs to be told HOW MANY more to buy');

  const plenty = coverageForGuests(100000, 240);
  assert.equal(plenty.enough, true);
  assert.equal(plenty.shortfall, 0);
});

test('an empty guest list is never reported as short', () => {
  const c = coverageForGuests(0, 0);
  assert.equal(c.enough, true, 'warning someone with no guests that they are short is noise');
});

/* ── The support tool ───────────────────────────────────────────────────── */

test('every skip reason becomes a sentence, never a code', () => {
  for (const code of ['NO_CONSENT', 'OPTED_OUT', 'NO_ALLOWANCE', 'NO_PHONE', 'TYPE_DISABLED']) {
    const text = explainSkip(code);
    assert.ok(text && text.length > 5, `${code} needs an explanation`);
    assert.doesNotMatch(text, /_/, 'a raw code must never reach the customer');
    // "STOP" is allowed through: it is not a constant leaking, it is the word the
    // guest literally typed, and naming it is what makes the reason actionable.
    assert.doesNotMatch(text.replace(/\bSTOP\b/g, ''), /[A-Z]{4,}/, 'no constant in disguise');
  }
});

test('an unknown code degrades to a plain sentence rather than leaking', () => {
  const text = explainSkip('SOME_FUTURE_CODE');
  assert.ok(text);
  assert.doesNotMatch(text, /SOME_FUTURE_CODE/);
});

test('resend is offered only for failures the organizer can fix', () => {
  assert.equal(isResendable({ status: 'failed', skip_reason: 'NO_ALLOWANCE' }), true);
  assert.equal(isResendable({ status: 'failed', skip_reason: 'SEND_FAILED' }), true);

  assert.equal(isResendable({ status: 'skipped', skip_reason: 'OPTED_OUT' }), false,
    'retrying a STOP would invite the organizer to attempt what the law forbids');
  assert.equal(isResendable({ status: 'skipped', skip_reason: 'NO_CONSENT' }), false,
    'a retry button here would imply it might override their choice — it never will');
  assert.equal(isResendable({ status: 'sent' }), false);
});

/* ── Anti-abuse ramp-up ─────────────────────────────────────────────────── */

test('a brand-new account is capped, and the cap lifts with real use', () => {
  const { limits } = normalizeSmsPricing(null);

  assert.equal(maxPerSendFor(0, limits.ramp_up), 50, 'the first blast is the one worth stopping');
  assert.equal(maxPerSendFor(199, limits.ramp_up), 50);
  assert.equal(maxPerSendFor(200, limits.ramp_up), 500);
  assert.equal(maxPerSendFor(5000, limits.ramp_up), 0, '0 = unlimited, so a real customer is never permanently throttled');
});

test('the bands are admin-editable', () => {
  const { limits } = normalizeSmsPricing({
    limits: { ramp_up: [{ delivered_min: 0, max_per_send: 10 }, { delivered_min: 50, max_per_send: 0 }] },
  });

  assert.equal(maxPerSendFor(0, limits.ramp_up), 10);
  assert.equal(maxPerSendFor(50, limits.ramp_up), 0);
});

test('an empty band table means unlimited, not blocked', () => {
  const { limits } = normalizeSmsPricing({ limits: { ramp_up: [] } });
  assert.equal(maxPerSendFor(0, limits.ramp_up), 0,
    'a misconfigured table must not silently stop every send on the platform');
});

test('duplicate band thresholds are dropped as ambiguous', () => {
  const { limits } = normalizeSmsPricing({
    limits: {
      ramp_up: [
        { delivered_min: 100, max_per_send: 10 },
        { delivered_min: 100, max_per_send: 900 },
      ],
    },
  });
  assert.equal(limits.ramp_up.length, 1, 'two caps at one threshold makes "which applies" a coin flip');
});

test('the low-balance threshold is clamped to a usable range', () => {
  assert.equal(normalizeSmsPricing({ alerts: { low_balance_pct: 0 } }).alerts.low_balance_pct >= 1, true,
    '0% would never warn — the exact failure this feature exists to fix');
  assert.equal(normalizeSmsPricing({ alerts: { low_balance_pct: 500 } }).alerts.low_balance_pct <= 90, true,
    '100% would warn on the very first message');
});
