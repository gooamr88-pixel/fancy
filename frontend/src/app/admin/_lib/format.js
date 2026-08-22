import { PLATFORM_TIMEZONE, formatInZone, formatTimestamp } from '../../utils/timezone';

/**
 * ADMIN READS ONE CLOCK: the platform's own.
 *
 * Every date in this panel is a real timestamp — when a payment cleared, when
 * a session was opened, when an audit row was written. None of them belong to
 * an organizer or a guest, so none of them take an organizer's timezone. They
 * are facts about the business, and the business keeps one clock.
 *
 * They used to render in whatever zone the admin's own browser happened to be
 * in, unlabelled. That made the panel unusable for the one thing it exists
 * for: two people looking at the same refund and agreeing on when it happened.
 * An admin in Cairo and an admin in San Diego read the same row eight hours
 * apart, and nothing on screen said so.
 *
 * `adminTime` therefore always carries the zone abbreviation. `adminDate` omits
 * it because a bare calendar date has no clock to name — adding "PT" to
 * "Aug 22, 2026" would suggest a precision the value does not have.
 */
export function adminTime(value) {
  return formatTimestamp(value, PLATFORM_TIMEZONE) || '—';
}

/** Date only, on the platform clock. Deliberately unlabelled — see adminTime. */
export function adminDate(value) {
  return formatInZone(value, PLATFORM_TIMEZONE, {
    year: 'numeric', month: 'short', day: 'numeric',
  }) || '—';
}

/**
 * Formats a cents amount as a USD string, e.g. money(7900) => "$79.00".
 * Pass `decimals: 0` for whole-dollar summaries (e.g. large aggregate totals).
 */
export function money(cents, decimals = 2) {
  return `$${((cents || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export default money;
