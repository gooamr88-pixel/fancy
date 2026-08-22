/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PLATFORM'S CLOCK ARITHMETIC — one implementation, no library.
 *
 * Every timezone question in the backend routes through this file, because the
 * alternative is what the codebase had before it: a dozen call sites each
 * deciding for themselves whether a stored date was "digits an organizer typed"
 * or "a moment in history", and disagreeing.
 *
 * THE TWO KINDS OF VALUE, AND WHY THEY MUST NOT BE CONFUSED
 *
 *   A WALL CLOCK is what an organizer types: "2027-05-15T18:30". It is not a
 *   moment. It is a promise about what a clock on the venue wall will read. It
 *   only becomes a moment once you say WHOSE wall — and that is the event's
 *   timezone. 18:30 in America/Los_Angeles and 18:30 in Africa/Cairo are ten
 *   hours apart.
 *
 *   An INSTANT is a point on the universal timeline — what a TIMESTAMPTZ holds
 *   and what `Date.now()` returns. Reminders, seating reveals and "is this
 *   event over?" are all questions about instants, and they are the reason
 *   wall clocks must be converted rather than stored raw. A scheduler asked to
 *   fire "24 hours before 18:30" cannot answer without knowing the zone.
 *
 * The boundary is: convert at the edges — `wallClockToInstant` on write,
 * `formatInZone` / `instantToWallClock` on read — and let everything in
 * between deal only in instants. Code in the middle that reaches for a
 * wall-clock string is a bug in the making.
 *
 * NO DEPENDENCY, DELIBERATELY
 *
 * Node's own ICU already carries the full IANA database and updates with the
 * runtime, so `Intl` knows every zone and every daylight-saving rule, past and
 * future. A date library would add weight and a second tz database to keep in
 * sync with this one. The only thing Intl will not do directly is the inverse
 * mapping (wall clock → instant), which `zoneOffsetMs` below supplies.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * The zone every read falls back to when nothing better is known: a brand-new
 * lookup that failed, an account created before timezones existed, an event
 * whose snapshot is null.
 *
 * It is the company's own clock (San Diego), not UTC, and that is a product
 * decision rather than a technical one. A fallback of UTC would be "correct"
 * and useless — it would print times no human involved in the event is
 * reading, which is precisely the failure this whole change exists to end. An
 * organizer who slips through every detection path still sees a plausible
 * local time rather than an alien one.
 *
 * Overridable per-deployment so a future non-US instance is a config change
 * rather than a code change, but it must always name a real IANA zone.
 */
const PLATFORM_TIMEZONE = process.env.PLATFORM_TIMEZONE || 'America/Los_Angeles';

/**
 * Does the runtime's tz database recognise this name?
 *
 * The check is a construction attempt rather than a list membership test: the
 * IANA database gains zones and renames them, so any list hard-coded here
 * starts rotting the day it is written. Intl throws RangeError on an unknown
 * zone, and that throw is the authoritative answer.
 *
 * Guards every boundary where a zone name arrives from outside this file — a
 * geo-IP response, a database column, an organizer's settings form — so a
 * typo or a hostile string surfaces here instead of throwing deep inside a
 * template render, where it would take a whole email or guest page down.
 */
function isValidTimeZone(name) {
  if (!name || typeof name !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/** A validated zone, or the platform default. Never throws, never returns junk. */
function safeZone(name) {
  return isValidTimeZone(name) ? name : PLATFORM_TIMEZONE;
}

/**
 * How far ahead of UTC `timeZone` was at the instant `ts`, in milliseconds.
 *
 * Intl formats an instant INTO a zone; there is no API that reports a zone's
 * offset directly. So this asks the question the only way available: render
 * the instant's wall clock in the target zone, then read those digits back as
 * though they were UTC. The gap between that reconstruction and the original
 * instant IS the offset — daylight saving, historical rule changes, and
 * half-hour and 45-minute zones all included, because ICU applied them when it
 * formatted.
 *
 * Offset is a function of the instant, not of the zone alone. Los Angeles is
 * -8h in January and -7h in July, and asking "what is LA's offset" without an
 * instant is a question with no answer.
 */
function zoneOffsetMs(ts, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const p = {};
  for (const part of dtf.formatToParts(new Date(ts))) p[part.type] = part.value;

  // `hour12:false` renders midnight as '24' on some ICU versions rather than
  // '00' — an old and well-known quirk. Left unhandled it puts the
  // reconstruction a full day out for exactly one hour of every day, which is
  // the kind of bug that survives testing and then eats a midnight event.
  const hour = p.hour === '24' ? 0 : Number(p.hour);

  const asIfUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    hour, Number(p.minute), Number(p.second),
  );
  return asIfUtc - ts;
}

/**
 * Splits "2027-05-15T18:30[:00]" (or a space separator) into numeric parts.
 *
 * The time half is optional, because a bare "2027-05-15" is a value the API
 * genuinely receives — an all-day event, or a caller that only ever had a date
 * to give. Rejecting it would not fail loudly; `wallClockToInstant` would
 * return null and the date would silently vanish from the row it was meant to
 * populate. A date with no time means midnight, and midnight in the event's
 * zone is the only reading consistent with everything else here (treating it
 * as midnight UTC would put an American event on the previous day).
 */
function parseWallClock(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!m) return null;
  return {
    year: Number(m[1]), month: Number(m[2]), day: Number(m[3]),
    hour: Number(m[4] || 0), minute: Number(m[5] || 0), second: Number(m[6] || 0),
  };
}

/**
 * "2027-05-15T18:30" + a zone → the real instant that wall clock names.
 *
 * Two passes, and the second one is not optional. The first pass guesses by
 * treating the typed digits as UTC and subtracting the zone's offset at that
 * guess. But the guess can sit on the far side of a daylight-saving boundary
 * from the answer, in which case the offset used was the wrong one. Re-reading
 * the offset at the corrected instant and correcting again resolves it — the
 * classic failure without this is an event typed in the week around a DST
 * change landing an hour off.
 *
 * Two genuinely undefined cases exist and are documented rather than hidden:
 *   • Spring forward — 02:30 does not exist on the changeover day. The result
 *     lands on the instant that reads 01:30, i.e. just BEFORE the gap, so
 *     round-tripping such a value through the edit form shows 01:30 rather
 *     than the impossible time that was typed.
 *   • Fall back — 01:30 happens twice. The earlier (still-DST) reading wins.
 * Neither can be "solved"; the wall clock is genuinely ambiguous. What matters
 * is that the behaviour is fixed and predictable rather than accidental.
 *
 * A value that already carries a zone designator ("...Z", "...+03:00") is
 * already an instant and is returned untouched. Re-interpreting one of those
 * as a wall clock would move an event for real — this is the guard that lets
 * the function be called safely on mixed input, such as an edit form that
 * round-trips some fields from the API and re-types others.
 *
 * @returns {string|null} ISO-8601 instant, or null when `value` is unparseable.
 */
function wallClockToInstant(value, timeZone) {
  if (value == null || value === '') return null;

  if (typeof value === 'string' && /([zZ]|[+-]\d{2}:?\d{2})$/.test(value.trim())) {
    return value;
  }

  const p = parseWallClock(value);
  if (!p) return null;

  const zone = safeZone(timeZone);
  const guess = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);

  const firstOffset = zoneOffsetMs(guess, zone);
  let ts = guess - firstOffset;

  const secondOffset = zoneOffsetMs(ts, zone);
  if (secondOffset !== firstOffset) ts = guess - secondOffset;

  return new Date(ts).toISOString();
}

/**
 * The inverse: an instant → "2027-05-15T18:30" as read in `timeZone`.
 *
 * This is what a `<input type="datetime-local">` needs, and getting it wrong
 * is uniquely destructive: the edit form prefills with shifted digits, the
 * organizer sees a time they did not set, and saving writes that shift back to
 * the database permanently. Every re-open moves the event again.
 */
function instantToWallClock(value, timeZone) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(timeZone),
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  const p = {};
  for (const part of dtf.formatToParts(d)) p[part.type] = part.value;
  const hour = p.hour === '24' ? '00' : p.hour;

  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
}

/**
 * Formats an instant in a zone. The single formatting entry point — call sites
 * pass Intl options and never a `timeZone`, so no screen can quietly opt out
 * and render in the server's zone, which is an accident of hosting.
 */
function formatInZone(value, timeZone, options = {}, locale = 'en-US') {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(locale, { ...options, timeZone: safeZone(timeZone) });
}

/**
 * The short label for a zone at an instant — "PT", "PST", "GMT+3".
 *
 * Real timestamps (a payment, a check-in, a sign-in) are printed WITH this,
 * because an unlabelled "3:40 PM" that is neither the reader's clock nor
 * obviously anyone else's is worse than no time at all. Event times are
 * printed WITHOUT it: the guest page states the venue and the hour, and a zone
 * abbreviation beside a wedding time reads as clutter, not clarity.
 *
 * Instant-dependent for the same reason offsets are — the correct label for
 * Los Angeles is PST in January and PDT in July.
 */
function zoneAbbreviation(value, timeZone, locale = 'en-US') {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: safeZone(timeZone),
      timeZoneName: 'short',
    }).formatToParts(d);
    return parts.find((p) => p.type === 'timeZoneName')?.value || '';
  } catch {
    return '';
  }
}

module.exports = {
  PLATFORM_TIMEZONE,
  isValidTimeZone,
  safeZone,
  zoneOffsetMs,
  wallClockToInstant,
  instantToWallClock,
  formatInZone,
  zoneAbbreviation,
};
