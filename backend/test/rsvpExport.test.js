require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

// The controller pulls these in at require time — stub so requiring is side-effect free.
injectModule('../../utils/notificationService', {
  sendConfirmationEmail: async () => true,
  sendEmailViaBrevo: async () => true,
  sendInvitationEmail: async () => ({ sent: true }),
});
injectModule('../../utils/realtime', { broadcast: async () => {} });

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { exportGuestsCSV } = require('../controllers/rsvpController');

t.beforeEach(() => { mock.reset(); });

const exportReq = (query = {}) => mockReq({ params: { eventId: 'evt-1' }, query, user: { id: 'owner-1' } });

// ─────────────────────────────────────────────────────────────────────────────
// Regression (C1): exportParties() returns { rows, meta }. The CSV/Excel
// controllers previously treated the return value as a bare array and called
// .map() on it → "rows.map is not a function" → 500 on every export. This locks
// the controller to the { rows, meta } contract.
// ─────────────────────────────────────────────────────────────────────────────

test('CSV export consumes { rows, meta } and streams a populated CSV (no throw)', async () => {
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties' && s.op === 'select') {
      return { data: [
        { id: 'r1', label: 'Jane Doe', response: 'yes', notes: '',
          guests: [{ full_name: 'Jane Doe', email: 'jane@example.com', phone: '+15551234567', is_primary_contact: true, meal_selection: 'Chicken' }],
          seating_assignments: [], check_ins: [] },
      ] };
    }
    return {};
  });

  const { res, nextErr } = await invoke(exportGuestsCSV, exportReq());

  assert.equal(nextErr, null, nextErr ? `handler threw: ${nextErr.message}` : '');
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'text/csv');
  assert.equal(typeof res.body, 'string');
  // The row was actually iterated (not "[object Object]" and not a crash).
  assert.ok(res.body.includes('Jane Doe'), 'CSV body should contain the guest name');
  assert.ok(res.body.includes('jane@example.com'), 'CSV body should contain the guest email');
  // A small, non-truncated export must not advertise truncation.
  assert.equal(res.headers['X-Export-Truncated'], undefined);
});

test('CSV export of an empty event still succeeds with a header-only CSV', async () => {
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties' && s.op === 'select') return { data: [] };
    return {};
  });

  const { res, nextErr } = await invoke(exportGuestsCSV, exportReq());

  assert.equal(nextErr, null, nextErr ? `handler threw: ${nextErr.message}` : '');
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.includes('guest_name'), 'CSV should still contain the header row');
});
