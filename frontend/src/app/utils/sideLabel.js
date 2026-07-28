/**
 * "<Partner Name>'s Side" — mirrors backend/utils/sideLabel.js so the dashboard,
 * the RSVP notification emails and the CSV/Excel export all name the side the
 * same way. Keep the two in sync.
 *
 * Falls back to "Groom's/Bride's Side" on a wedding, or "Partner 1/2's Side"
 * otherwise, when that partner hasn't been named. `groom_name`/`bride_name` are
 * the pre-rename keys older events still carry (see EventSettings.js) — read
 * them too, or those events show the generic label despite having names on file.
 *
 * Returns null for an unset/invalid side so callers can skip rendering entirely.
 */
export function partnerName(event, side) {
  const td = event?.template_data || {};
  const raw = side === 'partner1'
    ? (td.partner1 || td.groom_name)
    : (td.partner2 || td.bride_name);
  const name = raw == null ? '' : String(raw).trim();
  return name || null;
}

export function sideLabel(side, event) {
  if (side !== 'partner1' && side !== 'partner2') return null;
  const named = partnerName(event, side);
  if (named) return `${named}'s Side`;
  const isWedding = event?.event_type === 'wedding';
  if (side === 'partner1') return isWedding ? "Groom's Side" : "Partner 1's Side";
  return isWedding ? "Bride's Side" : "Partner 2's Side";
}
