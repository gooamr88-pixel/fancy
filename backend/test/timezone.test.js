/**
 * The clock arithmetic everything else now depends on.
 *
 * These are not tests of Intl — they are tests of the two things this codebase
 * gets wrong when nobody is watching:
 *
 *   1. The inverse mapping. Intl converts an instant INTO a zone; going the
 *      other way (an organizer's typed "18:30" → the instant it names) is
 *      hand-rolled in timezone.js, and its two-pass correction exists purely
 *      to survive daylight-saving boundaries. A single-pass version passes
 *      every test written in June and fails in March.
 *
 *   2. The round trip. An event is written through wallClockToInstant and read
 *      back into the edit form through instantToWallClock. If those two
 *      disagree by even an hour, re-saving an event moves it — every time it
 *      is opened, compounding silently.
 */
const test = require('node:test');
const assert = require('node:assert');
const {
  PLATFORM_TIMEZONE,
  isValidTimeZone,
  safeZone,
  wallClockToInstant,
  instantToWallClock,
  formatInZone,
  zoneAbbreviation,
} = require('../utils/timezone');

const LA = 'America/Los_Angeles';
const CAIRO = 'Africa/Cairo';

/* ── The conversion itself ───────────────────────────────────────────────── */

test('a typed wall clock becomes the instant that clock names, per zone', () => {
  // The same digits are ten hours apart in these two places. Before this
  // change both were filed as "18:30Z" and the difference simply vanished.
  assert.equal(wallClockToInstant('2027-05-15T18:30', LA), '2027-05-16T01:30:00.000Z');
  assert.equal(wallClockToInstant('2027-05-15T18:30', CAIRO), '2027-05-15T15:30:00.000Z');
});

test('the offset is read at the instant, not once per zone', () => {
  // Los Angeles is -7 in May and -8 in January. A cached "LA is -8" would put
  // every summer event an hour out.
  assert.equal(wallClockToInstant('2027-01-15T18:30', LA), '2027-01-16T02:30:00.000Z');
  assert.equal(wallClockToInstant('2027-05-15T18:30', LA), '2027-05-16T01:30:00.000Z');
});

test('a value that already carries a zone designator is left alone', () => {
  // Re-interpreting an instant as a wall clock would move a real event. The
  // edit form round-trips some fields from the API and re-types others, so
  // both shapes genuinely arrive at the same function.
  assert.equal(wallClockToInstant('2027-05-15T18:30:00Z', LA), '2027-05-15T18:30:00Z');
  assert.equal(wallClockToInstant('2027-05-15T18:30:00+03:00', LA), '2027-05-15T18:30:00+03:00');
});

test('a date with no time is midnight in the event zone, not midnight UTC', () => {
  // "2026-09-01" is a real input. Read as midnight UTC it would put an
  // American event on 31 August; read in the event's zone it stays on the 1st.
  assert.equal(wallClockToInstant('2026-09-01', LA), '2026-09-01T07:00:00.000Z');
  assert.equal(formatInZone(wallClockToInstant('2026-09-01', LA), LA, { day: 'numeric', month: 'long' }), 'September 1');
});

/* ── Daylight saving, which is where the naive version breaks ────────────── */

test('an event on either side of spring-forward keeps the hour that was typed', () => {
  for (const wall of ['2027-03-13T18:30', '2027-03-14T18:30', '2027-03-15T18:30']) {
    const back = instantToWallClock(wallClockToInstant(wall, LA), LA);
    assert.equal(back, wall, `${wall} did not survive the changeover`);
  }
});

test('an event on either side of fall-back keeps the hour that was typed', () => {
  for (const wall of ['2027-11-06T18:30', '2027-11-07T18:30', '2027-11-08T18:30']) {
    const back = instantToWallClock(wallClockToInstant(wall, LA), LA);
    assert.equal(back, wall, `${wall} did not survive the changeover`);
  }
});

test('the two genuinely ambiguous wall clocks resolve predictably', () => {
  // Neither of these can be "solved" — the wall clock is ambiguous by nature.
  // What matters is that the behaviour is fixed rather than accidental.

  // 02:30 never happens on the spring-forward day; it lands just before the gap.
  assert.equal(instantToWallClock(wallClockToInstant('2027-03-14T02:30', LA), LA), '2027-03-14T01:30');

  // 01:30 happens twice on the fall-back day; the earlier, still-DST one wins.
  assert.equal(zoneAbbreviation(wallClockToInstant('2027-11-07T01:30', LA), LA), 'PDT');
});

/* ── The round trip that protects the edit form ──────────────────────────── */

test('write → read → write is stable across zones, including odd offsets', () => {
  // Kolkata is +5:30 and Chatham is +12:45/+13:45. A conversion built on whole
  // hours passes everywhere else and fails exactly here.
  const zones = [LA, CAIRO, 'Asia/Kolkata', 'Australia/Adelaide', 'Pacific/Chatham', 'UTC'];
  const walls = ['2027-05-15T18:30', '2027-01-15T06:05', '2027-12-31T23:45', '2027-07-04T00:00'];

  for (const zone of zones) {
    for (const wall of walls) {
      const once = wallClockToInstant(wall, zone);
      const back = instantToWallClock(once, zone);
      assert.equal(back, wall, `${zone} / ${wall} did not round-trip`);

      // And re-saving the form must not move it a second time.
      const twice = wallClockToInstant(back, zone);
      assert.equal(twice, once, `${zone} / ${wall} drifted on re-save`);
    }
  }
});

test('midnight survives the ICU hour-24 quirk', () => {
  // Some ICU builds render midnight as '24' under hour12:false. Unhandled,
  // that puts the result a full day out for one hour of every day.
  assert.equal(instantToWallClock(wallClockToInstant('2027-05-15T00:00', LA), LA), '2027-05-15T00:00');
  assert.equal(instantToWallClock(wallClockToInstant('2027-05-15T00:00', CAIRO), CAIRO), '2027-05-15T00:00');
});

/* ── Refusing to throw on a guest page ───────────────────────────────────── */

test('an unusable zone falls back instead of throwing', () => {
  // An unguarded bad zone throws RangeError inside toLocaleString. On a guest
  // page that is not a wrong date — it is a blank invitation.
  assert.equal(isValidTimeZone('Mars/Olympus'), false);
  assert.equal(isValidTimeZone(LA), true);
  assert.equal(safeZone('Mars/Olympus'), PLATFORM_TIMEZONE);
  assert.equal(safeZone(null), PLATFORM_TIMEZONE);
  assert.equal(safeZone(undefined), PLATFORM_TIMEZONE);

  assert.doesNotThrow(() => formatInZone('2027-05-15T18:30:00Z', 'Mars/Olympus', { hour: 'numeric' }));
  assert.doesNotThrow(() => wallClockToInstant('2027-05-15T18:30', 'Mars/Olympus'));
});

test('absent and malformed input returns null rather than a placeholder', () => {
  // "Invalid Date" on a wedding invitation is worse than an empty slot, so the
  // caller has to decide what a missing date looks like in its own layout.
  for (const bad of [null, undefined, '', 'not-a-date', {}]) {
    assert.equal(formatInZone(bad, LA, { year: 'numeric' }), null, `${JSON.stringify(bad)} leaked a value`);
  }
  assert.equal(wallClockToInstant('not-a-date', LA), null);
  assert.equal(wallClockToInstant(null, LA), null);
  assert.equal(instantToWallClock(null, LA), '');
  assert.equal(instantToWallClock('not-a-date', LA), '');
});

/* ── The day key the analytics timeline buckets on ───────────────────────── */

test('a calendar day key is the event\'s day, not the UTC day', () => {
  /* analyticsController buckets every guest_analytics row with
     `instantToWallClock(created_at, zone).slice(0, 10)`. It used to use
     `toISOString().split('T')[0]` — the UTC day — and for an event behind UTC
     that pushed every evening event into the NEXT day's bar. Evening is when
     invitations are actually opened, so the busiest hours were consistently
     attributed to the wrong day. */
  const evening = '2026-08-21T03:00:00Z'; // 8:00 PM on the 20th in San Diego
  assert.equal(instantToWallClock(evening, LA).slice(0, 10), '2026-08-20');
  assert.equal(new Date(evening).toISOString().slice(0, 10), '2026-08-21', 'the old UTC key, for contrast');

  // Cairo is ahead of UTC, so it fails the other way: an early-morning event
  // there belongs to the day UTC still calls yesterday.
  const earlyCairo = '2026-08-21T01:00:00Z'; // 4:00 AM on the 21st in Cairo
  assert.equal(instantToWallClock(earlyCairo, CAIRO).slice(0, 10), '2026-08-21');
});

test('a range labelled "last N days" spans exactly N days', () => {
  /* Both edges are inclusive, so the window starts `N - 1` days back rather
     than N: today is one of the N. Counting back a full N and then including
     today as well drew EIGHT bars under a control that said "Last 7 days". */
  const now = new Date('2026-08-22T01:00:00Z').getTime(); // 6:00 PM Aug 21 in San Diego

  for (const days of [7, 30, 90]) {
    const from = instantToWallClock(now - (days - 1) * 86400000, LA).slice(0, 10);
    const to = instantToWallClock(now, LA).slice(0, 10);
    const start = new Date(wallClockToInstant(`${from}T00:00:00`, LA));
    const end = new Date(wallClockToInstant(`${to}T23:59:59`, LA));

    // +1s to carry 23:59:59 up to the next midnight before dividing.
    const spanned = Math.round((end - start + 1000) / 86400000);
    assert.equal(spanned, days, `"last ${days} days" spanned ${spanned}`);
  }
});

test('a from/to window closes on the event\'s midnights', () => {
  // The same conversion the endpoint applies to ?from / ?to.
  const start = wallClockToInstant('2026-08-14T00:00:00', LA);
  const end = wallClockToInstant('2026-08-21T23:59:59', LA);

  assert.equal(instantToWallClock(start, LA), '2026-08-14T00:00');
  assert.equal(instantToWallClock(end, LA), '2026-08-21T23:59');

  // Read as bare UTC dates — what the endpoint did before — the same strings
  // would have opened the window at 5pm the previous afternoon.
  assert.equal(instantToWallClock(new Date('2026-08-14').toISOString(), LA), '2026-08-13T17:00');
});

/* ── The label on real timestamps ────────────────────────────────────────── */

test('a zone abbreviation tracks daylight saving', () => {
  assert.equal(zoneAbbreviation('2027-01-15T12:00:00Z', LA), 'PST');
  assert.equal(zoneAbbreviation('2027-07-15T12:00:00Z', LA), 'PDT');
});
