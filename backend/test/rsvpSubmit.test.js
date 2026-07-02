require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

// submitPublicRSVP now delegates the whole write to the submit_rsvp() RPC. These
// unit tests verify the CONTROLLER contract: DB-free shape validation, correct
// mapping of every RPC result code to an HTTP status, and the best-effort
// side-effects (broadcast + emails). The RPC's own logic (atomicity, concurrency,
// meal rules) is proven in test/integration/rsvpSubmitConcurrency.test.js.
let confirmCalls = [];
let emailCalls = [];
injectModule('../../utils/notificationService', {
  sendEmailViaBrevo: async (...a) => { emailCalls.push(a); return true; },
  sendConfirmationEmail: async (...a) => { confirmCalls.push(a); return true; },
  sendInvitationEmail: async () => ({ sent: true }),
  sendQRTicketEmail: async () => true,
});
injectModule('../../utils/realtime', { broadcast: async () => {} });

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { submitPublicRSVP } = require('../controllers/rsvpController');

t.beforeEach(() => { mock.reset(); confirmCalls = []; emailCalls = []; });

const req = (body) => mockReq({ params: { slug: 'wedding' }, body });
const rpcResult = (data) => mock.setResolver((s) => (s.op === 'rpc' && s.fn === 'submit_rsvp_v2' ? { data } : {}));

// ── Controller-side shape validation (no RPC should be issued) ──

test('guestName and response are required (400, no RPC)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(submitPublicRSVP, req({ guestName: '', response: '' }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
  assert.equal(mock.calls.some(c => c.op === 'rpc'), false);
});

test('party_size > 1 with too few additional guests is rejected before any RPC (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(submitPublicRSVP, req({ guestName: 'A', response: 'yes', partySize: 3, additionalGuests: [{ fullName: 'B' }] }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
  assert.equal(mock.calls.some(c => c.op === 'rpc'), false);
});

test('an additional guest without a name is rejected (400, no RPC)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(submitPublicRSVP, req({ guestName: 'A', response: 'yes', partySize: 2, additionalGuests: [{ fullName: '   ' }] }));
  assert.equal(res.statusCode, 400);
  assert.equal(mock.calls.some(c => c.op === 'rpc'), false);
});

// ── Defense-in-depth: allow_guest_edits (edits disabled at the API layer, not just hidden in the UI) ──

const partyLookup = (response, allowGuestEdits) => (s) =>
  s.table === 'rsvp_parties' && s.terminal === 'maybeSingle'
    ? { data: { response, events: { slug: 'wedding', allow_guest_edits: allowGuestEdits } } }
    : {};

test('editing an already-answered party is rejected (403, no RPC) when the organizer disabled edits', async () => {
  mock.setResolver(partyLookup('yes', false));
  const { res } = await invoke(submitPublicRSVP, req({ partyId: 'party-1', guestName: 'A', email: 'a@x.com', response: 'no' }));
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'RESPONSE_EDITS_DISABLED');
  assert.equal(mock.calls.some(c => c.op === 'rpc'), false);
});

test('editing an already-answered party proceeds to the RPC when the organizer allows edits', async () => {
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties' && s.terminal === 'maybeSingle') {
      return { data: { response: 'yes', events: { slug: 'wedding', allow_guest_edits: true } } };
    }
    if (s.op === 'rpc' && s.fn === 'submit_rsvp_v2') return { data: { success: true, party_id: 'party-1', response: 'no' } };
    return {};
  });
  const { res } = await invoke(submitPublicRSVP, req({ partyId: 'party-1', guestName: 'A', email: 'a@x.com', response: 'no' }));
  assert.equal(res.statusCode, 201);
  assert.equal(mock.calls.some(c => c.op === 'rpc'), true);
});

test('a first-time response (party still pending) is never blocked, regardless of allow_guest_edits', async () => {
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties' && s.terminal === 'maybeSingle') {
      return { data: { response: 'pending', events: { slug: 'wedding', allow_guest_edits: false } } };
    }
    if (s.op === 'rpc' && s.fn === 'submit_rsvp_v2') return { data: { success: true, party_id: 'party-1', response: 'yes' } };
    return {};
  });
  const { res } = await invoke(submitPublicRSVP, req({ partyId: 'party-1', guestName: 'A', email: 'a@x.com', response: 'yes', partySize: 1 }));
  assert.equal(res.statusCode, 201);
});

// ── RPC result code → HTTP status mapping ──

const codeCases = [
  ['EVENT_NOT_FOUND', 404],
  ['PAYMENT_REQUIRED', 402],
  ['EVENT_UNDER_REVIEW', 403],
  ['DEADLINE_PASSED', 400],
  ['DUPLICATE_RSVP', 409],
  ['MEAL_REQUIRED', 400],
  ['MEAL_INVALID', 400],
  ['RSVP_NOT_FOUND', 404],
  ['RSVP_OWNERSHIP_FAILED', 403],
  ['VALIDATION_ERROR', 400],
];

for (const [code, status] of codeCases) {
  test(`submit_rsvp result ${code} maps to HTTP ${status}`, async () => {
    rpcResult({ success: false, code, message: `message for ${code}` });
    const { res } = await invoke(submitPublicRSVP, req({ guestName: 'A', email: 'a@x.com', response: 'yes', partySize: 1 }));
    assert.equal(res.statusCode, status);
    assert.equal(res.body.error, code);
    assert.equal(res.body.message, `message for ${code}`);
  });
}

test('an unknown / missing result code defaults to 400', async () => {
  rpcResult({ success: false });
  const { res } = await invoke(submitPublicRSVP, req({ guestName: 'A', response: 'maybe' }));
  assert.equal(res.statusCode, 400);
});

// ── Happy paths + side-effects ──

test('a successful insert returns 201 with the new rsvpId and fires the confirmation email', async () => {
  rpcResult({
    success: true, rsvp_id: 'rsvp-NEW', party_id: 'rsvp-NEW', is_update: false, event_id: 'evt-1', event_title: 'Wedding',
    response: 'yes', party_size: 1, guest_email: 'a@x.com', notification_preferences: { email: false, whatsapp: false },
  });
  const { res } = await invoke(submitPublicRSVP, req({ guestName: 'Alice', email: 'a@x.com', response: 'yes', partySize: 1 }));
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.partyId, 'rsvp-NEW');
  assert.match(res.body.data.message, /submitted/);
  assert.equal(confirmCalls.length, 1); // attending guest gets a confirmation email
});

test('a successful update returns 201 with the "updated" message', async () => {
  rpcResult({
    success: true, rsvp_id: 'rsvp-1', is_update: true, event_id: 'evt-1', event_title: 'W',
    response: 'yes', party_size: 1, guest_email: null, notification_preferences: { email: false },
  });
  const { res } = await invoke(submitPublicRSVP, req({ rsvpId: 'rsvp-1', guestName: 'Alice', email: 'a@x.com', response: 'yes', partySize: 1 }));
  assert.equal(res.statusCode, 201);
  assert.match(res.body.data.message, /updated/);
});

test('a declined RSVP with an email sends the decline acknowledgement to the guest', async () => {
  rpcResult({
    success: true, rsvp_id: 'r1', is_update: false, event_id: 'evt-1', event_title: 'W',
    event_date: '2026-09-01T00:00:00Z', event_slug: 'wedding', response: 'no', party_size: 1,
    guest_email: 'a@x.com', notification_preferences: { email: false },
  });
  const { res } = await invoke(submitPublicRSVP, req({ guestName: 'Alice', email: 'a@x.com', response: 'no' }));
  assert.equal(res.statusCode, 201);
  assert.ok(emailCalls.some(a => a[0] === 'a@x.com'), 'decline email sent to the guest');
});

test('the organizer is emailed when preferences allow and an org email is present', async () => {
  rpcResult({
    success: true, rsvp_id: 'r1', is_update: false, event_id: 'evt-1', event_title: 'W',
    response: 'yes', party_size: 2, guest_email: null, notification_preferences: { email: true }, org_email: 'org@x.com',
  });
  const { res } = await invoke(submitPublicRSVP, req({ guestName: 'Alice', response: 'yes', partySize: 1 }));
  assert.equal(res.statusCode, 201);
  assert.ok(emailCalls.some(a => a[0] === 'org@x.com'), 'organizer notified by email');
});

test('a "maybe" RSVP labels the organizer email "Maybe" (amber), never "Declined"', async () => {
  rpcResult({
    success: true, rsvp_id: 'r1', is_update: false, event_id: 'evt-1', event_title: 'W',
    response: 'maybe', party_size: 1, guest_email: null, notification_preferences: { email: true }, org_email: 'org@x.com',
  });
  const { res } = await invoke(submitPublicRSVP, req({ guestName: 'Alice', response: 'maybe' }));
  assert.equal(res.statusCode, 201);
  const orgEmail = emailCalls.find(a => a[0] === 'org@x.com');
  assert.ok(orgEmail, 'organizer emailed');
  const html = orgEmail[2];
  assert.match(html, /Maybe/);
  assert.doesNotMatch(html, /Declined/);
  assert.match(html, /#9A7B3F/); // gold accent, not the red decline colour
});

test('a DB-level RPC error is forwarded to the Express error handler', async () => {
  mock.setResolver((s) => (s.op === 'rpc' ? { error: { message: 'connection reset' } } : {}));
  const { nextErr } = await invoke(submitPublicRSVP, req({ guestName: 'A', response: 'yes', partySize: 1 }));
  assert.ok(nextErr, 'next(err) was called');
});
