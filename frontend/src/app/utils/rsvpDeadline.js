// Single source of truth for how "close" a guest is to an event's RSVP
// deadline, shared by every guest-facing render path (classic template,
// wizard, heritageArch) so "passed" / "urgent" read identically everywhere
// instead of each screen re-deriving its own date math.

/** Days remaining until `deadlineISO` (negative once passed). `now` is injectable for testing. */
export function getRsvpDeadlineStatus(deadlineISO, now = Date.now()) {
  if (!deadlineISO) return null;
  const deadline = new Date(deadlineISO).getTime();
  if (Number.isNaN(deadline)) return null;
  const daysLeft = Math.ceil((deadline - now) / (24 * 60 * 60 * 1000));
  return {
    passed: deadline < now,
    urgent: deadline >= now && daysLeft <= 3,
    daysLeft,
  };
}

/** "3 days" / "1 day", or the Arabic dual/plural equivalent for `daysLeft`. */
export function daysLeftPhrase(daysLeft, isRTL) {
  if (isRTL) {
    if (daysLeft === 1) return 'يوم واحد';
    if (daysLeft === 2) return 'يومان';
    return `${daysLeft} أيام`;
  }
  return `${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
}
