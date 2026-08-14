require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderSmsBody, clip, clipList, TEMPLATES } = require('../utils/smsTemplates');
const { computeSmsSegments } = require('../utils/smsSegments');
const { COMPLIANCE_FOOTER } = require('../services/smsDispatch');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SMS COPY IS BILLED BY THE CHARACTER. THIS IS THE BILL.
 *
 * smsTemplates.js has always carried the instruction "THE RULE WHEN EDITING
 * COPY HERE: re-measure" — and nothing has ever enforced it. A reword that
 * reads better and quietly adds a segment makes every event on the platform
 * more expensive, with no error, no warning, and no way to notice except an
 * invoice. This file is that rule, executable.
 *
 * Two things are pinned:
 *
 *   1. A SEGMENT CEILING per message, measured at WORST CASE — every
 *      interpolated value at its clip cap, plus the real compliance footer and
 *      a real shortened link. Not a typical case: a wording that only fits
 *      short names has to fail here rather than on a real guest list.
 *
 *   2. THE ENCODING. An English message must stay GSM-7 (153 units/segment).
 *      A single non-GSM character anywhere flips the whole body to UCS-2 at 67
 *      units/segment, which roughly doubles the cost — and this is not
 *      hypothetical: `clip` appended '…' for exactly that reason, so any guest
 *      whose name ran one character past the cap silently cost double.
 *
 * Raising a ceiling here is allowed. It is a pricing decision, it should be
 * deliberate, and changing the number in this file is how it gets made.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** A real shortened link, the shape shortenContextLinks actually produces. */
const LINK = 'https://fancyrsvp.com/i/Ab3xK9';

/** Every value at its cap — see NAME_MAX / TITLE_MAX / VENUE_MAX in the module. */
const WORST = {
  guestName: 'Abdelrahman El-Sharkawy',
  eventTitle: 'Yara & Hisham Abdelaziz Wedding Party',
  dateLabel: 'Saturday 12 September 2026',
  venue: 'Fairmont Nile City Hotel, The Grand Ballroom',
  tableName: 'Top Table 12',
  companions: ['Mona Ahmed Hassan', 'Karim Fouad Ali', 'Nadia Salem Omar', 'Extra Person'],
  meals: ['Beef Steak x2', 'Grilled Fish x1', 'Vegetarian x1'],
  attending: 128,
  pending: 34,
  rsvpUrl: LINK, ticketUrl: LINK, url: LINK, dashboardUrl: LINK,
};

const measure = (type, lang, over = {}) => {
  const body = renderSmsBody(type, lang, { ...WORST, ...over });
  assert.ok(body, `${type}/${lang} produced no body`);
  return { body, ...computeSmsSegments(body + COMPLIANCE_FOOTER) };
};

/**
 * The ceilings, as measured. English sits at 2 segments for everything except
 * the deliberately detailed confirmation; Arabic pays the UCS-2 tax throughout.
 */
const CEILINGS = [
  ['invitation', 'en', {}, 2],
  ['invitation', 'ar', {}, 3],

  ['seating_reminder', 'en', {}, 2],
  ['seating_reminder', 'en', { dateLabel: null }, 2],
  ['seating_reminder', 'en', { tableName: null }, 2],
  ['seating_reminder', 'en', { tableName: null, dateLabel: null }, 2],
  ['seating_reminder', 'ar', {}, 4],
  ['seating_reminder', 'ar', { dateLabel: null }, 4],
  ['seating_reminder', 'ar', { tableName: null }, 4],
  ['seating_reminder', 'ar', { tableName: null, dateLabel: null }, 3],

  /**
   * The one type that buys detail with segments on purpose — see its own note
   * in smsTemplates.js.
   *
   * The Arabic ceiling of SEVEN is the true worst case, not an aspiration: a
   * long name, a long title, a long venue, a table name that is a phrase, four
   * companions and three meals. A typical Arabic confirmation measures 5. Both
   * numbers were verified identical before and after the friendlier rewrite, so
   * this ceiling records what the type has always cost rather than a new budget
   * the rewrite spent.
   */
  ['rsvp_confirmation', 'en', {}, 3],
  ['rsvp_confirmation', 'ar', {}, 7],
  ['rsvp_confirmation', 'en', { dateLabel: null, venue: null, tableName: null, companions: [], meals: [] }, 2],
  ['rsvp_confirmation', 'ar', { dateLabel: null, venue: null, tableName: null, companions: [], meals: [] }, 4],

  ['event_update', 'en', { cancelled: false }, 2],
  ['event_update', 'en', { cancelled: true }, 2],
  ['event_update', 'ar', { cancelled: false }, 4],
  ['event_update', 'ar', { cancelled: true }, 3],

  ['organizer_report', 'en', {}, 2],
  ['organizer_report', 'ar', {}, 3],
];

for (const [type, lang, over, ceiling] of CEILINGS) {
  const variant = Object.keys(over).length ? ` (${Object.keys(over).join('+')} omitted)` : '';
  test(`${type}/${lang}${variant} costs at most ${ceiling} segment(s)`, () => {
    const { segments, length, encoding, body } = measure(type, lang, over);
    assert.ok(
      segments <= ceiling,
      `${type}/${lang} is ${segments} segments (${length} ${encoding} units), ceiling ${ceiling}.\n`
      + `Every guest on every event pays the difference. Shorten it, or raise the\n`
      + `ceiling here deliberately.\n  ${body}`,
    );
  });
}

/* ── Encoding ─────────────────────────────────────────────────────────────── */

test('every English body stays in GSM-7', () => {
  // One curly quote, one em dash, one '…' anywhere in this file costs ~80
  // characters of headroom on every English message the platform sends.
  for (const [type] of Object.entries(TEMPLATES)) {
    for (const over of [{}, { cancelled: true }, { tableName: null, dateLabel: null }]) {
      const { encoding, body } = measure(type, 'en', over);
      assert.equal(encoding, 'GSM-7', `${type}/en left GSM-7 — find the non-GSM character:\n  ${body}`);
    }
  }
});

test('truncating a long value does not change the encoding', () => {
  // The regression that motivated this file. `clip` appended U+2026, which is
  // not GSM-7, so a name one character past the cap doubled the segment count.
  const short = measure('invitation', 'en', { guestName: 'Sara' });
  const long = measure('invitation', 'en', { guestName: 'Abdelrahman Elsharkawy Zaki Mohamed' });
  assert.equal(short.encoding, 'GSM-7');
  assert.equal(long.encoding, 'GSM-7',
    'a truncated value flipped the message to UCS-2 — the truncation marker is not GSM-7');
  assert.equal(long.segments, short.segments,
    'truncation must not add a segment; it exists to prevent exactly that');
});

test('the truncation marker itself is GSM-7 safe', () => {
  const marked = clip('x'.repeat(50), 20);
  assert.equal(computeSmsSegments(marked).encoding, 'GSM-7');
  assert.ok(marked.length <= 20, 'clip must respect its own cap, marker included');
  assert.doesNotMatch(marked, /…/, 'U+2026 is not in the GSM-7 alphabet');
});

test('clip never returns more than its cap, even below the marker length', () => {
  // A length guard that can exceed its own limit is worse than none, because
  // every caller trusts the number it was given. Three-character caps are not
  // reachable from today's templates; the arithmetic is pinned regardless.
  for (const max of [0, 1, 2, 3, 4, 5]) {
    const out = clip('abcdefghij', max);
    assert.ok(out.length <= max, `clip(_, ${max}) returned ${out.length} chars: "${out}"`);
  }
});

test('a capped list stays capped, so a large family cannot inflate the send', () => {
  const many = Array.from({ length: 12 }, (_, i) => `Guest Number ${i + 1}`);
  const out = clipList(many, 18, 3);
  assert.match(out, /\+9 more$/);
  assert.equal(computeSmsSegments(out).encoding, 'GSM-7');
});

/* ── Warmth, where it is affordable ──────────────────────────────────────── */

test('the English guest messages greet the guest by name', () => {
  // The cheapest thing on this list that makes a text read as coming from a
  // person rather than a system. Four characters.
  for (const type of ['invitation', 'seating_reminder', 'rsvp_confirmation']) {
    const { body } = measure(type, 'en');
    assert.match(body, /^Hi /, `${type}/en should open with a greeting`);
  }
});

test('a cancellation does not open with a cheerful greeting', () => {
  // "Hi Sara!" in front of "your wedding is cancelled" reads as a mistake.
  const { body } = measure('event_update', 'en', { cancelled: true });
  assert.doesNotMatch(body, /^Hi /);
  assert.doesNotMatch(body, /!/, 'no exclamation mark on bad news');
  // And the word still has to be early enough to survive a skim on a lock screen.
  const words = body.split(/\s+/);
  assert.ok(
    words.indexOf('cancelled') <= 8,
    `"cancelled" must stay near the front; it is at word ${words.indexOf('cancelled')}`,
  );
});

test('the organizer report speaks in people, not statuses', () => {
  const { body } = measure('organizer_report', 'en');
  assert.match(body, /said yes/);
  assert.doesNotMatch(body, /awaiting reply/, '"awaiting reply" is a status field, not a sentence');
});
