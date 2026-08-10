require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');

/**
 * TRANSACTIONAL (LIFECYCLE) SMS — the gate chain and the fallback contract.
 *
 * sendTransactionalSms is the single door for the six automated message types.
 * Two invariants matter more than anything else it does:
 *
 *   1. NOTHING IS SENT OR BILLED WITHOUT PASSING EVERY GATE, in order:
 *      add-on purchased → type enabled → not a duplicate → recipient consented →
 *      not opted out → allowance available. A regression that reorders these —
 *      particularly one that bills before checking consent — is a TCPA problem and
 *      a refund problem at the same time.
 *
 *   2. EVERY REFUSAL IS REPORTED, NEVER SWALLOWED. The caller uses the returned
 *      reason to send the email instead. If this function ever returns
 *      `{ sent: true }` on a path that did not send, or throws instead of
 *      returning, a guest silently hears nothing at all about their own RSVP.
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { sendTransactionalSms } = require('../services/smsDispatch');

const EVENT = '11111111-1111-4111-8111-111111111111';
const PARTY = '22222222-2222-4222-8222-222222222222';
const PHONE = '+15551234567';

const paidEvent = (settings = {}) => ({
  id: EVENT,
  sms_addon_purchased_at: '2026-08-04T00:00:00.000Z',
  sms_settings: { invitation: true, organizer_report: true, ...settings },
});

/**
 * Script the full happy-path read set. Individual tests override one piece to
 * isolate the gate they care about.
 */
function scriptHappyPath({
  consented = true, optedOut = false, alreadyLogged = false, deductOk = true,
  orgConsent = true, orgPhone = PHONE,
} = {}) {
  const state = { deducts: 0, logs: [] };

  mock.setResolver((s) => {
    // alreadySent() — prior sms_log rows for this (kind, ref)
    if (s.table === 'sms_log' && s.op === 'select') {
      return { data: alreadyLogged ? [{ id: 'prev' }] : [] };
    }
    if (s.table === 'sms_log' && s.op === 'insert') {
      state.logs.push(s.payload);
      return {};
    }

    // resolveRecipient (organizer audience) reads the event's organization
    if (s.table === 'events' && s.op === 'select' && String(s.cols).includes('organizations')) {
      return { data: { organizations: { sms_phone: orgPhone, sms_consent: orgConsent } } };
    }
    if (s.table === 'events' && s.op === 'select') return { data: paidEvent() };

    // resolveRecipient (guest audience) — single party row
    if (s.table === 'rsvp_parties' && s.terminal === 'single') {
      return { data: { sms_consent: consented, guests: [{ phone: PHONE, is_primary_contact: true }] } };
    }
    // getConsentedPhoneSet inside sendRecipient — the event's consented numbers
    if (s.table === 'rsvp_parties') {
      return { data: consented ? [{ guests: { phone: PHONE, is_primary_contact: true } }] : [] };
    }

    if (s.table === 'sms_opt_outs') return { data: optedOut ? [{ phone: PHONE }] : [] };

    if (s.op === 'rpc' && /deduct_sms_credit/.test(s.fn)) {
      state.deducts++;
      return deductOk
        ? { data: { success: true, wallet_id: 'w1', ledger_id: 'l1' } }
        : { data: { success: false, error: 'INSUFFICIENT_CREDITS' } };
    }
    return {};
  });

  return state;
}

const reminder = (overrides = {}) => ({
  type: 'invitation',
  eventId: EVENT,
  partyId: PARTY,
  ref: `rsvp:${PARTY}`,
  context: { guestName: 'Alice', eventTitle: 'Spring Gala', rsvpUrl: 'https://x.co/r' },
  ...overrides,
});

t.beforeEach(() => mock.reset());

/* ── The gate chain ─────────────────────────────────────────────────────── */

test('an event without the add-on sends nothing and bills nothing', async () => {
  const state = scriptHappyPath();
  const res = await sendTransactionalSms(reminder({
    event: { id: EVENT, sms_addon_purchased_at: null, sms_settings: {} },
  }));

  assert.equal(res.sent, false);
  assert.equal(res.reason, 'ADDON_INACTIVE');
  assert.equal(state.deducts, 0);
});

test('a type the organizer switched off is skipped, with a distinct reason', async () => {
  const state = scriptHappyPath();
  const res = await sendTransactionalSms(reminder({
    event: paidEvent({ invitation: false }),
  }));

  assert.equal(res.sent, false);
  assert.equal(res.reason, 'TYPE_DISABLED',
    'an organizer choice must be distinguishable from a compliance block — they need very different follow-up');
  assert.equal(state.deducts, 0);
});

test('a message already sent for this (kind, ref) is not sent again', async () => {
  const state = scriptHappyPath({ alreadyLogged: true });
  const res = await sendTransactionalSms(reminder({ event: paidEvent() }));

  assert.equal(res.sent, false);
  assert.equal(res.reason, 'DUPLICATE');
  assert.equal(state.deducts, 0,
    'the scheduler re-runs every few minutes over the same rows; without this the organizer pays on every tick');
});

test('a guest who never consented is never messaged and never billed', async () => {
  const state = scriptHappyPath({ consented: false });
  const res = await sendTransactionalSms(reminder({ event: paidEvent() }));

  assert.equal(res.sent, false);
  assert.equal(res.reason, 'NO_CONSENT');
  assert.equal(state.deducts, 0, 'consent is checked BEFORE any debit');
});

test('a guest who replied STOP is suppressed even with consent on record', async () => {
  const state = scriptHappyPath({ consented: true, optedOut: true });
  const res = await sendTransactionalSms(reminder({ event: paidEvent() }));

  assert.equal(res.sent, false);
  assert.equal(res.reason, 'OPTED_OUT',
    'a STOP reply outranks every consent record and every organizer setting');
  assert.equal(state.deducts, 0);
});

test('an exhausted allowance reports NO_ALLOWANCE so the caller can fall back', async () => {
  scriptHappyPath({ deductOk: false });
  const res = await sendTransactionalSms(reminder({ event: paidEvent() }));

  assert.equal(res.sent, false);
  assert.equal(res.reason, 'NO_ALLOWANCE',
    'running out of credit is a billing state, not a delivery failure — the guest must still get the email');
});

/* ── The happy path ─────────────────────────────────────────────────────── */

test('a fully-permitted message is sent, billed once, and logged', async () => {
  const state = scriptHappyPath();
  const res = await sendTransactionalSms(reminder({ event: paidEvent() }));

  assert.equal(res.sent, true);
  assert.equal(state.deducts, 1);

  const sentLog = state.logs.find((l) => l.status === 'sent');
  assert.ok(sentLog, 'a successful send must leave an audit row');
  assert.equal(sentLog.kind, 'invitation');
  assert.equal(sentLog.ref, `rsvp:${PARTY}`);
  assert.equal(sentLog.recipient, PHONE);
});

test('every skip is written to sms_log with its reason', async () => {
  const state = scriptHappyPath({ consented: false });
  await sendTransactionalSms(reminder({ event: paidEvent() }));

  const skipped = state.logs.find((l) => l.status === 'skipped');
  assert.ok(skipped, '"why did my guest not get this?" must be answerable from data');
  assert.equal(skipped.skip_reason, 'NO_CONSENT');
  assert.equal(skipped.credits, 0);
});

/* ── Audience separation ────────────────────────────────────────────────── */

test('an organizer-audience type reads the ORGANIZER\'s consent, not a guest\'s', async () => {
  // Guest consent is false here; it must be irrelevant to an organizer message.
  const state = scriptHappyPath({ consented: false, orgConsent: true });
  const res = await sendTransactionalSms({
    type: 'organizer_report',
    eventId: EVENT,
    ref: `event:${EVENT}`,
    event: paidEvent(),
    context: { eventTitle: 'Spring Gala', attending: 42, pending: 3, dashboardUrl: 'https://x.co/d' },
  });

  assert.equal(res.sent, true, 'the organizer opted in themselves; no guest record applies');
  assert.equal(state.deducts, 1);
});

test('an organizer who never opted in is not texted', async () => {
  scriptHappyPath({ orgConsent: false });
  const res = await sendTransactionalSms({
    type: 'organizer_report',
    eventId: EVENT,
    ref: `event:${EVENT}`,
    event: paidEvent(),
    context: { eventTitle: 'Spring Gala', attending: 1, pending: 0, dashboardUrl: 'https://x.co/d' },
  });

  assert.equal(res.sent, false);
  assert.equal(res.reason, 'NO_CONSENT',
    'being our paying customer is not consent to be texted');
});

test('a recipient with no phone on file is skipped cleanly', async () => {
  scriptHappyPath({ orgPhone: null });
  const res = await sendTransactionalSms({
    type: 'organizer_report',
    eventId: EVENT,
    ref: `event:${EVENT}`,
    event: paidEvent(),
    context: { eventTitle: 'Gala', attending: 0, pending: 0, dashboardUrl: 'https://x.co/d' },
  });

  assert.equal(res.sent, false);
  assert.equal(res.reason, 'NO_PHONE');
});

/* ── It must never throw ────────────────────────────────────────────────── */

test('an unknown message type is reported, not thrown', async () => {
  scriptHappyPath();
  const res = await sendTransactionalSms(reminder({ type: 'not_a_real_type', event: paidEvent() }));

  assert.equal(res.sent, false);
  assert.equal(res.reason, 'UNKNOWN_TYPE');
});

test('a database failure mid-flight returns a reason instead of throwing', async () => {
  mock.setResolver(() => { throw new Error('connection reset'); });

  const res = await sendTransactionalSms(reminder({ event: paidEvent() }));

  assert.equal(res.sent, false,
    'throwing here would break the RSVP submission — or the scheduler tick covering hundreds of other guests');
  assert.ok(res.reason);
});
