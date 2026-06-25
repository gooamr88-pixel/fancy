/**
 * Single source of truth for "is this event live for guests?" (INV-1 / CODE-1).
 *
 * Previously each public endpoint hand-rolled its own `is_paid && status` check
 * with subtly different rules, so a paused/completed event was half-open: the
 * landing page and the RSVP form still served it, but the personalized invitation
 * resolver and seating lookup 404'd. This predicate makes every guest-facing path
 * agree: an event is live only when it is paid AND active. The 'demo' event is the
 * single intentional bypass (it powers the public template preview).
 */
function isEventLiveForGuests(event) {
  if (!event) return false;
  if (event.slug === 'demo') return true;
  return event.is_paid === true && event.status === 'active';
}

module.exports = { isEventLiveForGuests };
