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

// The Side column used to emit the raw 'partner1'/'partner2' enum, so the
// organizer's sheet never said WHICH partner a guest came for.
test('CSV export writes the side as the named partner, not the raw enum', async () => {
  mock.setResolver((s) => {
    if (s.table === 'events' && s.op === 'select') {
      return { data: { event_type: 'wedding', template_data: { partner1: 'Ahmed', partner2: 'Sara' } } };
    }
    if (s.table === 'rsvp_parties' && s.op === 'select') {
      return { data: [
        { id: 'r1', label: 'Jane Doe', response: 'yes', notes: '', side: 'partner2',
          guests: [{ full_name: 'Jane Doe', is_primary_contact: true }],
          seating_assignments: [], check_ins: [] },
      ] };
    }
    return {};
  });

  const { res, nextErr } = await invoke(exportGuestsCSV, exportReq());

  assert.equal(nextErr, null, nextErr ? `handler threw: ${nextErr.message}` : '');
  assert.ok(res.body.includes("Sara's Side"), `expected the bride's name in the Side column, got: ${res.body}`);
  assert.ok(!res.body.includes('partner2'), 'the raw side enum must not reach the sheet');
});

test('CSV export falls back to Groom/Bride when the partners are unnamed', async () => {
  mock.setResolver((s) => {
    if (s.table === 'events' && s.op === 'select') {
      return { data: { event_type: 'wedding', template_data: {} } };
    }
    if (s.table === 'rsvp_parties' && s.op === 'select') {
      return { data: [
        { id: 'r1', label: 'Jane Doe', response: 'yes', notes: '', side: 'partner1',
          guests: [{ full_name: 'Jane Doe', is_primary_contact: true }],
          seating_assignments: [], check_ins: [] },
      ] };
    }
    return {};
  });

  const { res } = await invoke(exportGuestsCSV, exportReq());
  assert.ok(res.body.includes("Groom's Side"), `expected the generic wedding label, got: ${res.body}`);
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

// ─────────────────────────────────────────────────────────────────────────────
// Companions are names only, so their meals live as a per-party tally
// (rsvp_parties.companion_meal_counts) rather than one dish per guest row. An
// export that read guest rows alone would report a party of four as one meal
// and three blanks — and the caterer orders from this column.
// ─────────────────────────────────────────────────────────────────────────────

test('the meal column carries the companion tally alongside the named meal', async () => {
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties' && s.op === 'select') {
      return { data: [
        { id: 'r1', label: 'Jane Doe', response: 'yes', notes: '',
          companion_meal_counts: { Fish: 2, Beef: 1 },
          guests: [
            { full_name: 'Jane Doe', email: 'jane@example.com', is_primary_contact: true, meal_selection: 'Chicken' },
            { full_name: 'Guest 2', is_primary_contact: false, meal_selection: null },
            { full_name: 'Guest 3', is_primary_contact: false, meal_selection: null },
            { full_name: 'Guest 4', is_primary_contact: false, meal_selection: null },
          ],
          seating_assignments: [], check_ins: [] },
      ] };
    }
    return {};
  });
  const { res } = await invoke(exportGuestsCSV, exportReq());
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /Jane Doe: Chicken/, "the named meal is still attributed");
  assert.match(res.body, /Guests: 2 x Fish, 1 x Beef/, 'and the companions are counted, largest first');
});

test('a party with no companion tally is unchanged', async () => {
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties' && s.op === 'select') {
      return { data: [
        { id: 'r1', label: 'Solo', response: 'yes', notes: '', companion_meal_counts: null,
          guests: [{ full_name: 'Solo', is_primary_contact: true, meal_selection: 'Chicken' }],
          seating_assignments: [], check_ins: [] },
      ] };
    }
    return {};
  });
  const { res } = await invoke(exportGuestsCSV, exportReq());
  assert.match(res.body, /Solo: Chicken/);
  assert.ok(!/Guests:/.test(res.body), 'no empty "Guests:" label when there is nothing to count');
});
