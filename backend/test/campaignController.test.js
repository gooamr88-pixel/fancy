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

const baseReq = (overrides = {}) =>
  mockReq({ params: { eventId: 'evt-1' }, body: { messageTemplate: 'Hi {name} {url}' }, user: { id: 'owner-1' }, ...overrides });

test('a missing message template is rejected (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(sendBulkSMSCampaign, baseReq({ body: {} }));
  assert.equal(res.statusCode, 400);
});

test('an over-length template (>1600 chars) is rejected (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(sendBulkSMSCampaign, baseReq({ body: { messageTemplate: 'x'.repeat(1601) } }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
});

test('no wallet => 402 NO_CREDIT_WALLET (cannot send without buying credits)', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'events' && op === 'select') return { data: { slug: 'wedding' } };
    if (table === 'rsvps' && op === 'select') return { data: [{ id: 'g1', guest_name: 'A', phone: '+15551112222', email: null }] };
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
    if (table === 'rsvps' && op === 'select') return { data: [
      { id: 'g1', guest_name: 'A', phone: '+1', email: null },
      { id: 'g2', guest_name: 'B', phone: '+2', email: null },
      { id: 'g3', guest_name: 'C', phone: '+3', email: null },
    ] };
    if (table === 'sms_credit_wallets' && op === 'select') return { data: { credits_remaining: 2 } };
    return {};
  });
  const { res } = await invoke(sendBulkSMSCampaign, baseReq());
  assert.equal(res.statusCode, 402);
  assert.equal(res.body.error, 'INSUFFICIENT_CREDITS');
  assert.equal(res.body.requiredCredits, 3);
  assert.equal(res.body.availableCredits, 2);
  // The atomic deduction RPC must never have run.
  assert.equal(mock.calls.some(c => c.op === 'rpc' && c.fn === 'deduct_sms_credit_atomic'), false);
});

test('no pending guests with phone numbers => 200 with sentCount 0', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'events' && op === 'select') return { data: { slug: 'wedding' } };
    if (table === 'rsvps' && op === 'select') return { data: [] };
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
    if (s.table === 'rsvps' && s.op === 'select') return { data: [
      { id: 'g1', guest_name: 'A', phone: '+1', email: null },
      { id: 'g2', guest_name: 'B', phone: '+2', email: null },
    ] };
    if (s.table === 'sms_credit_wallets' && s.op === 'select') return { data: { credits_remaining: 10 } };
    if (s.op === 'rpc' && s.fn === 'deduct_sms_credit_atomic') {
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
    if (s.table === 'rsvps' && s.op === 'select') return { data: [
      { id: 'g1', guest_name: 'A', phone: '+1', email: null },
      { id: 'g2', guest_name: 'B', phone: '+2', email: null },
    ] };
    if (s.table === 'sms_credit_wallets' && s.op === 'select') return { data: { credits_remaining: 10 } };
    if (s.op === 'rpc' && s.fn === 'deduct_sms_credit_atomic') {
      // g1 succeeds, g2 loses the race for the last credit.
      if (s.params.p_phone === '+1') return { data: { success: true, wallet_id: 'w1', ledger_id: 'l1' } };
      return { data: { success: false, error: 'INSUFFICIENT_CREDITS' } };
    }
    return {};
  });

  const { res } = await invoke(sendBulkSMSCampaign, baseReq());
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sentCount, 1);
  assert.equal(res.body.failedCount, 1);
});
