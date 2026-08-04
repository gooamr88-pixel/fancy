require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');

/**
 * TRANSPORT GATE — never bill for a message that had no way to be sent.
 *
 * sendRecipient used to debit the wallet BEFORE checking whether a Twilio client
 * existed. With no client it then stamped the ledger with a fabricated
 * `mock-sid-…` and returned `sent`. In production that is the state whenever
 * SMS_ENABLED is false or a TWILIO_* credential is missing — so the organizer
 * paid real money, their allowance drained, the dashboard reported success, and
 * not one handset rang. The failure was invisible precisely because it looked
 * exactly like the happy path.
 *
 * The gate now precedes the debit. Billing without a transport survives only as
 * an explicit opt-in (SMS_MOCK_BILLING) that the suite sets so the ledger path
 * itself stays testable offline — see helpers/env.js.
 *
 * These tests own the boundary between those two modes. If a future refactor
 * moves the debit back above the transport check, the first test fails.
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const EVENT = '11111111-1111-4111-8111-111111111111';
const PHONE = '+15551234567';

// Consent + suppression are upstream gates with their own suite; satisfy them so
// these tests observe the transport/billing boundary and nothing else.
const consented = new Set([PHONE]);
const notOptedOut = new Set();

/**
 * Run `fn(smsDispatch)` with SMS_MOCK_BILLING forced to `value`.
 *
 * The flag is read at CALL time by smsMockBillingEnabled(), not at require time,
 * so it has to stay in place for the duration of the send — restoring it right
 * after the require would leave the suite-wide 'true' in effect and every
 * assertion here would silently measure the opposite mode.
 */
async function withMockBilling(value, fn) {
  const prev = process.env.SMS_MOCK_BILLING;
  if (value === undefined) delete process.env.SMS_MOCK_BILLING;
  else process.env.SMS_MOCK_BILLING = value;

  delete require.cache[require.resolve('../config/features')];
  delete require.cache[require.resolve('../services/smsDispatch')];

  try {
    return await fn(require('../services/smsDispatch'));
  } finally {
    if (prev === undefined) delete process.env.SMS_MOCK_BILLING;
    else process.env.SMS_MOCK_BILLING = prev;
    delete require.cache[require.resolve('../config/features')];
    delete require.cache[require.resolve('../services/smsDispatch')];
  }
}

t.beforeEach(() => mock.reset());

test('no transport and no explicit opt-in => skipped, and the wallet is NEVER debited', async () => {
  let deductCalls = 0;
  mock.setResolver((s) => {
    if (s.op === 'rpc' && /deduct_sms_credit/.test(s.fn)) {
      deductCalls++;
      return { data: { success: true, wallet_id: 'w1', ledger_id: 'l1' } };
    }
    return {};
  });

  const res = await withMockBilling(undefined, ({ sendRecipient }) => sendRecipient({
    eventId: EVENT, phone: PHONE, body: 'hi', segments: 1,
    idemKey: 'k1', twilio: null, fromNumber: '+15550000000',
    optedOut: notOptedOut, consented,
  }));

  assert.equal(res.kind, 'skipped');
  assert.equal(res.error, 'SMS_TRANSPORT_DISABLED',
    'a missing transport must be reported as its own reason, not as a generic failure');
  assert.equal(deductCalls, 0,
    'THE regression: no transport means no message, so nothing may be charged');
});

test('the skip is not recorded as a send (no fabricated mock SID reaches the ledger)', async () => {
  // Deduction is scripted to SUCCEED here on purpose: if the gate ever regresses,
  // this test must observe a real 'sent' with a mock SID rather than a deduction
  // failure that would mask the regression behind the right-looking outcome.
  mock.setResolver((s) => {
    if (s.op === 'rpc' && /deduct_sms_credit/.test(s.fn)) {
      return { data: { success: true, wallet_id: 'w1', ledger_id: 'l1' } };
    }
    return {};
  });

  const res = await withMockBilling(undefined, ({ sendRecipient }) => sendRecipient({
    eventId: EVENT, phone: PHONE, body: 'hi', segments: 1,
    idemKey: 'k2', twilio: null, fromNumber: '+15550000000',
    optedOut: notOptedOut, consented,
  }));

  assert.equal(res.kind, 'skipped', 'a skipped send must never be reported as sent');
  assert.equal(res.sid, undefined, 'no SID may be invented for a message that never existed');
  const ledgerWrites = mock.calls.filter((c) => c.table === 'sms_credit_ledger');
  assert.equal(ledgerWrites.length, 0, 'the ledger must stay untouched');
});

test('SMS_MOCK_BILLING=true restores the billable mock transport the suite relies on', async () => {
  let deductCalls = 0;
  mock.setResolver((s) => {
    if (s.op === 'rpc' && /deduct_sms_credit/.test(s.fn)) {
      deductCalls++;
      return { data: { success: true, wallet_id: 'w1', ledger_id: 'l1' } };
    }
    return {};
  });

  const res = await withMockBilling('true', ({ sendRecipient }) => sendRecipient({
    eventId: EVENT, phone: PHONE, body: 'hi', segments: 1,
    idemKey: 'k3', twilio: null, fromNumber: '+15550000000',
    optedOut: notOptedOut, consented,
  }));

  assert.equal(res.kind, 'sent');
  assert.equal(deductCalls, 1, 'the opt-in path still exercises the real billing RPC');
  assert.match(res.sid, /^mock-sid-/, 'and still stamps a clearly-marked mock SID');
});

test('a real transport is unaffected by the gate', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && /deduct_sms_credit/.test(s.fn)) {
      return { data: { success: true, wallet_id: 'w1', ledger_id: 'l1' } };
    }
    return {};
  });

  const twilio = { messages: { create: async () => ({ sid: 'SM_real_123' }) } };
  const res = await withMockBilling(undefined, ({ sendRecipient }) => sendRecipient({
    eventId: EVENT, phone: PHONE, body: 'hi', segments: 1,
    idemKey: 'k4', twilio, fromNumber: '+15550000000',
    optedOut: notOptedOut, consented,
  }));

  assert.equal(res.kind, 'sent');
  assert.equal(res.sid, 'SM_real_123');
});

/* ── smsEnabled() must require what it takes to actually dispatch ───────────── */

test('smsEnabled() is false when the flag is set but credentials are missing', () => {
  const saved = { ...process.env };
  try {
    process.env.SMS_ENABLED = 'true';
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.TWILIO_FROM_NUMBER;

    delete require.cache[require.resolve('../config/features')];
    const { smsEnabled } = require('../config/features');

    assert.equal(smsEnabled(), false,
      'a flag alone cannot send; claiming otherwise is what let mock mode bill silently');
  } finally {
    process.env = saved;
    delete require.cache[require.resolve('../config/features')];
  }
});

test('smsEnabled() is true only with the flag AND a full credential set', () => {
  const saved = { ...process.env };
  try {
    process.env.SMS_ENABLED = 'true';
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    process.env.TWILIO_PHONE_NUMBER = '+18005550100';

    delete require.cache[require.resolve('../config/features')];
    const { smsEnabled } = require('../config/features');

    assert.equal(smsEnabled(), true);
  } finally {
    process.env = saved;
    delete require.cache[require.resolve('../config/features')];
  }
});

test('getTwilioFromNumber() returns null rather than Twilio\'s magic test number', () => {
  const saved = { ...process.env };
  try {
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.TWILIO_FROM_NUMBER;

    delete require.cache[require.resolve('../utils/twilioClient')];
    const { getTwilioFromNumber } = require('../utils/twilioClient');

    assert.equal(getTwilioFromNumber(), null,
      'falling back to +15005550006 made every live send fail at the carrier with a misleading cause');
  } finally {
    process.env = saved;
    delete require.cache[require.resolve('../utils/twilioClient')];
  }
});
