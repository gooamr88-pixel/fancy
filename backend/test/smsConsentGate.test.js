require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase, eqVal } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');

/**
 * Twilio Toll-Free Verification rejection 30475 — express-consent gate.
 *
 * These tests pin the behaviour that makes SMS consent real rather than
 * decorative: a number is messageable ONLY when its owner personally ticked the
 * dedicated consent checkbox (rsvp_parties.sms_consent = true).
 *
 * The rule they protect was loosened once before, deliberately, to keep an
 * "import a spreadsheet → text everyone" flow working: rows that had never been
 * asked (sms_consent = false, sms_consent_at NULL) were treated as sendable
 * under an organizer attestation. That is the construction TFV rejects, and it
 * also made the public /sms-opt-in page untrue. If a future change reintroduces
 * an `.or()` here, or lets sendRecipient dispatch without verifying consent,
 * these tests must fail loudly rather than let it ship.
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const {
  __sendRecipientForTests, getConsentedPhoneSet, hasSmsConsent,
} = require('../services/smsDispatch');

const EVENT = '11111111-1111-4111-8111-111111111111';

t.beforeEach(() => mock.reset());

/* ── Audience resolution ───────────────────────────────────────────────── */

/**
 * The two `fetchRecipients` tests that stood here are gone with the function.
 *
 * It resolved a campaign's audience — "everyone who hasn't replied", "everyone
 * attending" — and the tests guarded the one thing that mattered about it: that
 * the query filtered on `sms_consent = true` with no `.or()` escape hatch
 * treating "never asked" as sendable. That exact loosening is what got the
 * toll-free number rejected (Twilio TFV 30475).
 *
 * There is no audience resolver any more. The organizer ticks the guests they
 * mean, and consent is checked per party inside sendTransactionalSms — which the
 * getConsentedPhoneSet and send-path tests below cover directly, closer to the
 * carrier than the old query-shape assertions ever were.
 */

/* ── Consent set / lookup ──────────────────────────────────────────────── */

test('getConsentedPhoneSet returns consenting numbers canonicalized to +E.164', async () => {
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties') {
      return {
        data: [
          { guests: { phone: '+1 (555) 123-4567', is_primary_contact: true } },
          { guests: { phone: '5559876543', is_primary_contact: true } },
        ],
      };
    }
    return {};
  });

  const set = await getConsentedPhoneSet(EVENT);

  assert.ok(set.has('+15551234567'), 'formatting must not defeat the match');
  assert.ok(set.has('+15559876543'), 'a legacy number stored without + must still match');
});

test('hasSmsConsent is false for a number with no consent record', async () => {
  mock.setResolver((s) => (s.table === 'rsvp_parties' ? { data: [] } : {}));
  assert.equal(await hasSmsConsent(EVENT, '+15551234567'), false);
});

test('a consent set at the row cap throws rather than silently under-sending', async () => {
  // Truncation here does not over-send, it DROPS consenting guests — and the
  // resulting per-message NO_SMS_CONSENT is indistinguishable from a genuine
  // refusal. Throwing routes into the fail-closed branch instead.
  const capped = Array.from({ length: 100000 }, (_, i) => ({
    guests: { phone: `+1555${String(i).padStart(7, '0')}`, is_primary_contact: true },
  }));
  mock.setResolver((s) => (s.table === 'rsvp_parties' ? { data: capped } : {}));

  await assert.rejects(() => getConsentedPhoneSet(EVENT), /CONSENT_SET_TRUNCATED/);
});

/* ── The final choke point ─────────────────────────────────────────────── */

const sendArgs = (over = {}) => ({
  eventId: EVENT, phone: '+15551234567', body: 'hi', segments: 1,
  idemKey: 'k1', twilio: null, fromNumber: '+15550000000', ...over,
});

test('sendRecipient refuses a number that has not opted in, and never bills it', async () => {
  mock.setResolver(() => ({}));

  const res = await __sendRecipientForTests(sendArgs({ consented: new Set() }));

  assert.equal(res.kind, 'skipped');
  assert.equal(res.error, 'NO_SMS_CONSENT');
  assert.equal(mock.calls.some(c => c.op === 'rpc' && /deduct/.test(c.fn || '')), false,
    'a refused send must not deduct credits');
});

test('sendRecipient sends when the number is in the consented set', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'deduct_sms_credits_atomic') {
      return { data: { success: true, wallet_id: 'w1', ledger_id: 'l1' } };
    }
    return {};
  });

  const res = await __sendRecipientForTests(sendArgs({ consented: new Set(['+15551234567']) }));

  assert.equal(res.kind, 'sent');
});

test('sendRecipient verifies consent itself when no set is preloaded', async () => {
  // No `consented` argument — the per-message lookup is the fallback path, and
  // an empty consent table must stop the send.
  mock.setResolver((s) => (s.table === 'rsvp_parties' ? { data: [] } : {}));

  const res = await __sendRecipientForTests(sendArgs());

  assert.equal(res.kind, 'skipped');
  assert.equal(res.error, 'NO_SMS_CONSENT');
});

test('sendRecipient FAILS CLOSED when the consent lookup errors', async () => {
  // Contrast with the opt-out suppression lookup, which fails open so a missing
  // table cannot halt all sending. Consent is the opposite: absence of proof of
  // consent is not consent, so an error must block the send.
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties') return { error: { message: 'connection reset' } };
    return {};
  });

  const res = await __sendRecipientForTests(sendArgs());

  assert.equal(res.kind, 'skipped');
  assert.equal(res.error, 'CONSENT_CHECK_FAILED');
  assert.equal(mock.calls.some(c => c.op === 'rpc' && /deduct/.test(c.fn || '')), false);
});

test('consent is checked BEFORE billing and before the opt-out lookup', async () => {
  mock.setResolver(() => ({}));

  await __sendRecipientForTests(sendArgs({ consented: new Set() }));

  assert.equal(mock.calls.some(c => c.table === 'sms_opt_outs'), false,
    'a non-consenting number should short-circuit before any further work');
});
