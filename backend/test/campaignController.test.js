require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

// No Twilio creds in the test env => twilioClient runs in mock mode (logs, no network).
const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { sendBulkSMSCampaign } = require('../controllers/campaignController');

t.beforeEach(() => mock.reset());

// `consentAttested` is REQUIRED by the controller (TCPA/CTIA + Terms §5 — the
// organizer must affirm they hold prior express consent for every host-supplied
// number). It was added with the Twilio toll-free verification work but never
// added here, so every test below this line was hitting the attestation gate and
// asserting against a 400 CONSENT_ATTESTATION_REQUIRED instead of the behaviour it
// meant to cover. The gate itself is now covered by its own test at the bottom.
const baseReq = (overrides = {}) =>
  mockReq({
    params: { eventId: 'evt-1' },
    body: { messageTemplate: 'Hi {name} {url}', audience: 'all', consentAttested: true },
    user: { id: 'owner-1' },
    ...overrides
  });

test('a missing message template is rejected (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(sendBulkSMSCampaign, baseReq({ body: { audience: 'all' } }));
  assert.equal(res.statusCode, 400);
});

test('an over-length template (>1600 chars) is rejected (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(sendBulkSMSCampaign, baseReq({ body: { messageTemplate: 'x'.repeat(1601), audience: 'all' } }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
});

test('no wallet => 402 NO_CREDIT_WALLET (cannot send without buying credits)', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'events' && op === 'select') return { data: { slug: 'wedding' } };
    if (table === 'rsvp_parties' && op === 'select') return { data: [{ id: 'g1', label: 'A', response: 'yes', guests: [{ is_primary_contact: true, phone: '+15551112222' }] }] };
    if (table === 'sms_credit_wallets' && op === 'select') return { data: null, error: { message: 'no rows' } };
    return {};
  });
  const { res } = await invoke(sendBulkSMSCampaign, baseReq());
  assert.equal(res.statusCode, 402);
  assert.equal(res.body.error, 'NO_CREDIT_WALLET');
});

test('insufficient credits => 402 with the required/available counts (no deduction)', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'events' && op === 'select') return { data: { slug: 'wedding' } };
    if (table === 'rsvp_parties' && op === 'select') return { data: [
      { id: 'g1', label: 'A', response: 'yes', guests: [{ is_primary_contact: true, phone: '+1' }] },
      { id: 'g2', label: 'B', response: 'yes', guests: [{ is_primary_contact: true, phone: '+2' }] },
      { id: 'g3', label: 'C', response: 'yes', guests: [{ is_primary_contact: true, phone: '+3' }] },
    ] };
    if (table === 'sms_credit_wallets' && op === 'select') return { data: { credits_remaining: 2 } };
    return {};
  });
  const { res } = await invoke(sendBulkSMSCampaign, baseReq());
  assert.equal(res.statusCode, 402);
  assert.equal(res.body.error, 'INSUFFICIENT_CREDITS');
  assert.equal(res.body.availableCredits, 2);
  // The atomic deduction RPC must never have run.
  assert.equal(mock.calls.some(c => c.op === 'rpc' && c.fn === 'deduct_sms_credit_atomic'), false);
});

test('no pending guests with phone numbers => 200 with sentCount 0', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'events' && op === 'select') return { data: { slug: 'wedding' } };
    if (table === 'rsvp_parties' && op === 'select') return { data: [] };
    return {};
  });
  const { res } = await invoke(sendBulkSMSCampaign, baseReq());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sentCount, 0);
});

test('happy path: one atomic deduction per guest, all sent (mock transport)', async () => {
  let deductCount = 0;
  mock.setResolver((s) => {
    if (s.table === 'events' && s.op === 'select') return { data: { slug: 'wedding' } };
    if (s.table === 'rsvp_parties' && s.op === 'select') return { data: [
      { id: 'g1', label: 'A', response: 'yes', guests: [{ is_primary_contact: true, phone: '+15551112222' }] },
      { id: 'g2', label: 'B', response: 'yes', guests: [{ is_primary_contact: true, phone: '+15551113333' }] },
    ] };
    if (s.table === 'sms_credit_wallets' && s.op === 'select') return { data: { credits_remaining: 10 } };
    if (s.op === 'rpc' && (s.fn === 'deduct_sms_credit_atomic' || s.fn === 'deduct_sms_credits_atomic')) {
      deductCount++;
      return { data: { success: true, wallet_id: 'w1', ledger_id: `l${deductCount}` } };
    }
    return {};
  });

  const { res } = await invoke(sendBulkSMSCampaign, baseReq());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sentCount, 2);
  assert.equal(res.body.failedCount, 0);
  assert.equal(deductCount, 2); // exactly one credit deducted per recipient
});

test('a guest whose atomic deduction fails is counted as failed, not sent', async () => {
  mock.setResolver((s) => {
    if (s.table === 'events' && s.op === 'select') return { data: { slug: 'wedding' } };
    if (s.table === 'rsvp_parties' && s.op === 'select') return { data: [
      { id: 'g1', label: 'A', response: 'yes', guests: [{ is_primary_contact: true, phone: '+15551112222' }] },
      { id: 'g2', label: 'B', response: 'yes', guests: [{ is_primary_contact: true, phone: '+15551113333' }] },
    ] };
    if (s.table === 'sms_credit_wallets' && s.op === 'select') return { data: { credits_remaining: 10 } };
    if (s.op === 'rpc' && (s.fn === 'deduct_sms_credit_atomic' || s.fn === 'deduct_sms_credits_atomic')) {
      // g1 succeeds, g2 loses the race for the last credit.
      if (s.params.p_phone === '+15551112222') return { data: { success: true, wallet_id: 'w1', ledger_id: 'l1' } };
      return { data: { success: false, error: 'INSUFFICIENT_CREDITS' } };
    }
    return {};
  });

  const { res } = await invoke(sendBulkSMSCampaign, baseReq());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sentCount, 1);
  assert.equal(res.body.failedCount, 1);
});

// ─── Consent attestation gate (TCPA/CTIA + Terms §5) ───
// This is the compliance control that the whole suite was accidentally exercising
// instead of its own subject matter. Assert it directly so it can't regress, and
// so a future change to the default fixture can't silently disable it again.

test('a campaign without a consent attestation is rejected (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(sendBulkSMSCampaign, baseReq({
    body: { messageTemplate: 'Hi {name} {url}', audience: 'all' },
  }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'CONSENT_ATTESTATION_REQUIRED');
  // Nothing may be looked up, let alone sent, before consent is affirmed.
  assert.equal(mock.calls.length, 0);
});

test('an explicit consentAttested: false is rejected (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(sendBulkSMSCampaign, baseReq({
    body: { messageTemplate: 'Hi {name} {url}', audience: 'all', consentAttested: false },
  }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'CONSENT_ATTESTATION_REQUIRED');
});

test("the string 'true' is accepted for form-encoded/hand-rolled API clients", async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'events' && op === 'select') return { data: { slug: 'wedding' } };
    if (table === 'rsvp_parties' && op === 'select') return { data: [] };
    return {};
  });
  const { res } = await invoke(sendBulkSMSCampaign, baseReq({
    body: { messageTemplate: 'Hi {name} {url}', audience: 'all', consentAttested: 'true' },
  }));
  // Past the gate: reaches the real handler and reports an empty audience.
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sentCount, 0);
});
