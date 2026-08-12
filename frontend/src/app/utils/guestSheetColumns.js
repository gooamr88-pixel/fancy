'use client';

/**
 * THE GUEST SHEET, DESCRIBED ONCE.
 *
 * ── Why this is a module and not copy inside a component ──
 *
 * Three surfaces have to say the same thing about the same file: the reference
 * panel in the Guest list, the template an organizer downloads from it, and the
 * hint inside the import modal. Written three times they drift, and the drift is
 * invisible — a column documented in one place and absent from the template is
 * a file that imports blank, and nothing about that failure points back here.
 *
 * The backend half of the same contract lives in
 * `backend/config/guestImportColumns.js`: canonical keys and every alias the
 * importer answers to. This module carries what THAT file has no business
 * knowing — the human explanation, the accepted values, and a worked example —
 * and `backend/test/guestSheetContract.test.js` fails if the two lists of column
 * names ever diverge.
 *
 * ── Why aliases are shown to the organizer ──
 *
 * Because they will not use our spelling. These files are built by hand, in
 * Excel, often in Arabic, by somebody who has a list from a family member. The
 * importer accepts `name`, `mobile`… no — it accepts `name`, not `mobile`, and
 * THAT is the point: an organizer who can see which spellings work will pick one
 * that works, and one who cannot will guess `mobile` and lose every phone
 * number in silence.
 */

/**
 * `required` is about the FILE, not the database: a row with no name imports as
 * "Unnamed Guest", which is never what anyone wanted.
 *
 * `example` values are what the downloadable template is filled with, so the
 * organizer opens a sheet that already demonstrates every format instead of a
 * bare header row they have to interpret.
 */
export const GUEST_SHEET_COLUMNS = [
  {
    key: 'guest_name',
    aliases: ['name', 'guest'],
    required: true,
    label: 'Their name',
    what: 'The name that appears on their invitation. One row per invitation, not per person — a family of four is a single row.',
    accepts: 'Any text',
    example: ['Sara Mahmoud', 'Omar & Nour Hassan'],
  },
  {
    key: 'email',
    aliases: [],
    label: 'Email address',
    what: 'Where their invitation is emailed. Must be unique — if two rows share an address, only the first is imported.',
    accepts: 'name@example.com, or leave blank',
    example: ['sara@example.com', 'omar@example.com'],
    contact: true,
  },
  {
    key: 'phone',
    aliases: [],
    label: 'Mobile number',
    what: 'Where their invitation is texted. Include the country code, or the number cannot be dialled.',
    accepts: '+20 100 123 4567 · +1 555 123 4567',
    example: ['+201001234567', ''],
    contact: true,
  },
  {
    key: 'party_size',
    aliases: [],
    label: 'How many people',
    what: 'Everyone on that invitation, including the person named. Leave blank for one. Your guest can change it when they reply.',
    accepts: 'A number from 1 to 20',
    example: ['1', '4'],
  },
  {
    key: 'response',
    aliases: ['rsvp', 'status'],
    label: 'Their answer',
    what: 'Only if you already collected it. Blank, missing or unrecognised means Pending — which is what keeps them in the reminders.',
    accepts: 'yes · no · maybe (also y/n, going, regrets, unsure)',
    example: ['', 'yes'],
  },
  {
    key: 'sms_consent',
    aliases: ['sms_ok', 'can_text'],
    label: 'May we text them?',
    what: 'Say per guest whether you have their permission to be texted. Without it their number is still saved — it just is never messaged until they opt in themselves.',
    accepts: 'yes · no',
    example: ['yes', ''],
  },
  {
    key: 'side',
    aliases: [],
    label: 'Whose side',
    // The two real labels are substituted in by the guide; this event may not
    // track sides at all, in which case the column is not shown.
    what: 'Which side of the family or party they belong to.',
    accepts: null, // resolved per event
    example: null, // resolved per event
    onlyWhen: 'track_guest_side',
  },
  {
    key: 'table_name',
    aliases: ['table', 'assigned_table'],
    label: 'Their table',
    what: 'Must match a table already on your seating chart, exactly. Importing never creates tables, and only guests who answered yes can be seated.',
    accepts: 'The table name as written on your chart',
    example: null, // resolved from the event's real tables
  },
  {
    key: 'meal_selections',
    aliases: ['meal', 'meals', 'primary_meal_selection'],
    label: 'What they are eating',
    what: 'Named people first, then a count for anyone unnamed. This is also the only column that carries companions’ names, so a party of four can arrive with all four.',
    accepts: 'Sara: Chicken; Omar: Fish; Guests: 2 x Beef',
    example: null, // resolved from the event's real meal options
  },
  {
    key: 'notes',
    aliases: ['note'],
    label: 'A private note',
    what: 'Only you ever see this. It never appears on the invitation.',
    accepts: 'Any text',
    example: ['', 'Uses a wheelchair'],
  },
];

/**
 * Written by the export, never read back by the import.
 *
 * Listed for the organizer because an exported file visibly contains them, and a
 * column that is present and does nothing is exactly the kind of thing somebody
 * assumes worked.
 */
export const IGNORED_COLUMNS = ['checked_in', 'checked_in_at', 'check_in_method', 'undone_check_in'];

/** Hard limits the importer enforces, stated where the file is being built. */
export const SHEET_LIMITS = {
  maxRows: 500,
  maxPartySize: 20,
};

/**
 * The columns this particular event should be shown, with its own side labels,
 * table names and meal options substituted into the examples.
 *
 * Generic examples are worse than none here: "Groom's Side" on an event whose
 * partners are named Yara and Karim is a value the importer will not match, and
 * an organizer copying the documentation would produce a file that silently
 * loses every side. The same is true of table names — the import matches them
 * against the real chart.
 */
export function resolveSheetColumns({ event, tables = [], mealOptions = [], sideLabels = {} } = {}) {
  const tableNames = (tables || [])
    .map((t) => t?.table_name)
    .filter(Boolean);
  const meals = (mealOptions || []).filter(Boolean);

  return GUEST_SHEET_COLUMNS
    .filter((c) => !c.onlyWhen || !!event?.[c.onlyWhen])
    .map((c) => {
      if (c.key === 'side') {
        const one = sideLabels.partner1 || 'Partner 1’s Side';
        const two = sideLabels.partner2 || 'Partner 2’s Side';
        return { ...c, accepts: `${one} · ${two}`, example: [one, two] };
      }
      if (c.key === 'table_name') {
        // A real table if the chart has one, so the example is copy-pasteable.
        // Falling back to a plausible name rather than to nothing: an empty
        // example column reads as "this does not apply to me".
        const first = tableNames[0] || 'Table 1';
        return { ...c, accepts: `${tableNames.slice(0, 3).join(' · ') || 'Table 1 · Table 2'}`, example: ['', first] };
      }
      if (c.key === 'meal_selections') {
        const a = meals[0] || 'Chicken';
        const b = meals[1] || 'Fish';
        return {
          ...c,
          accepts: `Sara: ${a}; Omar: ${b}; Guests: 2 x ${a}`,
          example: [`Sara Mahmoud: ${a}`, `Omar Hassan: ${a}; Nour Hassan: ${b}; Guests: 2 x ${a}`],
        };
      }
      return c;
    });
}

/** RFC 4180: a cell containing a comma, quote or newline is quoted, quotes doubled. */
function csvCell(value) {
  const s = String(value == null ? '' : value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The downloadable starter file: the exact header row the importer reads, plus
 * two worked example rows.
 *
 * TWO rows, not one, and they are deliberately different shapes — a solo guest
 * with the minimum filled in, and a family of four with a side, a table, meals
 * for named companions and a note. One row cannot show that `party_size` and
 * `meal_selections` are related, and it is that relationship people get wrong.
 *
 * A BOM is prepended because Excel assumes the system codepage otherwise, and an
 * Arabic name in the example row would open as mojibake — which teaches the
 * organizer that this platform mangles Arabic before they have imported anything.
 */
export function buildTemplateCsv(columns) {
  const header = columns.map((c) => c.key).join(',');
  const rows = [0, 1].map((i) => columns.map((c) => csvCell((c.example || [])[i] ?? '')).join(','));
  return `﻿${[header, ...rows].join('\r\n')}\r\n`;
}
