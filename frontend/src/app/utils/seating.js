// Guest-facing seating (table search + seating map) is hidden until exactly 24 hours
// before the event's start, regardless of when the organizer built the chart. These
// helpers are the single source of truth for that TIME-based half of the rule on the
// client. Organizer-added guests (CSV import / Add Guest) bypass this entirely via a
// separate `guest.createdByOrganizer` flag checked alongside these helpers (see
// RsvpWizard.js's `seatingRevealed`) — these functions only ever compute the fallback
// used for genuinely self-serve parties. The backend enforces the same combined rule
// on its public seating endpoints; the organizer dashboard uses authenticated
// endpoints and is intentionally NOT affected.

export const SEATING_REVEAL_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/** True once we're within 24h of the event start. `now` is injectable for testing. */
export function isSeatingRevealed(eventDate, now = Date.now()) {
  if (!eventDate) return false;
  const start = new Date(eventDate).getTime();
  if (Number.isNaN(start)) return false;
  return now >= start - SEATING_REVEAL_WINDOW_MS;
}

/** The Date at which seating unlocks (event start − 24h), or null if date is invalid. */
export function seatingRevealAt(eventDate) {
  if (!eventDate) return null;
  const start = new Date(eventDate).getTime();
  if (Number.isNaN(start)) return null;
  return new Date(start - SEATING_REVEAL_WINDOW_MS);
}
