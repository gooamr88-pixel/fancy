require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

injectModule('../../utils/realtime', { broadcast: async () => {} });

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { scanCheckIn, selfCheckIn } = require('../controllers/checkinController');
const { generateTicketToken } = require('../utils/qrHelper');

t.beforeEach(() => mock.reset());

// ── QR scan check-in ──

test('scan with no token is rejected (400)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(scanCheckIn, mockReq({ params: { eventId: 'evt-1' }, body: {} }));
  assert.equal(res.statusCode, 400);
});

test('scan with a tampered/garbage token is rejected (400 INVALID_TICKET)', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(scanCheckIn, mockReq({ params: { eventId: 'evt-1' }, body: { token: 'not-a-jwt' } }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'INVALID_TICKET');
});

test('a ticket minted for another event is rejected (400 EVENT_MISMATCH)', async () => {
  mock.setResolver(() => ({}));
  const token = generateTicketToken({ guest_id: 'g1', event_id: 'evt-OTHER', table_name: 'T1', party_size: 2 });
  const { res } = await invoke(scanCheckIn, mockReq({ params: { eventId: 'evt-1' }, body: { token } }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'EVENT_MISMATCH');
});

test('a valid first scan checks the guest in (200)', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'check_ins' && op === 'insert') return { data: { id: 'ci-1' } };
    if (table === 'rsvps' && op === 'select') return { data: { guest_name: 'Alice' } };
    return {};
  });
  const token = generateTicketToken({ guest_id: 'g1', event_id: 'evt-1', table_name: 'T1', party_size: 2 });
  const { res } = await invoke(scanCheckIn, mockReq({ params: { eventId: 'evt-1' }, body: { token } }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.guestName, 'Alice');
  assert.equal(res.body.partySize, 2);
});

test('a second scan of the same ticket is rejected as ALREADY_CHECKED_IN (409)', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'check_ins' && op === 'insert') return { error: { code: '23505' } };
    if (table === 'check_ins' && op === 'select') return { data: { id: 'ci-1', checked_in_at: '2026-06-19T10:00:00Z' } };
    return {};
  });
  const token = generateTicketToken({ guest_id: 'g1', event_id: 'evt-1', table_name: 'T1', party_size: 2 });
  const { res } = await invoke(scanCheckIn, mockReq({ params: { eventId: 'evt-1' }, body: { token } }));
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'ALREADY_CHECKED_IN');
});

// ── Public self-service check-in ──

test('self check-in on an inactive event is blocked (403)', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'events') return { data: { id: 'evt-1', is_paid: true, status: 'paused' } };
    return {};
  });
  const { res } = await invoke(selfCheckIn, mockReq({ params: { slug: 'wedding' }, body: { rsvpId: 'r1', guestName: 'Alice' } }));
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'EVENT_INACTIVE');
});

test('self check-in without a guestName is rejected (400) — an rsvpId alone is not enough', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(selfCheckIn, mockReq({ params: { slug: 'wedding' }, body: { rsvpId: 'r1' } }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'VALIDATION_ERROR');
  // Rejected on input shape before any event/RSVP lookup.
  assert.equal(mock.calls.length, 0);
});

test('self check-in with a name that does not match the RSVP is rejected (400)', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'events') return { data: { id: 'evt-1', is_paid: true, status: 'active' } };
    if (table === 'rsvps') return { data: { id: 'r1', guest_name: 'Alice', party_size: 1, seating_assignments: [] } };
    return {};
  });
  const { res } = await invoke(selfCheckIn, mockReq({ params: { slug: 'wedding' }, body: { rsvpId: 'r1', guestName: 'Mallory' } }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'NAME_MISMATCH');
});

test('self check-in success returns 200 and the assigned table', async () => {
  mock.setResolver(({ table, op }) => {
    if (table === 'events') return { data: { id: 'evt-1', is_paid: true, status: 'active' } };
    if (table === 'rsvps') return { data: { id: 'r1', guest_name: 'Alice', party_size: 2, seating_assignments: [{ tables: { table_name: 'Table 5' } }] } };
    if (table === 'check_ins' && op === 'insert') return { data: { id: 'ci-1' } };
    return {};
  });
  const { res } = await invoke(selfCheckIn, mockReq({ params: { slug: 'wedding' }, body: { rsvpId: 'r1', guestName: 'Alice' } }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.tableName, 'Table 5');
  assert.equal(res.body.partySize, 2);
});
