require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { getNewRsvpOrganizerTemplate } = require('../utils/emailTemplates');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE HOST'S EMAIL CARRIES THE WHOLE SUBMISSION.
 *
 * The RSVP form can ask for a dozen things — a phone number, a meal, an
 * allergy, the names of everyone the guest is bringing, a note to the couple,
 * and every custom question the organizer built themselves. All of it was
 * collected, all of it was stored, and the one message the host actually opens
 * printed four rows: response, party size, email, side.
 *
 * So the bride's father was told "Ahmed accepted, party of 5" and had to open a
 * dashboard to find out who the five were, what they eat, and what Ahmed wrote
 * — which is the same as not being told, for the recipient this email exists
 * for. He is a co-recipient precisely BECAUSE he has no dashboard access.
 *
 * The rule these cases pin: every field the guest filled in appears, every
 * field they left blank is absent, and the panel never prints a label over
 * nothing. A form with three fields must still produce a short, clean email.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BASE = {
  eventTitle: 'Yara & Hisham',
  guestName: 'Ahmed Fouad',
  response: 'yes',
  partySize: 3,
  email: 'ahmed@example.com',
};

const FULL = {
  ...BASE,
  phone: '+201001234567',
  side: 'partner1',
  eventType: 'wedding',
  partner1Name: 'Yara',
  meal: 'Grilled Fish',
  dietaryNotes: 'Severe nut allergy',
  companions: [{ fullName: 'Mona Hassan' }, { fullName: 'Karim Ali' }],
  companionMealCounts: { 'Beef Steak': 1, Vegetarian: 1 },
  customAnswers: [
    { label: 'Arriving from', value: 'Alexandria' },
    { label: 'Bus transfer', value: true },
    { label: 'Song requests', value: ['Amr Diab', 'Fairuz'] },
  ],
  notes: 'Congratulations to you both!\nWe would love to sit near the family.',
  smsConsent: true,
  language: 'ar',
  submittedAt: '2026-08-20T15:40:00Z',
};

/* ── Everything the guest typed ──────────────────────────────────────────── */

test('every field the guest filled in reaches the host', () => {
  const html = getNewRsvpOrganizerTemplate(FULL);

  // Contact — the two fields a host reaches for when something changes on the day.
  assert.match(html, /ahmed@example\.com/);
  assert.match(html, /\+201001234567/);
  assert.match(html, /href="tel:\+201001234567"/, 'a phone on a phone should be tappable');

  // Catering. Both of these are the difference between a correct plate and an
  // ambulance, and neither was in this email before.
  assert.match(html, /Grilled Fish/);
  assert.match(html, /Severe nut allergy/);
  assert.match(html, /Beef Steak &times; 1/);
  assert.match(html, /Vegetarian &times; 1/);

  // Who is actually coming — a party of 3 used to be a NUMBER and nothing else.
  assert.match(html, /Mona Hassan/);
  assert.match(html, /Karim Ali/);
  assert.match(html, /Bringing \(2\)/);

  // The organizer's own questions, under the labels they wrote.
  assert.match(html, /Arriving from/);
  assert.match(html, /Alexandria/);

  // And the guest's own words.
  assert.match(html, /Congratulations to you both!/);
  assert.match(html, /Message from the guest/);
});

test('an answer is printed as an answer, not as its storage format', () => {
  // `answer_value` is jsonb: a checkbox is a boolean, a multiselect is an
  // array. Printing them with String() gave the host "true" and "a,b".
  const html = getNewRsvpOrganizerTemplate(FULL);
  assert.match(html, /Amr Diab, Fairuz/, 'a multiselect is a list of choices, not a joined blob');
  assert.match(html, />Yes</, 'a ticked checkbox reads as Yes');
  assert.doesNotMatch(html, />true</);
});

/* ── And nothing else ────────────────────────────────────────────────────── */

test('a bare RSVP produces a short mail, not a column of blanks', () => {
  const html = getNewRsvpOrganizerTemplate(BASE);

  for (const absent of ['Phone', 'Meal', 'Dietary', 'Bringing', 'Their Meals', 'SMS Updates', 'Message from the guest']) {
    assert.ok(!html.includes(absent), `"${absent}" must not appear when the guest gave none`);
  }
  // The four that were always there still are.
  assert.match(html, /Response/);
  assert.match(html, /Party Size/);
});

test('SMS consent is reported only for a guest who gave a number', () => {
  /**
   * A guest who left the phone field empty was never shown the consent
   * checkbox, so "Not opted in" describes a refusal that never happened — and
   * an organizer reading it would reasonably go and ask them to opt in.
   */
  const noPhone = getNewRsvpOrganizerTemplate({ ...BASE, smsConsent: false });
  assert.ok(!noPhone.includes('SMS Updates'));

  const withPhone = getNewRsvpOrganizerTemplate({ ...BASE, phone: '+201001234567', smsConsent: false });
  assert.match(withPhone, /SMS Updates/);
  assert.match(withPhone, /Not opted in/);
});

test('a companion with no name is dropped rather than printed empty', () => {
  const html = getNewRsvpOrganizerTemplate({
    ...BASE, companions: [{ fullName: 'Mona Hassan' }, { fullName: '   ' }, null],
  });
  assert.match(html, /Bringing/);
  assert.ok(!html.includes('Bringing (2)'), 'a blank name must not be counted');
});

test('a custom answer with no label is dropped — a uuid is not a question', () => {
  const html = getNewRsvpOrganizerTemplate({
    ...BASE, customAnswers: [{ label: null, value: 'Alexandria' }],
  });
  assert.ok(!html.includes('Alexandria'),
    'an answer whose label could not be resolved says nothing on its own');
});

/* ── Bounded output ──────────────────────────────────────────────────────── */

test('one guest cannot fill the host\'s inbox with a single RSVP', () => {
  /**
   * Every field here is typed by an unauthenticated stranger on a public form.
   * All of it is escaped, so none of it is an injection risk — but escaping
   * does not bound SIZE, and Gmail silently clips a message past ~102KB. The
   * failure mode is not a big email: it is the host opening a truncated one
   * with "[Message clipped]" where their guest list should be.
   *
   * submit_rsvp_v2 accepts 200 answers and 100 companions, so this is a
   * perfectly legal submission, not an attack.
   */
  const tally = {};
  for (let i = 0; i < 80; i++) tally[`Meal option number ${i}`] = 2;

  const html = getNewRsvpOrganizerTemplate({
    ...BASE,
    notes: 'x'.repeat(50000),
    companions: Array.from({ length: 100 }, (_, i) => ({ fullName: `Guest Number ${i}` })),
    companionMealCounts: tally,
    customAnswers: Array.from({ length: 200 }, (_, i) => ({
      label: `Question ${i}`, value: 'y'.repeat(3000),
    })),
  });

  /* 40KB raw, not 100KB. Quoted-printable inflates non-ASCII by roughly a
     third on the wire, so the raw budget has to sit well under Gmail's ~102KB
     clip rather than merely below it. */
  assert.ok(html.length < 40000, `the notification is ${html.length} bytes — it will be clipped`);
  // and it says so rather than silently dropping the rest
  assert.match(html, /\+80 more/, 'the companion list must report its real total');
  assert.match(html, /more answers — see the dashboard/);
});

test('the party size is still the true one when the name list is capped', () => {
  // A count derived from what is DISPLAYED would under-report the party.
  const html = getNewRsvpOrganizerTemplate({
    ...BASE, companions: Array.from({ length: 40 }, (_, i) => ({ fullName: `G${i}` })),
  });
  assert.match(html, /Bringing \(40\)/);
});

test('a value that is not a scalar is dropped, not stringified', () => {
  // `String({})` is "[object Object]", which is what the host would have read.
  // No form control this product ships produces an object.
  const html = getNewRsvpOrganizerTemplate({
    ...BASE,
    customAnswers: [{ label: 'Q', value: { nested: true } }],
    companions: [{ fullName: { nope: 1 } }, { fullName: 'Real Person' }],
  });
  assert.ok(!html.includes('[object Object]'));
  assert.match(html, /Real Person/);
  assert.match(html, /Bringing/, 'the one valid companion still shows');
});

test('a zero or an unticked box is an answer, not an absence', () => {
  // `if (!value) return null` would have swallowed both.
  const html = getNewRsvpOrganizerTemplate({
    ...BASE, customAnswers: [{ label: 'Children', value: 0 }, { label: 'Parking', value: false }],
  });
  assert.match(html, /Children/);
  assert.match(html, />0</);
  assert.match(html, /Parking/);
  assert.match(html, />No</);
});

/* ── A decline, and an edit ──────────────────────────────────────────────── */

test('a decline carries the reason the guest gave', () => {
  const html = getNewRsvpOrganizerTemplate({
    ...BASE, response: 'no', declineReason: 'Travelling that week — so sorry.',
  });
  assert.match(html, /Reason given/);
  assert.match(html, /Travelling that week/);
  assert.match(html, /declined/);
});

test('a maybe carries the date they promised to confirm by', () => {
  const html = getNewRsvpOrganizerTemplate({ ...BASE, response: 'maybe', maybeConfirmBy: '2026-08-25' });
  assert.match(html, /Will Confirm By/);
  assert.match(html, /2026-08-25/);
});

test('an edit is announced as an edit, not as a new RSVP', () => {
  // Telling a host "Ahmed accepted" for the third time is how they stop
  // reading these.
  const fresh = getNewRsvpOrganizerTemplate(BASE);
  const edit = getNewRsvpOrganizerTemplate({ ...BASE, isUpdate: true });
  assert.match(fresh, /New RSVP received/);
  assert.match(edit, /RSVP updated/);
  assert.match(edit, /has updated their response/);
});

/* ── Safety ──────────────────────────────────────────────────────────────── */

test('guest-typed text cannot inject markup into the host\'s inbox', () => {
  // Every one of these fields is free text from an unauthenticated public form.
  const html = getNewRsvpOrganizerTemplate({
    ...BASE,
    notes: '<script>alert(1)</script>',
    dietaryNotes: '<img src=x onerror=alert(1)>',
    companions: [{ fullName: '<b>Mona</b>' }],
    customAnswers: [{ label: 'Q', value: '<iframe src="evil"></iframe>' }],
  });
  // What matters is that no guest-supplied string ever opens a TAG. The
  // attribute names inside the payload survive as literal text ("onerror=" is
  // still in there, inside &lt;img …&gt;) and are inert — asserting their
  // absence would be asserting the wrong property.
  // Matched on the payloads themselves rather than on the tag names: the shell
  // legitimately contains an <img> (the logo), so asserting "no <img anywhere"
  // fails on the template's own chrome and proves nothing about the guest's
  // input.
  for (const raw of ['<script>alert', '<iframe src', '<img src=x', '<b>Mona']) {
    assert.ok(!html.includes(raw), `${raw} reached the host's inbox unescaped`);
  }
  assert.match(html, /&lt;script&gt;alert/, 'it is shown, escaped — the host should see what was sent');
  assert.match(html, /&lt;b&gt;Mona/);
});

test('the time it arrived is on the EVENT\'s clock, and names it', () => {
  // An unlabelled time that is neither the host's clock nor the guest's is
  // worse than none, and the server's timezone is an accident of hosting.
  //
  // This used to be satisfied by printing UTC — honest, but a clock nobody
  // involved in the event actually reads. Now the event carries a real zone,
  // so the stamp is converted into it. The label stays, for the original
  // reason: a host reconciling a late reply against a deadline has to know
  // which clock the number is on.
  const at = '2026-08-20T15:40:00Z';

  const sanDiego = getNewRsvpOrganizerTemplate({
    ...BASE, submittedAt: at, timeZone: 'America/Los_Angeles',
  });
  assert.match(sanDiego, /8:40\s*AM/, '15:40Z is 08:40 in San Diego');
  assert.match(sanDiego, /PDT|PT/, 'the clock is named');

  // A different organizer's event must read differently from the same instant
  // — otherwise the zone is being accepted and ignored, which is the exact
  // failure this whole change exists to end.
  const cairo = getNewRsvpOrganizerTemplate({
    ...BASE, submittedAt: at, timeZone: 'Africa/Cairo',
  });
  assert.match(cairo, /6:40\s*PM/, '15:40Z is 18:40 in Cairo');
  assert.ok(
    !cairo.includes('8:40 AM'),
    'the Cairo mail must not carry the San Diego rendering',
  );
});

/* ── Both recipients get the same thing ──────────────────────────────────── */

test('the groom\'s and bride\'s family get the full detail too, with their own CTA', () => {
  /**
   * The whole reason the co-recipient field exists is so the couple's family
   * does not have to ask the organizer who is coming. Sending them a thinner
   * version than the organizer gets would defeat it — and they are the ones
   * who cannot look it up, having no dashboard login.
   */
  const partner = getNewRsvpOrganizerTemplate({ ...FULL, recipientRole: 'partner', eventSlug: 'yara-hisham' });
  assert.match(partner, /Mona Hassan/);
  assert.match(partner, /Severe nut allergy/);
  assert.match(partner, /View Event Page/);
  assert.ok(!partner.includes('View in Dashboard'));
});

test('both send sites pass the detail, not just the first', () => {
  // The public wizard and the one-click token path both mail the host. A fix
  // applied to one of them leaves the other printing four rows.
  const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'rsvpController.js'), 'utf8');

  assert.match(src, /const submissionDetail = \{/);
  // Spread into BOTH the organizer and the partner call in the wizard path.
  assert.equal((src.match(/\.\.\.submissionDetail,/g) || []).length, 2,
    'the organizer and the partner recipients must both receive the detail');

  // And the token path, which has less to give but must give what it has.
  const tokenPath = src.slice(src.indexOf('Notify organizer + groom/bride'));
  assert.match(tokenPath, /phone: primaryGuest\?\.phone/);
  assert.match(tokenPath, /companions: sanitizedAdditional/);
  assert.match(tokenPath, /notes: party\?\.notes/);
});

test('the custom-question labels are looked up once, not per answer', () => {
  // One round trip on the hot RSVP path, and only when the submission actually
  // carried answers.
  const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'rsvpController.js'), 'utf8');
  assert.match(src, /\.from\('custom_form_fields'\)\.select\('id, field_label'\)/);
  assert.match(src, /answered\.length > 0/,
    'an RSVP with no custom answers must not query the fields table at all');
});
