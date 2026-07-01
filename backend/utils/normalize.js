/**
 * Single source of truth for normalizing guest-supplied identity fields.
 * Previously `email.trim().toLowerCase()` was copy-pasted across
 * submitPublicRSVP / importGuestsCSV / updateRSVP / addGuestManually with no
 * shared helper — easy to miss in one path and let "John@x.com" and
 * "john@x.com" both slip past the dedup guard. Phone normalization already
 * had a single source (`./phone.js`); this gives email the same treatment.
 */

/** Normalize a raw email to lowercase + trimmed, or null if blank. */
function normalizeEmail(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).normalize('NFC').trim().toLowerCase();
  return s ? s : null;
}

/** Escape special characters in user input before using it in a LIKE / ILIKE pattern. */
function escapeLikePattern(str) {
  return String(str || '').replace(/[%_\\]/g, '\\$&');
}

module.exports = { normalizeEmail, escapeLikePattern };
