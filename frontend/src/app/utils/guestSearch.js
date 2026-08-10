'use client';

/**
 * Everything about one guest that a person might type into a search box.
 *
 * The search matched `guest_name` and `email` only. An organizer with a phone
 * number in front of them — from a missed call, a WhatsApp thread, the number a
 * guest just read out — could not find that guest at all, on the screen whose
 * entire job is finding guests.
 *
 * Phone matching also strips punctuation from BOTH sides, because the number is
 * stored E.164 (`+15551234567`) and nobody types it that way. Searching
 * "555 123 4567", "(555) 123-4567" or the last four digits all have to land.
 */
export function guestHaystack(r) {
  return [
    r.guest_name,
    r.email,
    r.phone,
    r.meal,
    r.notes,
    r.side,
    // Companions are people too — searching a spouse's name should find the party
    // they belong to, which is the only way to reach them from here.
    ...(Array.isArray(r.guests) ? r.guests.map((g) => g?.full_name) : []),
  ].filter(Boolean).join(' ').toLowerCase();
}

const digitsOnly = (v) => String(v || '').replace(/\D/g, '');

/** True if `q` matches this guest by text, or by phone ignoring formatting. */
export function matchesGuestSearch(r, q) {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (guestHaystack(r).includes(needle)) return true;

  // Digits-only fallback so "(555) 123-4567" finds "+15551234567".
  const qDigits = digitsOnly(needle);
  if (qDigits.length >= 3) {
    const phones = [r.phone, ...(Array.isArray(r.guests) ? r.guests.map((g) => g?.phone) : [])];
    if (phones.some((p) => digitsOnly(p).includes(qDigits))) return true;
  }
  return false;
}
