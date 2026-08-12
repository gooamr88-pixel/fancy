/**
 * THE GUEST SHEET — one definition of what a column is called and what it means.
 *
 * ── Why this file exists ──
 *
 * The answer to "what can my spreadsheet contain?" was spread across five places
 * that each knew part of it:
 *
 *   • the CSV branch of importGuestsCSV (aliases, per column, inline);
 *   • the .xlsx branch (a SECOND alias list, written separately, already drifted
 *     — it read `note`, which the CSV branch did not);
 *   • exportParties' header array (the round-trip contract);
 *   • a grey sentence inside the import modal's drop zone;
 *   • nothing at all in the Guest list section, where organizers actually build
 *     the file.
 *
 * A column could therefore be accepted by one importer and ignored by the other,
 * and documented by neither. `sms_consent` had already been through exactly that:
 * three spellings accepted client-side, one read server-side.
 *
 * ── What `aliases` is for, and what it is NOT for ──
 *
 * Organizers build these files by hand, in Excel, in two languages, and the
 * "obviously correct" header name is only obvious to whoever wrote the parser.
 * Aliases absorb the reasonable guesses. They are NOT a licence to accept
 * anything: an unrecognised column is reported back to the organizer by name
 * (see `unknownColumns`), because a silently ignored `mobile` column is a
 * guest list with no phone numbers and nothing to explain why.
 *
 * ── `imported: false` ──
 *
 * Recognised, deliberately discarded, and SAID so. The export writes check-in
 * columns; re-importing them would fabricate a door record ("this person walked
 * in at 19:42" is evidence, and a spreadsheet must not be able to assert it).
 * They are listed here so they do not show up as unknown columns on a file this
 * platform produced itself.
 */

/** @typedef {{key:string, aliases:string[], required?:boolean, imported?:boolean}} GuestColumn */

/** @type {GuestColumn[]} */
const GUEST_IMPORT_COLUMNS = [
  { key: 'guest_name', aliases: ['name', 'guest'], required: true },
  { key: 'email', aliases: [] },
  { key: 'phone', aliases: [] },
  { key: 'party_size', aliases: [] },
  { key: 'response', aliases: ['rsvp', 'status'] },
  { key: 'side', aliases: [] },
  { key: 'sms_consent', aliases: ['sms_ok', 'can_text'] },
  { key: 'table_name', aliases: ['table', 'assigned_table'] },
  { key: 'meal_selections', aliases: ['meal', 'meals', 'primary_meal_selection'] },
  { key: 'notes', aliases: ['note'] },

  /* Recognised so they are not reported as unknown; never written. */
  { key: 'checked_in', aliases: [], imported: false },
  { key: 'checked_in_at', aliases: [], imported: false },
  { key: 'check_in_method', aliases: [], imported: false },
  { key: 'undone_check_in', aliases: [], imported: false },
];

/**
 * Every spelling this platform will answer to, canonical names included.
 * A Set because the only question ever asked of it is membership.
 */
const RECOGNISED_HEADERS = new Set(
  GUEST_IMPORT_COLUMNS.flatMap((c) => [c.key, ...c.aliases]),
);

/**
 * Fold a header cell into its canonical form.
 *
 * ── The bug this fixes ──
 *
 * The .xlsx branch has always done `trim().toLowerCase().replace(/\s+/g,'_')`.
 * The CSV branch did NOTHING: `parseCSV` keys each row by the raw header string,
 * so `Guest Name`, `Email ` or `PHONE` simply did not match the names the
 * importer looks up.
 *
 * That failed SILENTLY and catastrophically. Nothing errors — every row's
 * `guest_name` is undefined, so `row.guest_name || 'Unnamed Guest'` fires, and a
 * 400-row wedding list imports as four hundred guests called "Unnamed Guest"
 * with no email, no phone and no answers. The organizer is shown a green
 * "Import Complete · 400 guests imported successfully".
 *
 * And the two file formats disagreed about it, so the same spreadsheet worked as
 * .xlsx and destroyed itself as .csv — with the CSV being the format this
 * platform documents as the round-trip one.
 *
 * Excel is also the reason for the quote and BOM handling: it writes a UTF-8 BOM
 * onto the first header of every CSV it exports, and will quote a header that
 * contains a comma.
 */
function normalizeHeader(raw) {
  return String(raw == null ? '' : raw)
    .replace(/^﻿/, '')
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/**
 * Headers in a file that this platform does not know.
 *
 * Reported rather than ignored: an organizer whose column is called `mobile`
 * gets a guest list with no phone numbers, and without being told the column
 * name they have no way to find out why. Blank headers are skipped — a trailing
 * comma in a hand-edited CSV produces one and it means nothing.
 */
function unknownColumns(headers) {
  const seen = new Set();
  for (const h of headers || []) {
    const key = normalizeHeader(h);
    if (!key || RECOGNISED_HEADERS.has(key)) continue;
    seen.add(key);
  }
  return [...seen];
}

module.exports = {
  GUEST_IMPORT_COLUMNS,
  RECOGNISED_HEADERS,
  normalizeHeader,
  unknownColumns,
};
