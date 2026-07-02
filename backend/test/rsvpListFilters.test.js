require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

// getRSVPs makes no email/broadcast calls, but the controller pulls these in at
// require time — stub them so requiring the module is side-effect free.
injectModule('../../utils/notificationService', {
  sendConfirmationEmail: async () => true,
  sendEmailViaBrevo: async () => true,
  sendInvitationEmail: async () => ({ sent: true }),
});
injectModule('../../utils/realtime', { broadcast: async () => {} });

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { getRSVPs } = require('../controllers/rsvpController');

t.beforeEach(() => { mock.reset(); });

const listReq = (query) => mockReq({ params: { eventId: 'evt-1' }, query, user: { id: 'owner-1' } });

/** The single get_event_parties RPC invocation. */
const rpcCall = () => mock.calls.find(c => c.op === 'rpc' && c.fn === 'get_event_parties');

// ─────────────────────────────────────────────────────────────────────────────
// H1 refactor: listParties delegates ALL filtering + pagination + counting to the
// get_event_parties RPC in a single round trip. These tests lock the JS→RPC
// contract — safe param mapping/validation in, and the { total, parties } envelope
// out — replacing the old JS id-set pre-queries and 5,000-row post-filter cap.
// ─────────────────────────────────────────────────────────────────────────────

test('delegates to the get_event_parties RPC (one round trip) and passes the DB total through', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'get_event_parties') {
      return { data: { total: 2, parties: [{ id: 'r1' }, { id: 'r2' }] } };
    }
    return {};
  });

  const { res } = await invoke(getRSVPs, listReq({ page: '1', limit: '50' }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.rsvps.length, 2);
  assert.equal(res.body.meta.pagination.total, 2);
  assert.equal(res.body.meta.pagination.count, 2);
  // Exactly one DB call, and it's the RPC — no seating/guests/custom_answers scans.
  assert.equal(mock.calls.length, 1);
  assert.equal(rpcCall().params.p_event_id, 'evt-1');
  assert.equal(rpcCall().params.p_limit, 50);
  assert.equal(rpcCall().params.p_offset, 0);
});

test('an empty page still reports the DB total (accurate pagination past the last page)', async () => {
  mock.setResolver((s) => {
    // Page 9 is past the end, but the RPC's jsonb still carries the true total.
    if (s.op === 'rpc' && s.fn === 'get_event_parties') return { data: { total: 120, parties: [] } };
    return {};
  });

  const { res } = await invoke(getRSVPs, listReq({ page: '9', limit: '50' }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.rsvps.length, 0);
  assert.equal(res.body.meta.pagination.total, 120);
  assert.equal(rpcCall().params.p_offset, 400); // (9-1)*50
});

test('valid filters map straight onto RPC params', async () => {
  mock.setResolver((s) => (s.op === 'rpc' ? { data: { total: 0, parties: [] } } : {}));

  await invoke(getRSVPs, listReq({
    response: 'yes', seated: 'true', meal: 'Chicken',
    customFieldId: 'field-9', customFieldValue: 'Vegan', sort: 'name_asc',
  }));

  const p = rpcCall().params;
  assert.equal(p.p_response, 'yes');
  assert.equal(p.p_seated, 'true');
  assert.equal(p.p_meal, 'Chicken');
  assert.equal(p.p_custom_field_id, 'field-9');
  assert.equal(p.p_custom_field_value, 'Vegan');
  assert.equal(p.p_sort, 'name_asc');
});

test('unknown response / seated / sort values are nulled out before hitting the RPC', async () => {
  mock.setResolver((s) => (s.op === 'rpc' ? { data: { total: 0, parties: [] } } : {}));

  await invoke(getRSVPs, listReq({ response: 'DROP TABLE', seated: 'banana', sort: 'label; --' }));

  const p = rpcCall().params;
  assert.equal(p.p_response, null);
  assert.equal(p.p_seated, null);
  assert.equal(p.p_sort, null);
});

test('a %/_ in the search term is escaped so it cannot act as an ILIKE wildcard', async () => {
  mock.setResolver((s) => (s.op === 'rpc' ? { data: { total: 0, parties: [] } } : {}));

  await invoke(getRSVPs, listReq({ search: '50%_off' }));

  // escapeLikePattern backslash-escapes % and _ ; the RPC adds the surrounding %…%.
  assert.equal(rpcCall().params.p_search, '50\\%\\_off');
});

test('limit is capped at 100 and drives the RPC offset', async () => {
  mock.setResolver((s) => (s.op === 'rpc' ? { data: { total: 0, parties: [] } } : {}));

  await invoke(getRSVPs, listReq({ page: '3', limit: '999' }));

  const p = rpcCall().params;
  assert.equal(p.p_limit, 100);   // clamped
  assert.equal(p.p_offset, 200);  // (3-1)*100
});
