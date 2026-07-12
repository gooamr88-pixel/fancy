/* Table names set on the organizer's seating map are typically a bare number
   (e.g. "5") — shown alone that reads ambiguously (a quantity? a code?).
   Prefixing "Table" makes it unambiguous; skipped when the organizer already
   gave the table a descriptive name (e.g. "Rose Garden") since prefixing
   there would just be noise. Mirrors formatTableLabel in
   backend/utils/emailTemplates.js so the guest sees the same wording in the
   email as on the RSVP page, the digital pass, and the seating map. */
export function formatTableLabel(tableName, isRTL = false) {
  const trimmed = String(tableName || '').trim();
  if (!trimmed) return '';
  if (!/^\d+$/.test(trimmed)) return trimmed;
  return isRTL ? `طاولة ${trimmed}` : `Table ${trimmed}`;
}
