require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { injectModule } = require('./helpers/inject');
const { createMockSupabase } = require('./helpers/mockSupabase');

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const invitationService = require('../services/invitationService');
const { getQRTicketTemplate } = require('../utils/emailTemplates');
const { renderSmsBody } = require('../utils/smsTemplates');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MOVING A GUEST ON THE SEATING MAP TELLS THEM — BY TEXT *AND* BY EMAIL.
 *
 * What was here before: seating a guest for the first time mailed them their
 * entry pass immediately and queued a text. Moving them afterwards queued the
 * text and sent NO EMAIL AT ALL — reassignSeat and saveSeatingBatch both said
 * so in a comment, on the reasoning that the pass a moved guest already holds
 * is still valid at the door.
 *
 * It is valid. checkinController re-reads the live assignment at scan time and
 * never trusts the table baked into the token, so the guest gets through the
 * gate either way. That was never the problem. The problem is that the guest is
 * holding an email that says table 7 while they are seated at table 3, and they
 * read it on the way to the venue — and for any guest with no phone number, or
 * who never consented to SMS, that email was the only thing that had ever named
 * a table to them.
 *
 * Three properties, and the third is the one that keeps this affordable:
 *
 *   1. a MOVE is mailed, in wording that says the table changed;
 *   2. a FIRST seating is mailed once, in the original wording;
 *   3. an UNCHANGED seat is not mailed again — the sweep runs every fifteen
 *      minutes forever, and a job that re-sends on every pass is worse than one
 *      that never sends.
 *
 * Nothing here needed a schema change. The `invitations` ledger already records
 * the table each pass named, so "what did we last tell this guest" is a
 * question the database can already answer.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const REPO = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const EVENT = {
  id: 'evt-1', title: 'The Wedding', event_date: '2026-09-01T18:00:00Z',
  location_name: 'The Grand Ballroom', location_address: '1 Nile St',
  location_lat: null, location_lng: null,
};

/**
 * Scripts one party seated at `tableName`, whose last EMAILED pass named
 * `lastEmailed` (pass `undefined` for "never emailed a pass").
 *
 * Returns the list of rows written to the invitations ledger, which is what
 * the assertions read: it records both that a send happened and which table it
 * claimed.
 */
function scriptParty({ tableName, lastEmailed, lang = 'en', response = 'yes' }) {
  const written = [];
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties') {
      return {
        data: {
          id: 'p1', label: 'Sara', response, preferred_lang: lang,
          guests: [{ is_primary_contact: true, email: 'sara@example.com' }],
          seating_assignments: tableName ? [{ tables: { table_name: tableName } }] : [],
          events: EVENT,
        },
      };
    }
    if (s.table === 'invitations') {
      if (s.op === 'insert') {
        written.push(s.payload);
        return { data: { id: 'inv-1' } };
      }
      // The ledger read. `undefined` means this party has never been mailed a
      // pass at all, which is a different answer from "mailed while unseated".
      return { data: lastEmailed === undefined ? [] : [{ metadata: { tableName: lastEmailed }, sent_at: '2026-08-01T00:00:00Z' }] };
    }
    return {};
  });
  return written;
}

/** Runs a send with the documented no-API-key mock transport. */
async function send(opts) {
  const key = process.env.BREVO_API_KEY;
  delete process.env.BREVO_API_KEY;
  try {
    return await invitationService.sendQrTicketEmail('evt-1', 'p1', opts);
  } finally {
    if (key !== undefined) process.env.BREVO_API_KEY = key;
  }
}

/* ── 1. A move is mailed, and says so ─────────────────────────────────────── */

test('a guest moved to another table is emailed again, flagged as a change', async () => {
  const written = scriptParty({ tableName: 'Table 3', lastEmailed: 'Table 7' });
  const res = await send({ skipIfUnchanged: true });

  assert.equal(res.sent, true, 'a moved guest must be mailed');
  assert.equal(res.changed, true, 'and the mail must know it is correcting an earlier one');
  assert.equal(written.length, 1, 'the send belongs in the invitations ledger');
  assert.equal(written[0].metadata.tableName, 'Table 3',
    'the ledger must record the NEW table, or the next move cannot be detected');
  assert.equal(written[0].metadata.changed, true);
});

/* ── 2. A first seating is mailed, in the original wording ───────────────── */

test('a guest seated for the first time gets the ordinary entry pass', async () => {
  // The counterweight. A rule that mails nothing unless it can prove a change
  // would silently drop the pass for every newly seated guest.
  scriptParty({ tableName: 'Table 3', lastEmailed: undefined });
  const res = await send({ skipIfUnchanged: true });

  assert.equal(res.sent, true);
  assert.equal(res.changed, false,
    'nothing changed for a guest who is hearing about their table for the first time');
});

/* ── 3. The same seat is never mailed twice ──────────────────────────────── */

test('a guest whose table did not change is not mailed a second time', async () => {
  /**
   * This is the case that makes the whole design safe to run on a schedule.
   *
   * assignSeat mails the pass the instant an organizer seats someone. Ten
   * minutes later the seating sweep reaches the same queue row and calls this
   * again. Without the skip, every guest on a 300-person chart would receive
   * two identical entry passes, and the organizer would be the one who heard
   * about it.
   */
  const written = scriptParty({ tableName: 'Table 3', lastEmailed: 'Table 3' });
  const res = await send({ skipIfUnchanged: true });

  assert.equal(res.sent, false);
  assert.equal(res.reason, 'UNCHANGED');
  assert.equal(written.length, 0, 'a skipped send must not be written to the ledger either');
});

test('an unseated guest who was mailed while unseated is not re-mailed', () => {
  // `null` (mailed with no table) and `undefined` (never mailed) have to stay
  // distinct — collapsing them with `|| null` makes every never-mailed guest
  // look like they were already told, and the pass stops going out at all.
  const src = read('services/invitationService.js');
  assert.match(src, /return t === undefined \? null : t;/,
    'lastEmailedTable must not collapse "never sent" into "sent with no table"');
});

/* ── 4. The mail actually reads differently ──────────────────────────────── */

test('the changed pass leads with the change, not with "here is your pass"', () => {
  const rsvp = { id: 'p1', guest_name: 'Sara', party_size: 2 };
  const plain = getQRTicketTemplate(rsvp, EVENT, { tableName: 'Table 3', links: {} });
  const moved = getQRTicketTemplate(rsvp, EVENT, { tableName: 'Table 3', links: {}, changed: true });

  assert.match(moved, /Your table has changed/);
  assert.match(moved, /out of date/,
    'the guest has to be told the earlier email is superseded, or they trust it');
  assert.doesNotMatch(plain, /has changed/,
    'a first pass must not claim something changed');

  // The QR, the party size and the venue are all still correct on a move — only
  // the framing changes. A variant that dropped the pass would be worse than
  // the silence it replaced.
  assert.match(moved, /Admits/);
  assert.match(moved, /Grand Ballroom/);
});

test('the Arabic guest gets an Arabic change notice', async () => {
  scriptParty({ tableName: 'Table 3', lastEmailed: 'Table 7', lang: 'ar' });
  const res = await send({ skipIfUnchanged: true });
  assert.equal(res.sent, true);

  const html = getQRTicketTemplate(
    { id: 'p1', guest_name: 'سارة', party_size: 2 },
    EVENT,
    { tableName: 'Table 3', links: {}, lang: 'ar', changed: true },
  );
  assert.match(html, /تغيّرت طاولتك/);
  assert.match(html, /dir="rtl"/);
});

test('an unseated guest is never told their table "changed" to nothing', async () => {
  /**
   * The reachable case: a guest is seated at 7, emailed, then UNSEATED. The
   * ledger says "Table 7", the live assignment says null, and "different"
   * is satisfied — so the derived wording announced a change and the notice
   * rendered the sentence "Your table is now ." with a hole in it.
   *
   * It is reachable from the organizer's "Resend QR ticket" button, which
   * passes no options at all and lets the wording be derived.
   */
  scriptParty({ tableName: null, lastEmailed: 'Table 7' });
  const res = await send({});
  assert.equal(res.sent, true, 'they should still get their pass');
  assert.equal(res.changed, false, 'but with no table there is nothing to announce a change to');

  // And the template refuses it independently, so a caller passing the flag by
  // hand cannot reintroduce the empty sentence.
  const html = getQRTicketTemplate(
    { id: 'p1', guest_name: 'Sara', party_size: 2 }, EVENT,
    { tableName: null, links: {}, changed: true },
  );
  assert.ok(!/Your table is now\s*\./.test(html), 'rendered a sentence with nothing in it');
  assert.ok(!html.includes('Your table has changed'),
    'the eyebrow and preheader must agree with the body');
  assert.match(html, /Assigned when you arrive/, 'the ordinary unseated wording is correct here');
});

test('the entry pass does not depend on a column the migration chain may not have', () => {
  /**
   * `rsvp_parties.preferred_lang` arrives in 20260821000000, part of the SMS
   * chain this deployment has a history of not having applied. PostgREST fails
   * the WHOLE select when one requested column is missing, so putting it on the
   * party query would turn an unapplied migration into PARTY_NOT_FOUND — and
   * this function is what assignSeat's automatic pass and the organizer's
   * resend button both call. Neither needed the column before.
   */
  const src = read('services/invitationService.js');
  const start = src.indexOf('async function sendQrTicketEmail');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(!body.includes('preferred_lang'),
    'preferred_lang must not be on sendQrTicketEmail\'s main select');
  assert.match(body, /await partyLang\(partyId\)/);
  // and the isolated read degrades to English rather than throwing
  const helper = src.slice(src.indexOf('async function partyLang'));
  assert.match(helper.slice(0, 400), /return 'en'/);
});

test('the subject line carries the news, in the guest\'s language', () => {
  // Two identical subjects in an inbox read as a duplicate, and the second one
  // — the correct one — is the one that gets ignored.
  const src = read('services/invitationService.js');
  assert.match(src, /Your table has changed: \$\{event\.title\}/);
  assert.match(src, /تغيّرت طاولتك – \$\{event\.title\}/);
});

/* ── 5. The text says it too ─────────────────────────────────────────────── */

test('the seating text distinguishes a move from a first seating', () => {
  const base = {
    guestName: 'Sara', eventTitle: 'The Wedding', tableName: 'Table 3',
    ticketUrl: 'https://fancyrsvp.com/i/Ab3xK9',
  };
  assert.match(renderSmsBody('seating_reminder', 'en', base), /Your table at The Wedding is Table 3/);
  assert.match(
    renderSmsBody('seating_reminder', 'en', { ...base, changed: true }),
    /has changed to Table 3/,
    'a move must not read identically to the text the guest already has',
  );
  assert.match(renderSmsBody('seating_reminder', 'ar', { ...base, changed: true }), /تغيّرت طاولتك/);
});

test('an unseated text never claims a table changed', () => {
  // There is no table to have changed, and the queue row for an unseated guest
  // is deleted anyway — but the template must not depend on that.
  const body = renderSmsBody('seating_reminder', 'en', {
    guestName: 'Sara', eventTitle: 'The Wedding', tableName: null,
    ticketUrl: 'https://fancyrsvp.com/i/Ab3xK9', changed: true,
  });
  assert.doesNotMatch(body, /changed/);
});

/* ── 6. The sweep is wired to all of it ──────────────────────────────────── */

test('the seating sweep mails as well as texts', () => {
  const src = read('services/emailScheduler.js');
  const start = src.indexOf('async function jobSeatingNotices');
  assert.notEqual(start, -1);
  const body = src.slice(start, src.indexOf('\n}', start));

  assert.match(body, /sendQrTicketEmail\(/, 'the sweep must send the email leg');
  assert.match(body, /skipIfUnchanged: true/,
    'without the skip, every scheduler pass re-sends the same pass forever');
  assert.match(body, /changed: movedByText/, 'and the text must be told when it is a move');
});

test('a failed email does not cost the guest their text', () => {
  // The two legs are independent: the mail is free and carries the pass, the
  // text is charged and carries the link. One throwing must not take the other.
  const src = read('services/emailScheduler.js');
  const start = src.indexOf('async function jobSeatingNotices');
  const body = src.slice(start, src.indexOf('\n}', start));
  const mailAt = body.indexOf('sendQrTicketEmail');
  const catchAt = body.indexOf('catch (mailErr)');
  assert.ok(catchAt > mailAt && catchAt !== -1, 'the email leg must be caught on its own');
  assert.ok(body.indexOf('sendTransactionalSms') > catchAt,
    'the text is sent after the mail has been caught, not inside its try');
});

test('the move is detected per channel, from that channel\'s own ledger', () => {
  /**
   * A guest with no phone was emailed table 7 and never texted anything. A text
   * telling them their table "has changed" would be the first message they ever
   * received about seating — announcing a change from a table they were never
   * told about.
   *
   * So the email asks the invitations ledger what IT last sent, and the text
   * asks sms_log what IT last sent. The two are allowed to disagree.
   */
  const src = read('services/emailScheduler.js');
  assert.match(src, /\.from\('sms_log'\)/);
  assert.match(src, /\.like\('ref', `seat:\$\{partyId\}:%`\)/,
    'the seat: ref doubles as the record of which table each text announced');
});
