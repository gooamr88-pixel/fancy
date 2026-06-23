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

const updReq = (body) => mockReq({ params: { eventId: 'evt-1', rsvpId: 'r1' }, body, user: { id: 'owner-1' } });

// Script the rsvps update return + capture every rsvp_guests / seating write so we
// can assert the reconciliation keeps rsvp_guests in lockstep with party_size.
function setup(returnedRsvp) {
  const cap = { guestInserts: [], guestDeletes: 0, seatingDeletes: 0 };
  mock.setResolver((s) => {
    if (s.table === 'rsvps' && s.op === 'update') return { data: returnedRsvp };
    if (s.table === 'rsvp_guests' && s.op === 'insert') { cap.guestInserts.push(s.payload); return { data: null }; }
    if (s.table === 'rsvp_guests' && s.op === 'delete') { cap.guestDeletes++; return { data: null }; }
    if (s.table === 'seating_assignments' && s.op === 'delete') { cap.seatingDeletes++; return { data: null }; }
    return {};
  });
  return cap;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fix #7 — party_size and rsvp_guests must not desync on an organizer edit.
// ─────────────────────────────────────────────────────────────────────────────

test('bumping party_size pads rsvp_guests to one primary + (size−1) additional, preserving the primary meal', async () => {
  const cap = setup({
    id: 'r1', guest_name: 'Alice', response: 'yes', party_size: 3,
    rsvp_guests: [{ full_name: 'Alice', is_primary: true, meal_selection: 'Beef' }],
    seating_assignments: [],
  });

  const { res } = await invoke(updateRSVP, updReq({ partySize: 3 }));
  assert.equal(res.statusCode, 200);
  assert.equal(cap.guestInserts.length, 1);
  const rows = cap.guestInserts[0];
  assert.equal(rows.length, 3); // 1 primary + 2 padded — matches the new headcount
  assert.equal(rows[0].is_primary, true);
  assert.equal(rows[0].meal_selection, 'Beef'); // existing primary meal preserved
  assert.equal(rows.filter((g) => !g.is_primary).length, 2);
});

test('an additionalGuests array longer than party_size−1 is trimmed (no phantom attendees)', async () => {
  const cap = setup({
    id: 'r1', guest_name: 'Alice', response: 'yes', party_size: 2,
    rsvp_guests: [], seating_assignments: [],
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

test('moving to a non-attending response clears seating and skips guest-row reconciliation', async () => {
  const cap = setup({
    id: 'r1', guest_name: 'Alice', response: 'no', party_size: 3,
    rsvp_guests: [], seating_assignments: [],
  });

  const { res } = await invoke(updateRSVP, updReq({ response: 'no', partySize: 3 }));
  assert.equal(res.statusCode, 200);
  assert.equal(cap.seatingDeletes, 1);     // seat released
  assert.equal(cap.guestInserts.length, 0); // non-attending → no attendee rows built
});

test('an edit that touches neither party_size nor guest detail leaves rsvp_guests untouched', async () => {
  const cap = setup({
    id: 'r1', guest_name: 'Alice', response: 'yes', party_size: 2,
    rsvp_guests: [{ full_name: 'Alice', is_primary: true }], seating_assignments: [],
  });

  const { res } = await invoke(updateRSVP, updReq({ notes: 'window seat please' }));
  assert.equal(res.statusCode, 200);
  assert.equal(cap.guestDeletes, 0);
  assert.equal(cap.guestInserts.length, 0);
});
