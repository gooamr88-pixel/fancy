/**
 * "<Partner Name>'s Side" — the single source of truth for how a guest's chosen
 * side is written anywhere an organizer reads it (RSVP notification emails, the
 * dashboard guest list, the CSV/Excel export).
 *
 * Falls back to "Groom's/Bride's Side" on a wedding, or "Partner 1/2's Side"
 * otherwise, when the organizer hasn't named that partner. `groom_name`/
 * `bride_name` are the pre-rename keys some older events still carry (see
 * EventSettings.js) — read them too, or those events silently show the generic
 * label despite having names on file.
 *
 * Returns null for an unset/invalid side so callers can skip the field entirely.
 */
const partnerNameFrom = (templateData, side) => {
  const td = templateData || {};
  const raw = side === 'partner1'
    ? (td.partner1 || td.groom_name)
    : (td.partner2 || td.bride_name);
  const name = raw == null ? '' : String(raw).trim();
  return name || null;
};

const sideLabel = (side, eventType, partner1Name, partner2Name) => {
  if (side !== 'partner1' && side !== 'partner2') return null;
  const isWedding = eventType === 'wedding';
  if (side === 'partner1') {
    if (partner1Name && String(partner1Name).trim()) return `${String(partner1Name).trim()}'s Side`;
    return isWedding ? "Groom's Side" : "Partner 1's Side";
  }
  if (partner2Name && String(partner2Name).trim()) return `${String(partner2Name).trim()}'s Side`;
  return isWedding ? "Bride's Side" : "Partner 2's Side";
};

/** Same label, resolved straight from an event row (`event_type` + `template_data`). */
const sideLabelForEvent = (side, event) => sideLabel(
  side,
  event?.event_type,
  partnerNameFrom(event?.template_data, 'partner1'),
  partnerNameFrom(event?.template_data, 'partner2'),
);

module.exports = { sideLabel, sideLabelForEvent, partnerNameFrom };
