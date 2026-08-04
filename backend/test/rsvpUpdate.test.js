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

// ─────────────────────────────────────────────────────────────────────────────
// Contact uniqueness — emails and phones are unique per EVENT at the DB level
// (idx_guests_event_email_unique / idx_guests_event_phone_unique). Before this,
// the raw 23505 propagated to the organizer as a bare "An unexpected error
// occurred on the server" with nothing naming the field or the guest holding it.
// ─────────────────────────────────────────────────────────────────────────────

/** Scripts an existing guest, on another party, already holding `email`/`phone`. */
function setupWithConflict(returnedParty, holder) {
  const cap = setup(returnedParty);
  mock.setResolver((s) => {
    if (s.table === 'guests' && s.op === 'select') {
      const wantsEmail = (s.filters?.ilike || []).length > 0;
      const wantsPhone = (s.filters?.eq || []).some(([c]) => c === 'phone');
      if (wantsEmail && holder?.byEmail) return { data: [{ full_name: holder.byEmail }] };
      if (wantsPhone && holder?.byPhone) return { data: [{ full_name: holder.byPhone }] };
      return { data: [] };
    }
    if (s.table === 'rsvp_parties' && s.op === 'update') return { data: returnedParty };
    if (s.table === 'guests' && (s.op === 'upsert' || s.op === 'insert')) { cap.guestInserts.push(s.payload); return { data: null }; }
    if (s.table === 'guests' && s.op === 'delete') { cap.guestDeletes++; return { data: null }; }
    return {};
  });
  return cap;
}

const PARTY = {
  id: 'r1', label: 'Alice', response: 'yes', party_size: 1,
  guests: [{ id: 'g1', full_name: 'Alice', is_primary_contact: true }], seating_assignments: [],
};

test('reassigning an email another guest already holds is a named 409, not a 500', async () => {
  const cap = setupWithConflict(PARTY, { byEmail: 'Rouida Mousa' });

  const { res } = await invoke(updateRSVP, updReq({ email: 'rouida_mousa@yahoo.com' }));
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'DUPLICATE_EMAIL');
  assert.match(res.body.message, /Rouida Mousa already uses this email address/);
  // Rejected BEFORE any write — a half-applied edit is worse than a refused one.
  assert.equal(cap.guestInserts.length, 0);
});

test('a phone another PRIMARY contact holds is a named 409', async () => {
  setupWithConflict(PARTY, { byPhone: 'Fadi Auchi' });

  const { res } = await invoke(updateRSVP, updReq({ phone: '+15551234567' }));
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'DUPLICATE_PHONE');
  assert.match(res.body.message, /Fadi Auchi already uses this phone number/);
});

test('an email nobody else holds saves normally', async () => {
  const cap = setupWithConflict(PARTY, {});

  const { res } = await invoke(updateRSVP, updReq({ email: 'brand.new@example.com' }));
  assert.equal(res.statusCode, 200);
  assert.equal(cap.guestInserts.length, 1);
  assert.equal(cap.guestInserts[0][0].email, 'brand.new@example.com');
});

test('the conflict lookup escapes ilike wildcards — an underscore in an address is literal', async () => {
  let pattern = null;
  setup(PARTY);
  mock.setResolver((s) => {
    if (s.table === 'guests' && s.op === 'select') {
      const il = (s.filters?.ilike || [])[0];
      if (il) pattern = il[1];
      return { data: [] };
    }
    if (s.table === 'rsvp_parties' && s.op === 'update') return { data: PARTY };
    return {};
  });

  await invoke(updateRSVP, updReq({ email: 'rouida_mousa@yahoo.com' }));
  // Unescaped, "_" is an ilike wildcard AND an ordinary email character, so
  // "rouida-mousa@yahoo.com" would match and block a legitimate edit.
  assert.equal(pattern, 'rouida' + String.fromCharCode(92) + '_mousa@yahoo.com');
});

test('two members of the same party given one address is a 400 naming both', async () => {
  setupWithConflict(PARTY, {});

  const { res } = await invoke(updateRSVP, updReq({
    email: 'shared@example.com',
    partySize: 2,
    additionalGuests: [{ fullName: 'Bob', email: 'SHARED@example.com' }],
  }));
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /the main guest and Guest #2 were both given shared@example\.com/);
});

test('new companions are inserted separately from existing rows (PostgREST needs one shape per bulk write)', async () => {
  const cap = setupWithConflict({
    id: 'r1', label: 'Alice', response: 'yes', party_size: 2,
    guests: [{ id: 'g1', full_name: 'Alice', is_primary_contact: true }], seating_assignments: [],
  }, {});

  const { res } = await invoke(updateRSVP, updReq({
    partySize: 2, additionalGuests: [{ fullName: 'Bob', email: 'bob@example.com' }],
  }));
  assert.equal(res.statusCode, 200);
  // Two writes: the existing primary (carries id) and the new companion (does not).
  assert.equal(cap.guestInserts.length, 2);
  const withId = cap.guestInserts.find((rows) => rows[0].id);
  const withoutId = cap.guestInserts.find((rows) => !rows[0].id);
  assert.ok(withId && withoutId, 'existing and new rows must go in separate calls');
  // Within a call every row must share one key set.
  for (const rows of cap.guestInserts) {
    const shape = JSON.stringify(Object.keys(rows[0]).sort());
    for (const r of rows) assert.equal(JSON.stringify(Object.keys(r).sort()), shape);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// The companion meal tally is a count for the group, capped at the number of
// companions. The guest form and the organizer's modal both cap it in the UI,
// and submit_rsvp_v2 rejects an over-count on the public path — but nothing
// guarded the organizer's PATCH, so a direct API call could record more meals
// than the party has people and inflate the caterer's breakdown in
// getEventStats.
// ─────────────────────────────────────────────────────────────────────────────

/** Captures every rsvp_parties update so we can read the tally that was written. */
function setupMealTally(returnedParty) {
  const cap = { partyUpdates: [] };
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties' && s.op === 'update') {
      cap.partyUpdates.push(s.payload);
      return { data: returnedParty };
    }
    if (s.table === 'guests' && s.op === 'select') return { data: [] };
    if (s.table === 'guests') return { data: null };
    return {};
  });
  return cap;
}

const PARTY_OF_3 = {
  id: 'r1', label: 'Alice', response: 'yes', party_size: 3,
  guests: [{ id: 'g1', full_name: 'Alice', is_primary_contact: true }],
  seating_assignments: [],
};

/** The tally as it was actually persisted (the second, deferred update). */
const writtenTally = (cap) =>
  cap.partyUpdates.map((u) => u.companion_meal_counts).filter((v) => v !== undefined).pop();

test('a tally larger than the party is trimmed to fit, biggest choice first', async () => {
  const cap = setupMealTally(PARTY_OF_3);
  const { res } = await invoke(updateRSVP, updReq({
    partySize: 3, companionMealCounts: { Fish: 5, Beef: 3 },
  }));
  assert.equal(res.statusCode, 200);
  // A party of 3 has 2 companions, so at most 2 meals.
  assert.deepEqual(writtenTally(cap), { Fish: 2 });
});

test('a tally that fits is stored untouched', async () => {
  const cap = setupMealTally(PARTY_OF_3);
  await invoke(updateRSVP, updReq({ partySize: 3, companionMealCounts: { Fish: 1, Beef: 1 } }));
  assert.deepEqual(writtenTally(cap), { Fish: 1, Beef: 1 });
});

test('junk in the tally is dropped rather than stored', async () => {
  const cap = setupMealTally(PARTY_OF_3);
  await invoke(updateRSVP, updReq({
    partySize: 3,
    companionMealCounts: { Fish: -1, Beef: 2.5, '': 1, Chicken: 'lots' },
  }));
  assert.equal(writtenTally(cap), null, 'nothing here is a real meal count');
});

test('an edit that never mentions the tally leaves it alone', async () => {
  const cap = setupMealTally(PARTY_OF_3);
  await invoke(updateRSVP, updReq({ notes: 'window seat please' }));
  assert.equal(
    cap.partyUpdates.some((u) => 'companion_meal_counts' in u), false,
    'an absent key must never blank a tally the guest filled in',
  );
});
