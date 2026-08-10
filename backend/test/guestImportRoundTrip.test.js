require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

/**
 * THE EXPORT MUST IMPORT BACK.
 *
 * Downloading a guest list, editing it in Excel and uploading it again is the
 * single most common thing an organizer does with these two features, and until
 * now it silently destroyed two columns on every round trip:
 *
 *   • `response` was never mapped by the controller AND was hardcoded to
 *     'pending' by guestService.importGuests, so every answer already collected
 *     was reset to "awaiting reply";
 *   • `side` was matched against generic synonyms only ('groom', 'partner1'),
 *     while the export writes the RESOLVED label ("Evan's Side") — so the
 *     platform could not read its own file, and every side became null.
 *
 * Both failed silently: the import reported success and the organizer found out
 * from their headcount. Unit-testing either half in isolation would not have
 * caught it, because each half was self-consistent — the defect lived in the
 * disagreement between them. So these tests run the REAL export to produce the
 * file, then feed that exact file to the REAL import, and assert on what the
 * import tried to write.
 */

injectModule('../../utils/notificationService', {
  sendConfirmationEmail: async () => true,
  sendEmailViaBrevo: async () => true,
  sendInvitationEmail: async () => ({ sent: true }),
});
injectModule('../../utils/realtime', { broadcast: async () => {} });

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const { exportGuestsCSV, importGuestsCSV, deleteAllRSVPs } = require('../controllers/rsvpController');

const EVENT = 'evt-1';
const WEDDING = { event_type: 'wedding', template_data: { partner1: 'Evan', partner2: 'Angelina' } };

t.beforeEach(() => { mock.reset(); });

const party = (over = {}) => ({
  id: 'r1', label: 'Fadi Auchi', response: 'yes', notes: '', side: 'partner1',
  guests: [{ full_name: 'Fadi Auchi', email: 'fadi@example.com', phone: '+16196666620', is_primary_contact: true }],
  seating_assignments: [], check_ins: [], ...over,
});

/** Run the real CSV export for one party and return the file it produced. */
async function exportCsv(parties, event = WEDDING) {
  mock.setResolver((s) => {
    if (s.table === 'events' && s.op === 'select') return { data: event };
    if (s.table === 'rsvp_parties' && s.op === 'select') return { data: parties };
    return {};
  });
  const { res, nextErr } = await invoke(
    exportGuestsCSV,
    mockReq({ params: { eventId: EVENT }, query: {}, user: { id: 'owner-1' } }),
  );
  assert.equal(nextErr, null, nextErr ? `export threw: ${nextErr.message}` : '');
  return res.body;
}

/**
 * Feed a CSV to the real import and capture every add_guest_to_party call.
 *
 * The RPC arguments are the assertion target rather than the HTTP response,
 * because the response was always "success" — that is precisely how this bug
 * survived.
 */
async function importCsv(csvData, event = WEDDING, {
  tables = [], seats = [], inserts = [], updates = [],
  // What assign_seat returns. Defaults to success; a test can hand back any of
  // the six refusals the real function can produce.
  seatResult = { success: true },
} = {}) {
  const calls = [];
  mock.setResolver((s) => {
    if (s.table === 'events' && s.op === 'select') return { data: event };
    if (s.op === 'rpc' && s.fn === 'add_guest_to_party') {
      calls.push(s.params);
      return { data: { success: true, party_id: `p${calls.length}`, guest_id: `g${calls.length}` } };
    }
    if (s.table === 'tables' && s.op === 'select') return { data: tables };
    if (s.op === 'rpc' && s.fn === 'assign_seat') {
      seats.push(s.params);
      return { data: seatResult };
    }
    if (s.table === 'guests' && s.op === 'insert') { inserts.push(s.payload); return {}; }
    if (s.table === 'rsvp_parties' && s.op === 'update') { updates.push(s.payload); return {}; }
    return {};
  });
  const { res, nextErr } = await invoke(
    importGuestsCSV,
    mockReq({ params: { eventId: EVENT }, body: { csvData }, user: { id: 'owner-1' } }),
  );
  assert.equal(nextErr, null, nextErr ? `import threw: ${nextErr.message}` : '');
  return { calls, res };
}

/* ── The round trip ─────────────────────────────────────────────────────── */

test('a guest exported as attending on a named side imports back unchanged', async () => {
  const csv = await exportCsv([party()]);

  // The export really did write the friendly label, not the enum — if this ever
  // changes, the importer's matcher has to change with it.
  assert.ok(csv.includes("Evan's Side"), `export should carry the resolved side label:\n${csv}`);

  const { calls } = await importCsv(csv);

  assert.equal(calls.length, 1, 'the row should have been imported');
  assert.equal(calls[0].p_response, 'yes', 'the answer must survive the round trip');
  assert.equal(calls[0].p_side, 'partner1', "\"Evan's Side\" must resolve back to partner1");
});

test('every response value the export can write is read back as itself', async () => {
  for (const response of ['yes', 'no', 'maybe', 'pending']) {
    const csv = await exportCsv([party({ response })]);
    const { calls } = await importCsv(csv);
    assert.equal(calls[0].p_response, response, `${response} must round-trip`);
  }
});

test('partner2 resolves from the second partner\'s own label', async () => {
  const csv = await exportCsv([party({ side: 'partner2' })]);
  assert.ok(csv.includes("Angelina's Side"), 'export should name partner 2');

  const { calls } = await importCsv(csv);
  assert.equal(calls[0].p_side, 'partner2');
});

/* ── The generic spellings a hand-built file uses ───────────────────────── */

test('hand-typed synonyms still work alongside the event\'s own labels', async () => {
  const csv = [
    'guest_name,email,response,side',
    'A,a@example.com,attending,groom',
    'B,b@example.com,declined,bride',
    'C,c@example.com,tentative,partner1',
    'D,d@example.com,,partner2',
  ].join('\n');

  const { calls } = await importCsv(csv);

  assert.deepEqual(calls.map((c) => c.p_response), ['yes', 'no', 'maybe', 'pending']);
  assert.deepEqual(calls.map((c) => c.p_side), ['partner1', 'partner2', 'partner1', 'partner2']);
});

test('a partner named "Bride" keeps their own label rather than losing it to the synonym', async () => {
  const event = { event_type: 'wedding', template_data: { partner1: 'Bride', partner2: 'Sam' } };
  const csv = 'guest_name,side\nA,Bride\'s Side\n';

  const { calls } = await importCsv(csv, event);

  assert.equal(calls[0].p_side, 'partner1',
    "the event's own label must outrank the generic bride→partner2 synonym");
});

test("Excel's curly apostrophe still resolves", async () => {
  const csv = 'guest_name,side\nA,Evan’s Side\n';

  const { calls } = await importCsv(csv);

  assert.equal(calls[0].p_side, 'partner1');
});

/* ── The safe default ───────────────────────────────────────────────────── */

test('a file with no response column imports everyone as pending', async () => {
  const csv = 'guest_name,email\nA,a@example.com\nB,b@example.com\n';

  const { calls } = await importCsv(csv);

  assert.deepEqual(calls.map((c) => c.p_response), ['pending', 'pending']);
});

test('an unrecognised answer is pending, never a guess', async () => {
  // "?" and a stray word must not be read as attending — a guest wrongly marked
  // yes is counted by the caterer and given a seat.
  const csv = 'guest_name,response\nA,?\nB,probably\n';

  const { calls } = await importCsv(csv);

  assert.deepEqual(calls.map((c) => c.p_response), ['pending', 'pending']);
});

test('an unrecognised side is dropped rather than assigned to a partner', async () => {
  const csv = 'guest_name,side\nA,Work friends\n';

  const { calls } = await importCsv(csv);

  assert.equal(calls[0].p_side, null);
});

/* ── Meals, and the companion names hidden inside them ──────────────────── */

test('a party of three round-trips its meals AND its companions\' names', async () => {
  const csv = await exportCsv([party({
    label: 'David Danial',
    guests: [
      { full_name: 'David Danial', email: 'd@example.com', is_primary_contact: true, meal_selection: 'Beef Steak' },
      { full_name: 'Lenora Danial', is_primary_contact: false, meal_selection: 'Beef Steak' },
      { full_name: 'Sabria Shamo', is_primary_contact: false, meal_selection: 'Fish' },
    ],
  })]);

  const inserts = [];
  const { calls } = await importCsv(csv, WEDDING, { inserts });

  assert.equal(calls[0].p_full_name, 'David Danial');

  // The companions are the reason this matters: their names exist ONLY inside
  // the meal_selections cell, so without parsing it they come back as
  // "Guest 2" and "Guest 3" with no meals at all.
  const companions = inserts.flat();
  assert.deepEqual(
    companions.map((g) => g.full_name),
    ['Lenora Danial', 'Sabria Shamo'],
  );
  assert.deepEqual(
    companions.map((g) => g.meal_selection),
    ['Beef Steak', 'Fish'],
  );
  assert.ok(companions.every((g) => g.is_primary_contact === false));
});

test("the primary contact's own meal is not handed to a companion", async () => {
  const csv = await exportCsv([party({
    label: 'Jane',
    guests: [
      { full_name: 'Jane', is_primary_contact: true, meal_selection: 'Fish' },
      { full_name: 'Bob', is_primary_contact: false, meal_selection: 'Beef' },
    ],
  })]);

  const inserts = [];
  await importCsv(csv, WEDDING, { inserts });

  const companions = inserts.flat();
  assert.equal(companions.length, 1, 'a party of two has exactly one companion');
  assert.equal(companions[0].full_name, 'Bob');
  assert.equal(companions[0].meal_selection, 'Beef');
});

test('an anonymous companion tally round-trips as a tally', async () => {
  const csv = await exportCsv([party({
    label: 'Jane',
    companion_meal_counts: { 'Beef Steak': 2, Fish: 1 },
    guests: [
      { full_name: 'Jane', is_primary_contact: true, meal_selection: 'Fish' },
      { full_name: 'Guest 2', is_primary_contact: false },
      { full_name: 'Guest 3', is_primary_contact: false },
      { full_name: 'Guest 4', is_primary_contact: false },
    ],
  })]);

  assert.ok(csv.includes('Guests: 2 x Beef Steak, 1 x Fish'), `tally should be in the export:\n${csv}`);

  const updates = [];
  await importCsv(csv, WEDDING, { updates });

  const tally = updates.find((u) => u && u.companion_meal_counts);
  assert.ok(tally, 'the tally must be written back to the party');
  assert.deepEqual(tally.companion_meal_counts, { 'Beef Steak': 2, Fish: 1 });
});

test('a mangled meal cell costs the meal, never the guest', async () => {
  const csv = 'guest_name,party_size,meal_selections\nJane,2,"::: nonsense ;;;"\n';

  const inserts = [];
  const { calls } = await importCsv(csv, WEDDING, { inserts });

  assert.equal(calls.length, 1, 'the guest still imports');
  assert.equal(inserts.flat()[0].full_name, 'Guest 2', 'the companion falls back to a placeholder');
});

/* ── Seating ────────────────────────────────────────────────────────────── */

test('a guest exported on Table 5 is put back on Table 5', async () => {
  const csv = await exportCsv([party({
    seating_assignments: [{ table_id: 't5', tables: { table_name: 'Table 5' } }],
  })]);
  assert.ok(csv.includes('Table 5'), 'export should carry the table name');

  const seats = [];
  await importCsv(csv, WEDDING, { tables: [{ id: 't5', table_name: 'Table 5' }], seats });

  assert.equal(seats.length, 1);
  assert.equal(seats[0].p_table_id, 't5');
  assert.equal(seats[0].p_force, false, 'an import must never force past a full table');
});

test('table names match regardless of case and stray spacing', async () => {
  const csv = 'guest_name,table_name\nA,  table 5  \n';

  const seats = [];
  await importCsv(csv, WEDDING, { tables: [{ id: 't5', table_name: 'Table 5' }], seats });

  assert.equal(seats[0]?.p_table_id, 't5');
});

test('a table that does not exist is reported, and no table is invented', async () => {
  const csv = 'guest_name,table_name\nA,Family\n';

  const seats = [];
  const { res } = await importCsv(csv, WEDDING, { tables: [{ id: 't5', table_name: 'Table 5' }], seats });

  assert.equal(seats.length, 0, 'nothing should be seated');
  const body = res.body?.data || res.body;
  assert.deepEqual(body.seating.unknownTables, ['Family']);
  assert.match(body.message, /Family/, 'the organizer must be told which name was not recognised');
});

/* ── Clearing the list, the other half of the re-import workflow ─────────── */

/**
 * Script the counts the clear-preview reads, and record every delete issued.
 * `counts` is keyed by table so a test can say "there are 3 parties" without
 * caring how the summary is assembled.
 */
function scriptClear(counts = {}) {
  const deletes = [];
  mock.setResolver((s) => {
    if (s.op === 'delete') { deletes.push(s.table); return {}; }
    if (s.op === 'select' && s.count === 'exact') return { count: counts[s.table] ?? 0 };
    return {};
  });
  return deletes;
}

const clearReq = (body) => mockReq({ params: { eventId: EVENT }, body, user: { id: 'owner-1' } });

test('clearing without the confirmation word does nothing at all', async () => {
  const deletes = scriptClear({ rsvp_parties: 3 });

  const { res } = await invoke(deleteAllRSVPs, clearReq({}));

  assert.equal(res.statusCode, 400);
  assert.equal(deletes.length, 0, 'not one row may be deleted without the confirmation');
});

test('a near-miss confirmation is still a refusal', async () => {
  const deletes = scriptClear({ rsvp_parties: 3 });

  const { res } = await invoke(deleteAllRSVPs, clearReq({ confirm: 'delete' }));

  assert.equal(res.statusCode, 400);
  assert.equal(deletes.length, 0);
});

test('clearing removes the parties and reports what went', async () => {
  const deletes = scriptClear({ rsvp_parties: 3, guests: 7, seating_assignments: 3, check_ins: 1 });

  const { res } = await invoke(deleteAllRSVPs, clearReq({ confirm: 'DELETE' }));

  assert.equal(res.statusCode, 200);
  assert.ok(deletes.includes('rsvp_parties'));
  const body = res.body?.data || res.body;
  assert.equal(body.parties, 3);
  assert.equal(body.guests, 7);
});

// The whole point of clearing rather than deleting the event: the chart survives,
// so a re-import can put everyone back on the tables they were already on.
test('clearing never touches the tables or the compliance logs', async () => {
  const deletes = scriptClear({ rsvp_parties: 2 });

  await invoke(deleteAllRSVPs, clearReq({ confirm: 'DELETE' }));

  assert.equal(deletes.includes('tables'), false, 'the seating chart must survive');
  assert.equal(deletes.includes('sms_consent_log'), false, 'consent history is append-only');
  assert.equal(deletes.includes('sms_log'), false, 'the send log is append-only');
});

test('a guest list that grew while the dialog was open is refused, not deleted', async () => {
  const deletes = scriptClear({ rsvp_parties: 4 });

  const { res } = await invoke(deleteAllRSVPs, clearReq({ confirm: 'DELETE', expectedParties: 3 }));

  assert.equal(res.statusCode, 409);
  assert.equal(deletes.length, 0, 'a stale confirmation must delete nothing');
  assert.match(res.body.message, /4/, 'the organizer needs the number that is actually there');
});

test('a matching expected count proceeds', async () => {
  const deletes = scriptClear({ rsvp_parties: 3 });

  const { res } = await invoke(deleteAllRSVPs, clearReq({ confirm: 'DELETE', expectedParties: 3 }));

  assert.equal(res.statusCode, 200);
  assert.ok(deletes.includes('rsvp_parties'));
});

test('a blank table column seats nobody and queries nothing', async () => {
  const csv = 'guest_name,table_name\nA,\nB,\n';

  const seats = [];
  const { res } = await importCsv(csv, WEDDING, { tables: [], seats });

  assert.equal(seats.length, 0);
  const body = res.body?.data || res.body;
  assert.equal(body.seating.seated, 0);
  assert.equal(body.seating.unknownTables.length, 0);
});

/* ── Every seating refusal is reported, not just the one we thought of ───── */

/**
 * assign_seat has six failure modes. This function counted `success` and
 * CAPACITY_EXCEEDED and dropped the rest, which meant an organizer could import
 * a file, see "imported!", find an empty chart, and have nothing to go on.
 */
const TABLE_5 = [{ id: 't5', table_name: 'Table 5' }];

test('a guest who has not said yes is reported, not silently left unseated', async () => {
  // assign_seat requires response = 'yes'. A re-imported "maybe" who had a table
  // therefore cannot be seated — and that has to be said out loud.
  const csv = 'guest_name,response,table_name\nA,maybe,Table 5\n';

  const { res } = await importCsv(csv, WEDDING, {
    tables: TABLE_5,
    seatResult: { success: false, error: 'RSVP_NOT_FOUND' },
  });

  const body = res.body?.data || res.body;
  assert.equal(body.seating.refused.RSVP_NOT_FOUND, 1);
  assert.match(body.message, /only guests who answered yes/);
});

test('an unpaid event says seating was skipped rather than saying nothing', async () => {
  const csv = 'guest_name,response,table_name\nA,yes,Table 5\n';

  const { res } = await importCsv(csv, WEDDING, {
    tables: TABLE_5,
    seatResult: { success: false, error: 'FEATURE_REQUIRES_PAYMENT' },
  });

  const body = res.body?.data || res.body;
  assert.equal(body.seating.refused.FEATURE_REQUIRES_PAYMENT, 1);
  assert.match(body.message, /not paid for yet/);
});

test('a full table is reported with a count', async () => {
  const csv = 'guest_name,response,table_name\nA,yes,Table 5\n';

  const { res } = await importCsv(csv, WEDDING, {
    tables: TABLE_5,
    seatResult: { success: false, error: 'CAPACITY_EXCEEDED' },
  });

  const body = res.body?.data || res.body;
  assert.equal(body.seating.refused.CAPACITY_EXCEEDED, 1);
  assert.match(body.message, /already full/);
});

test('a refusal nobody anticipated still surfaces as a number', async () => {
  const csv = 'guest_name,response,table_name\nA,yes,Table 5\n';

  const { res } = await importCsv(csv, WEDDING, {
    tables: TABLE_5,
    seatResult: { success: false, error: 'SOMETHING_NEW' },
  });

  const body = res.body?.data || res.body;
  assert.equal(body.seating.refused.SOMETHING_NEW, 1);
  assert.match(body.message, /SOMETHING_NEW/);
});

/* ── Texting permission survives the clear-and-re-upload cycle ───────────── */

test('sms_consent is exported and read back', async () => {
  const csv = await exportCsv([party({ sms_consent: true })]);
  assert.ok(/(^|,)"?sms_consent"?/m.test(csv), `sms_consent must be a column:\n${csv}`);

  const updates = [];
  await importCsv(csv, WEDDING, { updates });

  const consent = updates.find((u) => u && 'sms_consent' in u);
  assert.ok(consent, 'a consenting guest must come back textable');
  assert.equal(consent.sms_consent, true);
  // The organizer uploading the file is the one asserting it — a spreadsheet is
  // never allowed to claim the guest personally opted in.
  assert.equal(consent.sms_consent_method, 'host_attested');
});

test('a guest exported as not consenting is not made textable', async () => {
  const csv = await exportCsv([party({ sms_consent: false })]);

  const updates = [];
  await importCsv(csv, WEDDING, { updates });

  assert.equal(updates.some((u) => u && 'sms_consent' in u), false);
});

/* ── The .xlsx export's placeholder words are not data ───────────────────── */

test('"N/A" and "Unassigned" are treated as empty, not as values', async () => {
  const csv = 'guest_name,email,phone,table_name,meal_selections\n'
    + 'A,N/A,N/A,Unassigned,None\n';

  const seats = [];
  const { calls, res } = await importCsv(csv, WEDDING, { tables: TABLE_5, seats });

  assert.equal(calls[0].p_email, null, '"N/A" is not an email address');
  assert.equal(calls[0].p_phone, null, '"N/A" is not a phone number');
  assert.equal(seats.length, 0, 'nothing should hunt for a table called "Unassigned"');
  const body = res.body?.data || res.body;
  assert.equal(body.seating.unknownTables.length, 0);
});

// Emails are unique per event, so without scrubbing, the first "N/A" row imports
// and every later one collides with it and is silently dropped as a duplicate.
test('two rows with "N/A" emails are two guests, not one and a duplicate', async () => {
  const csv = 'guest_name,email\nA,N/A\nB,N/A\n';

  const { calls } = await importCsv(csv);

  assert.equal(calls.length, 2);
});

/* ── Check-in columns are exported, never imported, and said so ──────────── */

test('a file carrying check-ins imports the guests and says the arrivals were not', async () => {
  const csv = 'guest_name,response,checked_in,checked_in_at\n'
    + 'A,yes,Yes,2026-08-01T19:42:00Z\n';

  const { calls, res } = await importCsv(csv);

  assert.equal(calls.length, 1, 'the guest still imports');
  const body = res.body?.data || res.body;
  assert.match(body.message, /Check-in columns .* not imported/);
});

test('a file with no check-in data says nothing about check-ins', async () => {
  const csv = 'guest_name,response\nA,yes\n';

  const { res } = await importCsv(csv);

  const body = res.body?.data || res.body;
  assert.equal(/Check-in/.test(body.message), false);
});

/* ── The party label can differ from the primary guest's name ────────────── */

/**
 * `rsvp_parties.label` and the primary guest's `full_name` are separate columns
 * and drift apart. When no named meal matched the label, the primary was treated
 * as a companion — so on a party of two the REAL companion was pushed past the
 * end of the companion list and silently dropped.
 */
test('a party whose label matches nobody still keeps both people', async () => {
  const csv = 'guest_name,party_size,meal_selections\n'
    + '"The Danial Family",2,"David Danial: Beef; Lenora Danial: Fish"\n';

  const inserts = [];
  await importCsv(csv, WEDDING, { inserts });

  const companions = inserts.flat();
  assert.equal(companions.length, 1, 'a party of two has one companion');
  assert.equal(companions[0].full_name, 'Lenora Danial',
    'the real companion must not be displaced by the primary');
});

test('a single named meal on a bigger party stays a companion, not a promotion', async () => {
  // One meal recorded for a party of three: that person is a companion, and
  // guessing them into the primary slot would be inventing information.
  const csv = 'guest_name,party_size,meal_selections\nJane,3,"Bob: Fish"\n';

  const inserts = [];
  await importCsv(csv, WEDDING, { inserts });

  const companions = inserts.flat();
  assert.equal(companions.length, 2);
  assert.equal(companions[0].full_name, 'Bob');
  assert.equal(companions[1].full_name, 'Guest 3');
});

/* ── The "carried an answer" count must describe what was imported ───────── */

test('answers are counted against imported guests, not against the file', async () => {
  const dupes = [];
  mock.setResolver((s) => {
    if (s.table === 'events' && s.op === 'select') return { data: WEDDING };
    if (s.op === 'rpc' && s.fn === 'add_guest_to_party') {
      dupes.push(s.params);
      // The second row is an existing guest — imported reports one, so the
      // message must say one, not two.
      return dupes.length === 1
        ? { data: { success: true, party_id: 'p1', guest_id: 'g1' } }
        : { data: { success: false, error: 'DUPLICATE_GUEST' } };
    }
    return {};
  });

  const csv = 'guest_name,email,response\nA,a@example.com,yes\nB,b@example.com,yes\n';
  const { res } = await invoke(
    importGuestsCSV,
    mockReq({ params: { eventId: EVENT }, body: { csvData: csv }, user: { id: 'owner-1' } }),
  );

  const body = res.body?.data || res.body;
  assert.equal(body.answeredCount, 1, 'only the guest actually created carried an answer through');
  assert.match(body.message, /1 of them carried an answer/);
});
