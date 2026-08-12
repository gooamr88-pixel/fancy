require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');
const { mockReq, invoke } = require('./helpers/http');

/**
 * "SEND AN INVITATION" — the endpoint behind the modal that replaced Add Guest.
 *
 * The behaviour worth pinning here is not that a guest row appears. It is the
 * set of promises the modal makes on the organizer's behalf, each of which was
 * either absent or wrong before:
 *
 *   1. A guest must have SOME way of being reached. A row with neither an email
 *      nor a number can never be invited, reminded, confirmed or told the event
 *      moved — and it silently consumes a plan's guest cap.
 *   2. The invitation goes out on EVERY channel that can carry it. It used to be
 *      email-only, so a guest added with a consented number on a texting event
 *      was created and then left waiting for nothing.
 *   3. Whether an event is ready to invite people is a fact about the EVENT, not
 *      about a carrier — so a draft/unpaid event refuses both channels, not just
 *      the one that happened to check.
 *   4. A failed send NEVER fails the add. The guest is committed before anything
 *      is dispatched, and the response reports per channel so the UI can say
 *      which half worked rather than showing one boolean for two outcomes.
 *   5. The guest lands PENDING, because they have not answered. Recording a
 *      guess here would drop them out of the reminder sweep, which targets
 *      pending parties only.
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });
injectModule('../../utils/realtime', { broadcast: () => {} });

/* Both services are doubled: this suite is about the CONTROLLER's orchestration
   — who it calls, in what circumstances, and what it reports — not about
   delivery, which has its own tests. */
const guestCalls = [];
injectModule('../../services/guestService', {
  addGuest: async (args) => {
    guestCalls.push(args);
    return { success: true, party_id: PARTY, guest_id: GUEST };
  },
  GUEST_CATEGORIES: ['standard', 'vip', 'family'],
});

let inviteBehaviour = {};
const inviteCalls = { email: [], sms: [], resolve: 0 };
injectModule('../../services/invitationService', {
  resolveLiveEvent: async () => {
    inviteCalls.resolve += 1;
    return inviteBehaviour.live === false
      ? { event: null, code: inviteBehaviour.liveCode || 'EVENT_NOT_LIVE' }
      : { event: { id: EVENT, title: 'Wedding', slug: 'wedding' } };
  },
  sendEmailInvite: async (event, party) => {
    inviteCalls.email.push(party);
    if (inviteBehaviour.emailThrows) throw new Error('brevo exploded');
    return inviteBehaviour.email || { sent: true };
  },
  sendInvitationSmsBulk: async (eventId, partyIds, opts) => {
    inviteCalls.sms.push({ eventId, partyIds, opts });
    if (inviteBehaviour.smsThrows) throw new Error('carrier exploded');
    return inviteBehaviour.sms || { sent: 1, skipped: 0, failed: 0, breakdown: [] };
  },
});

const rsvpController = require('../controllers/rsvpController');

const EVENT = '11111111-1111-4111-8111-111111111111';
const PARTY = '22222222-2222-4222-8222-222222222222';
const GUEST = '44444444-4444-4444-8444-444444444444';
const USER = '33333333-3333-4333-8333-333333333333';

t.beforeEach(() => {
  mock.reset();
  guestCalls.length = 0;
  inviteCalls.email.length = 0;
  inviteCalls.sms.length = 0;
  inviteCalls.resolve = 0;
  inviteBehaviour = {};
});

const addGuest = (body) => invoke(
  rsvpController.addGuestManually,
  mockReq({ params: { eventId: EVENT }, body, user: { id: USER } }),
);

/* ── 1. A guest has to be reachable ────────────────────────────────────── */

test('a name with no email and no number is refused', async () => {
  const { res } = await addGuest({ guestName: 'Sara Mahmoud' });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
  assert.match(res.body.message, /email address or a mobile number/i);
  assert.equal(guestCalls.length, 0, 'nothing may be written for an unreachable guest');
});

test('an email alone is enough — it is no longer the only option, just one of two', async () => {
  const { res } = await addGuest({ guestName: 'Sara', email: 'sara@example.com' });

  assert.equal(res.statusCode, 201);
  assert.equal(inviteCalls.email.length, 1);
  assert.equal(inviteCalls.sms.length, 0, 'no number, nothing to text');
});

test('a mobile number alone is enough — the old form refused this outright', async () => {
  const { res } = await addGuest({ guestName: 'Sara', phone: '+15551234567', smsConsentAttested: true });

  assert.equal(res.statusCode, 201);
  assert.equal(inviteCalls.sms.length, 1);
  assert.equal(inviteCalls.email.length, 0, 'no address, nothing to email');
});

test('a companion added to an existing party is exempt, and is sent nothing', async () => {
  // The invitation is addressed to the party's primary contact, who already has
  // one. Companions are names only and have no contact details of their own.
  const { res } = await addGuest({ guestName: 'Guest 2', partyId: PARTY });

  assert.equal(res.statusCode, 201);
  assert.equal(inviteCalls.resolve, 0, 'a companion must not even resolve the event');
  assert.equal(inviteCalls.email.length + inviteCalls.sms.length, 0);
});

/* ── 2. Both channels, when both can carry it ──────────────────────────── */

test('email AND number → the invitation goes out twice, and both are reported', async () => {
  const { res } = await addGuest({
    guestName: 'Sara', email: 'sara@example.com', phone: '+15551234567', smsConsentAttested: true,
  });

  assert.equal(res.statusCode, 201);
  assert.equal(inviteCalls.email.length, 1);
  assert.equal(inviteCalls.sms.length, 1);

  const { email, sms } = res.body.data.invitation;
  assert.deepEqual(
    { attempted: email.attempted, sent: email.sent, to: email.to },
    { attempted: true, sent: true, to: 'sara@example.com' },
  );
  assert.deepEqual(
    { attempted: sms.attempted, sent: sms.sent, to: sms.to },
    { attempted: true, sent: true, to: '+15551234567' },
  );
});

test('the text goes through the one bulk SMS path, as an invitation', async () => {
  // Not a shortcut of its own. That path carries every gate — entitlement, the
  // organizer's per-type switch, idempotency, consent, STOP suppression,
  // transport, atomic billing and the ramp-up cap — and a second door into the
  // subsystem would be a second place for all of that to be missing.
  await addGuest({ guestName: 'Sara', phone: '+15551234567', smsConsentAttested: true });

  const call = inviteCalls.sms[0];
  assert.deepEqual(call.partyIds, [PARTY]);
  assert.equal(call.opts.type, 'invitation');
  assert.equal(call.opts.user.id, USER, 'the ramp-up cap is resolved per user');
});

/* ── 2b. The caller's stated channels win over any re-derivation ───────── */

test('channels: ["email"] with a number present sends no text', async () => {
  // The screen tells the organizer which channels will carry the invitation
  // BEFORE they press send. If the server re-derived the answer, a guest with
  // both details on an event with no texting would be promised "by email only"
  // and then handed a failed-text result for something they were told would not
  // be attempted.
  const { res } = await addGuest({
    guestName: 'Sara', email: 'sara@example.com', phone: '+15551234567',
    smsConsentAttested: true, channels: ['email'],
  });

  assert.equal(inviteCalls.email.length, 1);
  assert.equal(inviteCalls.sms.length, 0);
  assert.equal(res.body.data.invitation.sms.attempted, false, 'an unattempted channel reports nothing at all');
});

test('channels: ["sms"] with an address present sends no email', async () => {
  await addGuest({
    guestName: 'Sara', email: 'sara@example.com', phone: '+15551234567',
    smsConsentAttested: true, channels: ['sms'],
  });

  assert.equal(inviteCalls.email.length, 0);
  assert.equal(inviteCalls.sms.length, 1);
});

test('the number is still stored when sms is not among the channels', async () => {
  // It belongs on the guest record either way — it is what makes a later send
  // possible once texting is switched on.
  await addGuest({
    guestName: 'Sara', email: 'sara@example.com', phone: '+15551234567', channels: ['email'],
  });

  assert.equal(guestCalls[0].phone, '+15551234567');
});

test('with no channels field, an unattested number is not texted', async () => {
  // The fallback for callers that predate the field. Attempting a text with no
  // consent on record would only ever produce a skip row and a confusing result.
  await addGuest({ guestName: 'Sara', phone: '+15551234567' });

  assert.equal(inviteCalls.sms.length, 0);
});

test('with no channels field, an attested number IS texted', async () => {
  await addGuest({ guestName: 'Sara', phone: '+15551234567', smsConsentAttested: true });

  assert.equal(inviteCalls.sms.length, 1);
});

/* ── 3. Liveness is a fact about the event, not about a channel ────────── */

test('a draft or unpaid event refuses BOTH channels with the same reason', async () => {
  inviteBehaviour = { live: false, liveCode: 'EVENT_NOT_LIVE' };

  const { res } = await addGuest({
    guestName: 'Sara', email: 'sara@example.com', phone: '+15551234567', smsConsentAttested: true,
  });

  assert.equal(res.statusCode, 201, 'the guest is still added');
  const { email, sms } = res.body.data.invitation;
  assert.equal(email.sent, false);
  assert.equal(sms.sent, false);
  assert.equal(email.reason, 'EVENT_NOT_LIVE');
  assert.equal(sms.reason, 'EVENT_NOT_LIVE');
  assert.equal(inviteCalls.sms.length, 0, 'nothing is dispatched, so nothing is billed');
  assert.ok(email.reasonText && sms.reasonText, 'both legs explain themselves in words');
});

/* ── 4. A send can fail; the guest still exists ────────────────────────── */

test('an email that will not deliver does not fail the request', async () => {
  inviteBehaviour = { email: { sent: false, reason: 'DELIVERY_FAILED' } };

  const { res } = await addGuest({ guestName: 'Sara', email: 'sara@example.com' });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.partyId, PARTY);
  assert.equal(res.body.data.invitation.email.sent, false);
  assert.equal(res.body.data.invitation.email.reason, 'DELIVERY_FAILED');
});

test('a THROWN send is caught per channel — the other one still goes', async () => {
  inviteBehaviour = { smsThrows: true };

  const { res } = await addGuest({
    guestName: 'Sara', email: 'sara@example.com', phone: '+15551234567', smsConsentAttested: true,
  });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.invitation.email.sent, true, 'the email is unaffected by the carrier');
  assert.equal(res.body.data.invitation.sms.sent, false);
  assert.equal(res.body.data.invitation.sms.reason, 'SEND_FAILED');
});

test('a guest with no consent is reported with the reason, not silently skipped', async () => {
  // The organizer needs to be told WHY, in the same words the guest list and the
  // message history use — otherwise the product looks like it lost the message.
  inviteBehaviour = {
    sms: { sent: 0, skipped: 1, failed: 0, breakdown: [{ reason: 'NO_CONSENT', count: 1, message: "They haven't agreed to receive texts" }] },
  };

  // `channels` forces the attempt. It happens for real when the attestation
  // write itself failed — recordHostConsentAttestation is best-effort by design,
  // so the number can be stored with the organizer believing they confirmed it.
  const { res } = await addGuest({ guestName: 'Sara', phone: '+15551234567', channels: ['sms'] });

  const { sms } = res.body.data.invitation;
  assert.equal(sms.sent, false);
  assert.equal(sms.reason, 'NO_CONSENT');
  assert.match(sms.reasonText, /agreed to receive texts/i);
});

test('a hard SMS refusal (no add-on, over the cap) keeps its own sentence', async () => {
  inviteBehaviour = { sms: { code: 'ADDON_INACTIVE', message: 'Text messaging is not active for this event yet.' } };

  const { res } = await addGuest({ guestName: 'Sara', phone: '+15551234567', smsConsentAttested: true });

  const { sms } = res.body.data.invitation;
  assert.equal(sms.sent, false);
  assert.equal(sms.reason, 'ADDON_INACTIVE');
  assert.match(sms.reasonText, /not active/i);
});

/* ── 5. They have not answered yet ─────────────────────────────────────── */

test('a guest invited from this screen lands PENDING', async () => {
  // The form no longer asks. Recording a guess would take them out of
  // jobRsvpReminders, which chases pending parties only — so the organizer would
  // have invited somebody the platform then never chased.
  await addGuest({ guestName: 'Sara', email: 'sara@example.com' });

  assert.equal(guestCalls[0].response, 'pending');
});

test('an explicit response is still honoured, so the import path is unaffected', async () => {
  await addGuest({ guestName: 'Sara', email: 'sara@example.com', response: 'yes' });

  assert.equal(guestCalls[0].response, 'yes');
});

/* ── The number is normalized once ─────────────────────────────────────── */

test('the number stored and the number reported back are the same value', async () => {
  const { res } = await addGuest({ guestName: 'Sara', phone: '(555) 123-4567', smsConsentAttested: true });

  assert.equal(
    res.body.data.invitation.sms.to,
    guestCalls[0].phone,
    'reporting a different string than was stored is how an organizer ends up chasing the wrong number',
  );
});

test('an unusable number is refused before anything is written', async () => {
  const { res } = await addGuest({ guestName: 'Sara', phone: '12' });

  assert.equal(res.statusCode, 400);
  assert.equal(guestCalls.length, 0);
});
