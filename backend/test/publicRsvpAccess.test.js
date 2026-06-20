require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

// Regression tests for security finding H1 (guest PII exposure via public endpoints).
injectModule('../../utils/realtime', { broadcast: async () => {} });
const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { getGuestById, searchPublicGuests } = require('../controllers/rsvpController');

t.beforeEach(() => mock.reset());

// ── getGuestById ──────────────────────────────────────────────────────────

test('H1: getGuestById never returns email / phone / notes', async () => {
  // Even when the row HAS contact info, the controller must not pass it through.
  mock.setResolver(({ table }) => {
    if (table === 'rsvps') return { data: {
      id: 'r1', guest_name: 'Alex', email: 'alex@x.com', phone: '+15550000000', notes: 'private note',
      party_size: 2, response: 'yes',
      events: { slug: 'wedding', is_paid: true, status: 'active' },
      seating_assignments: [{ tables: { table_name: 'Table 1' } }],
    } };
    return {};
  });
  const { res } = await invoke(getGuestById, mockReq({ params: { guestId: 'r1' } }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.guest.guest_name, 'Alex');
  assert.equal(res.body.guest.table_name, 'Table 1');
  assert.equal(res.body.guest.email, undefined, 'email must NOT be exposed');
  assert.equal(res.body.guest.phone, undefined, 'phone must NOT be exposed');
  assert.equal(res.body.guest.notes, undefined, 'notes must NOT be exposed');
});

test('getGuestById 404s for a non-active event (no leak from draft/paused events)', async () => {
  mock.setResolver(({ table }) => table === 'rsvps' ? { data: {
    id: 'r1', guest_name: 'Alex', party_size: 1, response: 'yes',
    events: { slug: 'w', is_paid: true, status: 'draft' }, seating_assignments: [],
  } } : {});
  const { res } = await invoke(getGuestById, mockReq({ params: { guestId: 'r1' } }));
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, 'EVENT_INACTIVE');
});

// ── searchPublicGuests ────────────────────────────────────────────────────

test('H1: a 1-char query returns nothing and issues NO guest query', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(searchPublicGuests, mockReq({ params: { slug: 'w' }, query: { query: 'a' } }));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.results, []);
  assert.equal(mock.calls.some(c => c.table === 'rsvps'), false, 'must not scan guests for a 1-char term');
});

test('H1: search returns nothing for a non-active event (no guest-list enumeration)', async () => {
  mock.setResolver(({ table }) => table === 'events' ? { data: { id: 'e1', is_paid: false, status: 'draft' } } : {});
  const { res } = await invoke(searchPublicGuests, mockReq({ params: { slug: 'w' }, query: { query: 'alex' } }));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.results, []);
  assert.equal(mock.calls.some(c => c.table === 'rsvps'), false);
});

test('search returns names + response (never contact info) for a live event', async () => {
  mock.setResolver(({ table }) => {
    if (table === 'events') return { data: { id: 'e1', is_paid: true, status: 'active' } };
    if (table === 'rsvps') return { data: [{ id: 'r1', guest_name: 'Alex Smith', response: 'yes' }] };
    return {};
  });
  const { res } = await invoke(searchPublicGuests, mockReq({ params: { slug: 'w' }, query: { query: 'alex' } }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.results.length, 1);
  assert.equal(res.body.results[0].guestName, 'Alex Smith');
  assert.equal(res.body.results[0].email, undefined);
  assert.equal(res.body.results[0].phone, undefined);
});

test('search 404s for an unknown slug', async () => {
  mock.setResolver(({ table }) => table === 'events' ? { data: null, error: { message: 'no rows' } } : {});
  const { res } = await invoke(searchPublicGuests, mockReq({ params: { slug: 'nope' }, query: { query: 'alex' } }));
  assert.equal(res.statusCode, 404);
});
