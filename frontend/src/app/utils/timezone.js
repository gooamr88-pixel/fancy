/* ═══════════════════════════════════════════════════════════════
   THE CLOCK, ON THE CLIENT.

   A deliberate mirror of backend/utils/timezone.js. The two files are kept in
   step by hand rather than shared through a package because this repo has no
   mechanism for shipping code across the backend/frontend boundary, and the
   alternative — each side inventing its own date handling — is precisely the
   state this change exists to end.

   WHAT CHANGED, AND WHY EVERY `timeZone: 'UTC'` IS NOW A BUG

   Guest-facing screens used to format event dates with `timeZone: 'UTC'`. That
   was not a claim about UTC; it was a trick. Event times were stored as the
   literal digits an organizer typed, filed as though they were UTC, and
   printing them back "in UTC" reproduced those digits unchanged. It worked, in
   the narrow sense that the right numbers appeared — but only for the screens
   that remembered to do it, and never for anything that had to ACT on a date.
   The reminder scheduler read the same column as a real instant and fired
   hours away from the moment intended.

   Event dates are now real instants, converted on write through the event's
   own timezone. So a screen that still says `timeZone: 'UTC'` no longer
   reproduces the typed digits — it prints the UTC rendering of a real moment,
   which for a San Diego evening event is the following morning. The trick and
   the fix cannot coexist: every display must pass the event's zone.

   WHOSE ZONE, ON WHICH SCREEN

     Guest-facing (invitation, RSVP, pass, ticket)  →  event.timezone
     Organizer dashboard                            →  org.timezone
     Admin panel                                    →  PLATFORM_TIMEZONE

   Guests see the EVENT's clock, never their own browser's. A guest in London
   reading "6:30pm" for a San Diego wedding needs the hour they will arrive at
   the venue, not that hour translated into where they happen to be sitting
   while they read the invitation.
   ═══════════════════════════════════════════════════════════════ */

/** Mirrors the backend default. A read with no zone at all still lands somewhere a human recognises. */
export const PLATFORM_TIMEZONE = 'America/Los_Angeles';

/** Whether the browser's tz database recognises this name. Construction attempt, not a hard-coded list. */
export function isValidTimeZone(name) {
  if (!name || typeof name !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/**
 * A validated zone, or the platform default.
 *
 * Every formatter below routes through this, which is what makes a missing or
 * malformed `event.timezone` render a plausible time instead of throwing. An
 * unguarded bad zone throws RangeError inside `toLocaleString`, and on a guest
 * page that is not a wrong date — it is a blank invitation.
 */
export function safeZone(name) {
  return isValidTimeZone(name) ? name : PLATFORM_TIMEZONE;
}

/** How far ahead of UTC `timeZone` was at instant `ts`, in ms. See the backend twin for the full reasoning. */
export function zoneOffsetMs(ts, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  for (const part of dtf.formatToParts(new Date(ts))) p[part.type] = part.value;
  // `hour12:false` yields '24' for midnight on some ICU builds.
  const hour = p.hour === '24' ? 0 : Number(p.hour);
  const asIfUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    hour, Number(p.minute), Number(p.second),
  );
  return asIfUtc - ts;
}

/**
 * Formats an instant in a zone. THE formatting entry point for dates on the
 * client — call sites pass Intl options and never a `timeZone` of their own.
 *
 * Returns null rather than a placeholder for missing or unparseable input, so
 * a caller has to decide what an absent date looks like in its own layout.
 * Returning something like "Invalid Date" here would put that string on a
 * wedding invitation.
 */
export function formatInZone(value, timeZone, options = {}, locale = 'en-US') {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(locale, { ...options, timeZone: safeZone(timeZone) });
}

/**
 * An instant → "2027-05-15T18:30" as read in `timeZone`, for
 * `<input type="datetime-local">`.
 *
 * The single most damaging thing to get wrong on this screen. The edit form
 * prefills from this, so a shifted value shows the organizer a time they never
 * set — and saving writes that shift back permanently, moving the event again
 * on every visit.
 */
export function instantToWallClock(value, timeZone) {
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
 * "2027-05-15T18:30" typed in `timeZone` → the instant it names.
 *
 * Two passes: the first can land on the wrong side of a daylight-saving
 * boundary and therefore use the wrong offset; re-reading the offset at the
 * corrected instant fixes it. Values that already carry a zone designator are
 * already instants and pass through untouched.
 */
export function wallClockToInstant(value, timeZone) {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /([zZ]|[+-]\d{2}:?\d{2})$/.test(value.trim())) return value;

  // The time half is optional: a bare "2027-05-15" is a real input (an all-day
  // event), and it means midnight in the event's zone — not midnight UTC,
  // which would land an American event on the previous day.
  const m = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;

  const zone = safeZone(timeZone);
  const guess = Date.UTC(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0),
  );
  const first = zoneOffsetMs(guess, zone);
  let ts = guess - first;
  const second = zoneOffsetMs(ts, zone);
  if (second !== first) ts = guess - second;
  return new Date(ts).toISOString();
}

/**
 * The short zone label — "PT", "PST", "GMT+3".
 *
 * Printed beside real timestamps (payments, check-ins, sign-ins) because an
 * unlabelled clock time that belongs to neither the reader nor anyone obvious
 * is worse than no time at all. Deliberately NOT printed beside event times: a
 * guest reading an invitation wants "6:30pm", and an abbreviation there is
 * clutter, not clarity.
 */
export function zoneAbbreviation(value, timeZone, locale = 'en-US') {
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

/**
 * A real timestamp with its zone label attached — the standard rendering for
 * anything that happened at a moment in history rather than being scheduled.
 *
 * Used across the admin panel and the organizer's activity surfaces, where the
 * reader's question is "when did this actually happen, on a clock I can
 * reconcile against?" and an unlabelled number cannot answer it.
 */
export function formatTimestamp(value, timeZone, options = {}, locale = 'en-US') {
  const formatted = formatInZone(value, timeZone, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
    ...options,
  }, locale);
  if (!formatted) return null;
  const abbr = zoneAbbreviation(value, timeZone, locale);
  return abbr ? `${formatted} ${abbr}` : formatted;
}
