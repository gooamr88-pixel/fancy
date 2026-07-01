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

/** The terminal select against the rsvp_parties table (the paginated list query). */
const rsvpListCall = () => mock.calls.find(c => c.table === 'rsvp_parties' && c.op === 'select');

// ─────────────────────────────────────────────────────────────────────────────
// Regression: cross-table filters must constrain the PAGED + COUNTED query, not
// post-filter an already-fetched page (which produced short pages + wrong totals).
// ─────────────────────────────────────────────────────────────────────────────

test('no cross-table filters → passthrough, no related-table pre-queries, total is the DB count', async () => {
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties' && s.op === 'select') {
      return { data: [{ id: 'r1' }, { id: 'r2' }], count: 2 };
    }
    return {};
  });

  const { res } = await invoke(getRSVPs, listReq({}));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.rsvps.length, 2);
  assert.equal(res.body.meta.pagination.total, 2);
  // No seating/meal/custom pre-query when those filters are absent.
  assert.equal(mock.calls.some(c => c.table === 'seating_assignments'), false);
  assert.equal(mock.calls.some(c => c.table === 'guests'), false);
  // The list query is NOT id-constrained.
  assert.equal(rsvpListCall().filters.in, undefined);
});

test('seated=true constrains the list query to seated ids and reports the filtered total', async () => {
  mock.setResolver((s) => {
    if (s.table === 'seating_assignments' && s.op === 'select') {
      return { data: [{ party_id: 'r1' }, { party_id: 'r3' }] };
    }
    if (s.table === 'rsvp_parties' && s.op === 'select') {
      return { data: [
        { id: 'r1', seating_assignments: [{ id: 'sa-1' }] },
        { id: 'r3', seating_assignments: [{ id: 'sa-3' }] }
      ], count: 2 };
    }
    return {};
  });

  const { res } = await invoke(getRSVPs, listReq({ seated: 'true' }));
  assert.equal(res.statusCode, 200);
  const inFilter = rsvpListCall().filters.in.find(([col]) => col === 'id');
  assert.deepEqual(new Set(inFilter[1]), new Set(['r1', 'r3']));
  // total reflects the constrained count, not an unfiltered page length.
  assert.equal(res.body.meta.pagination.total, 2);
});

test('seated=true with no seated guests short-circuits to an empty page (total 0, no list query)', async () => {
  mock.setResolver((s) => {
    if (s.table === 'seating_assignments' && s.op === 'select') return { data: [] };
    return {};
  });

  const { res } = await invoke(getRSVPs, listReq({ seated: 'true' }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.rsvps.length, 0);
  assert.equal(res.body.meta.pagination.total, 0);
  // No point querying rsvp_parties when nothing can match.
  assert.equal(rsvpListCall(), undefined);
});

test('seated=false excludes seated ids via NOT IN', async () => {
  mock.setResolver((s) => {
    if (s.table === 'seating_assignments' && s.op === 'select') return { data: [{ party_id: 'r1' }] };
    if (s.table === 'rsvp_parties' && s.op === 'select') return { data: [{ id: 'r2' }], count: 1 };
    return {};
  });

  const { res } = await invoke(getRSVPs, listReq({ seated: 'false' }));
  assert.equal(res.statusCode, 200);
  const notFilter = (rsvpListCall().filters.not || []).find(([col, op]) => col === 'id' && op === 'in');
  assert.ok(notFilter, 'expected a NOT id IN (...) constraint');
  assert.equal(notFilter[2], '(r1)');
  assert.equal(res.body.meta.pagination.total, 1);
});

test('meal filter resolves matching rsvp ids and intersects with seated=true', async () => {
  mock.setResolver((s) => {
    if (s.table === 'seating_assignments' && s.op === 'select') {
      return { data: [{ party_id: 'r1' }, { party_id: 'r2' }] }; // seated: r1, r2
    }
    if (s.table === 'guests' && s.op === 'select') {
      return { data: [{ party_id: 'r2' }, { party_id: 'r9' }] }; // chose this meal: r2, r9
    }
    if (s.table === 'rsvp_parties' && s.op === 'select') {
      return { data: [{ id: 'r2', seating_assignments: [{ id: 'sa-2' }], guests: [{ meal_selection: 'Chicken' }] }], count: 1 };
    }
    return {};
  });

  const { res } = await invoke(getRSVPs, listReq({ seated: 'true', meal: 'Chicken' }));
  assert.equal(res.statusCode, 200);
  // Intersection of {r1,r2} and {r2,r9} is {r2}.
  const inFilter = rsvpListCall().filters.in.find(([col]) => col === 'id');
  assert.deepEqual(inFilter[1], ['r2']);
});
