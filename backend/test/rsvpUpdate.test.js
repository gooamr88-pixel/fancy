require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

injectModule('../../utils/notificationService', {
  sendEmailViaBrevo: async () => true,
  sendConfirmationEmail: async () => true,
  sendInvitationEmail: async () => ({ sent: true }),
  sendQRTicketEmail: async () => true,
});
injectModule('../../utils/realtime', { broadcast: async () => {} });

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { updateRSVP } = require('../controllers/rsvpController');

t.beforeEach(() => mock.reset());

const updReq = (body) => mockReq({ params: { eventId: 'evt-1', partyId: 'r1' }, body, user: { id: 'owner-1' } });

// Script the rsvp_parties update return + capture every guests / seating write so we
// can assert the reconciliation keeps guests in lockstep with party_size.
function setup(returnedParty) {
  const cap = { guestInserts: [], guestDeletes: 0, seatingDeletes: 0 };
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties' && s.op === 'update') return { data: returnedParty };
    if (s.table === 'guests' && s.op === 'upsert') { cap.guestInserts.push(s.payload); return { data: null }; }
    if (s.table === 'guests' && s.op === 'insert') { cap.guestInserts.push(s.payload); return { data: null }; }
    if (s.table === 'guests' && s.op === 'delete') { cap.guestDeletes++; return { data: null }; }
    if (s.table === 'seating_assignments' && s.op === 'delete') { cap.seatingDeletes++; return { data: null }; }
    return {};
  });
  return cap;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fix #7 — party_size and guests must not desync on an organizer edit.
// ─────────────────────────────────────────────────────────────────────────────

test('bumping party_size pads guests to one primary + (size−1) additional, preserving the primary meal', async () => {
  const cap = setup({
    id: 'r1', label: 'Alice', response: 'yes', party_size: 3,
    guests: [{ full_name: 'Alice', is_primary_contact: true, meal_selection: 'Beef' }],
    seating_assignments: [],
  });

  const { res } = await invoke(updateRSVP, updReq({ partySize: 3 }));
  assert.equal(res.statusCode, 200);
  assert.equal(cap.guestInserts.length, 1);
  const rows = cap.guestInserts[0];
  assert.equal(rows.length, 3); // 1 primary + 2 padded — matches the new headcount
  assert.equal(rows[0].is_primary_contact, true);
  assert.equal(rows[0].meal_selection, 'Beef'); // existing primary meal preserved
  assert.equal(rows.filter((g) => !g.is_primary_contact).length, 2);
});

test('an additionalGuests array longer than party_size−1 is trimmed (no phantom attendees)', async () => {
  const cap = setup({
    id: 'r1', label: 'Alice', response: 'yes', party_size: 2,
    guests: [], seating_assignments: [],
  });

  const { res } = await invoke(updateRSVP, updReq({
    partySize: 2,
    additionalGuests: [{ fullName: 'Bob' }, { fullName: 'Cara' }, { fullName: 'Dan' }],
  }));
  assert.equal(res.statusCode, 200);
  const rows = cap.guestInserts[0];
  assert.equal(rows.length, 2); // capped at party_size (1 primary + 1 additional)
  assert.equal(rows[1].full_name, 'Bob');
});

test('a non-attending response still reconciles guest rows when party_size is provided', async () => {
  const cap = setup({
    id: 'r1', label: 'Alice', response: 'no', party_size: 3,
    guests: [], seating_assignments: [],
  });

  const { res } = await invoke(updateRSVP, updReq({ response: 'no', partySize: 3 }));
  assert.equal(res.statusCode, 200);
  // Reconciliation is gated on party_size / guest-detail changes, NOT on `response`
  // (see guestService.updateParty) — so editing a declined party's size still
  // rebuilds its guest rows, fixing the old bug where sizing a Maybe/Pending/No
  // party silently did nothing. Seating removal on leaving 'yes' is handled by the
  // trg_party_response_change DB trigger, outside this code path.
  assert.equal(cap.guestInserts.length, 1);
  assert.equal(cap.guestInserts[0].length, 3); // 1 primary + 2 padded to match size
});

test('a non-attending response with no size/detail change leaves guest rows untouched', async () => {
  const cap = setup({
    id: 'r1', label: 'Alice', response: 'no', party_size: 3,
    guests: [{ full_name: 'Alice', is_primary_contact: true }], seating_assignments: [],
  });

  const { res } = await invoke(updateRSVP, updReq({ response: 'no' }));
  assert.equal(res.statusCode, 200);
  // Only the response changed → nothing to reconcile.
  assert.equal(cap.guestInserts.length, 0);
});

test('an edit that touches neither party_size nor guest detail leaves guests untouched', async () => {
  const cap = setup({
    id: 'r1', label: 'Alice', response: 'yes', party_size: 2,
    guests: [{ full_name: 'Alice', is_primary_contact: true }], seating_assignments: [],
  });

  const { res } = await invoke(updateRSVP, updReq({ notes: 'window seat please' }));
  assert.equal(res.statusCode, 200);
  assert.equal(cap.guestDeletes, 0);
  assert.equal(cap.guestInserts.length, 0);
});
