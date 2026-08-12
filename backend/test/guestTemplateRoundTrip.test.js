require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');
const { mockReq, invoke } = require('./helpers/http');

/**
 * THE TEMPLATE WE HAND OUT, PUT BACK THROUGH THE IMPORTER.
 *
 * `guestSheetContract.test.js` proves the column NAMES agree across the layers.
 * That is necessary and not sufficient: a header can be recognised and its VALUE
 * still be discarded, which is precisely how this platform spent months unable
 * to re-import its own export (response, side, table and meals all silently
 * lost — see the note on normalizeResponseCsvValue).
 *
 * So this drives the whole path — the exact bytes of the downloadable template,
 * through parseCSV, through importGuestsCSV's mapping — and asserts what the
 * importer would actually write for each guest. Handing an organizer a starter
 * file is a promise that filling it in works; this is the test of that promise.
 *
 * The CSV below is byte-identical to what `buildTemplateCsv` emits for a wedding
 * with two tables and two meal options. It is written out rather than generated
 * because a CommonJS test cannot import the ESM module that builds it — and
 * guestSheetContract's header assertions are what stop this copy from drifting
 * into fiction.
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });
injectModule('../../utils/realtime', { broadcast: () => {} });

/** Rows the controller hands to the importer, captured. */
let handedRows = [];
injectModule('../../services/guestService', {
  importGuests: async (eventId, actorUserId, rows) => {
    handedRows = rows;
    return {
      imported: rows.map((r, i) => ({ id: `g${i}`, guest_name: r.guest_name })),
      skippedExisting: 0,
      errors: [],
      seating: { seated: 0, unknownTables: [], refused: {} },
    };
  },
});

const rsvpController = require('../controllers/rsvpController');

const EVENT = '11111111-1111-4111-8111-111111111111';

/** The exact file an organizer downloads, BOM and CRLF included. */
const TEMPLATE_CSV = '﻿'
  + 'guest_name,email,phone,party_size,response,sms_consent,side,table_name,meal_selections,notes\r\n'
  + "Sara Mahmoud,sara@example.com,+201001234567,1,,yes,Yara's Side,,Sara Mahmoud: Kofta,\r\n"
  + "Omar & Nour Hassan,omar@example.com,,4,yes,,Karim's Side,Head Table,Omar Hassan: Kofta; Nour Hassan: Sea Bass; Guests: 2 x Kofta,Uses a wheelchair\r\n";

/** A wedding whose partners are named, so the side labels are the real ones. */
function scriptEvent() {
  mock.setResolver((s) => {
    if (s.table === 'events' && s.op === 'select') {
      return {
        data: {
          event_type: 'wedding',
          // `partner1`/`partner2` are the keys sideLabelForEvent reads (with
          // groom_name/bride_name as the pre-rename fallback). Naming them
          // anything else here would make this test pass against a fallback
          // label rather than against the event's real one.
          template_data: { partner1: 'Yara', partner2: 'Karim' },
        },
      };
    }
    return {};
  });
}

const importCsv = (csvData, body = {}) => invoke(
  rsvpController.importGuestsCSV,
  mockReq({ params: { eventId: EVENT }, body: { csvData, ...body }, user: { id: 'u1' } }),
);

t.beforeEach(() => { mock.reset(); handedRows = []; scriptEvent(); });

test('the template imports two guests, not two rows of nothing', async () => {
  const { res } = await importCsv(TEMPLATE_CSV);

  assert.equal(res.statusCode, 201);
  assert.equal(handedRows.length, 2);
  // The failure this guards: a header mismatch imports every row as
  // "Unnamed Guest" under a green success panel.
  assert.deepEqual(handedRows.map((r) => r.guest_name), ['Sara Mahmoud', 'Omar & Nour Hassan']);
});

test('the BOM Excel writes does not become part of the first heading', async () => {
  await importCsv(TEMPLATE_CSV);
  assert.equal(handedRows[0].guest_name, 'Sara Mahmoud');
});

test('every column in the template lands on the guest', async () => {
  await importCsv(TEMPLATE_CSV);
  const [solo, family] = handedRows;

  assert.equal(solo.email, 'sara@example.com');
  assert.equal(solo.phone, '+201001234567');
  assert.equal(solo.party_size, 1);
  assert.equal(family.party_size, 4);
  assert.equal(family.notes, 'Uses a wheelchair');
  assert.equal(family.table_name, 'Head Table');
});

test("a blank answer is pending, and a filled one is kept", async () => {
  // The column that writes a decision on a guest's behalf. Blank must stay
  // pending — that is what keeps them in the reminder sweep.
  await importCsv(TEMPLATE_CSV);

  assert.equal(handedRows[0].response, 'pending');
  assert.equal(handedRows[1].response, 'yes');
});

test("the event's OWN side labels are read back, not just the generic ones", async () => {
  // The template prints "Yara's Side" because a generic "Groom's Side" would be
  // a value this event's importer does not match. Both halves have to agree, or
  // the documentation teaches people to lose the column.
  await importCsv(TEMPLATE_CSV);

  assert.equal(handedRows[0].side, 'partner1');
  assert.equal(handedRows[1].side, 'partner2');
});

test('the meals column survives, companions and tally together', async () => {
  // It is also the only column carrying companion NAMES, so losing it turns a
  // family of four into one person and three guests called "Guest N".
  await importCsv(TEMPLATE_CSV);

  assert.equal(handedRows[1].meal_selections, 'Omar Hassan: Kofta; Nour Hassan: Sea Bass; Guests: 2 x Kofta');
});

test('the per-guest texting permission is read from the column', async () => {
  await importCsv(TEMPLATE_CSV);

  // Column present → it answers per guest, and a blank cell means "no" rather
  // than falling through to the whole-file checkbox.
  assert.equal(handedRows[0].sms_consent_attested, true);
  assert.equal(handedRows[1].sms_consent_attested, false);
});

/* ── The header folding this template relies on ─────────────────────────── */

test('a hand-typed file with human headings imports identically', async () => {
  // The organizer who does not download the template, and types
  // "Guest Name, Email, Phone" instead. Before header folding this produced
  // guests called "Unnamed Guest" with no contact details and a success panel.
  await importCsv('Guest Name,Email,Phone,Party Size\r\nSara Mahmoud,sara@example.com,+201001234567,2\r\n');

  assert.equal(handedRows.length, 1);
  assert.equal(handedRows[0].guest_name, 'Sara Mahmoud');
  assert.equal(handedRows[0].email, 'sara@example.com');
  assert.equal(handedRows[0].phone, '+201001234567');
  assert.equal(handedRows[0].party_size, 2);
});

test('an unrecognised heading is named back to the organizer', async () => {
  const { res } = await importCsv('guest_name,mobile,Gift Received\r\nSara,+201001234567,Vase\r\n');

  assert.deepEqual(res.body.data.ignoredColumns, ['mobile', 'gift_received']);
  assert.match(res.body.data.message, /not recognised and were ignored: mobile, gift_received/);
  // …and the row still imports. An unknown column is the organizer's business,
  // not a reason to refuse their guest list.
  assert.equal(handedRows.length, 1);
  assert.equal(handedRows[0].phone, null, 'the mis-named column is dropped, as reported');
});

test("our own export's headings are never reported as unrecognised", async () => {
  // Otherwise every re-imported export would accuse the organizer of mystery
  // columns this platform put there itself.
  const { res } = await importCsv(
    'guest_name,email,phone,response,party_size,side,sms_consent,table_name,meal_selections,checked_in,checked_in_at,check_in_method,notes\r\n'
    + 'Sara,sara@example.com,,yes,1,,,,,Yes,2026-08-01 19:42,qr,\r\n',
  );

  assert.deepEqual(res.body.data.ignoredColumns, []);
});
