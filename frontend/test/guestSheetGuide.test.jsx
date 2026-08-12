import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import GuestSheetGuide from '../src/app/dashboard/components/GuestSheetGuide';
import { resolveSheetColumns, buildTemplateCsv } from '../src/app/utils/guestSheetColumns';

/* ═══════════════════════════════════════════════════════════════════════════
   THE TEMPLATE HAS TO BE IMPORTABLE.

   This panel makes a promise no other documentation in the product makes: it
   hands the organizer a file and implies that filling it in will work. If the
   template's header row disagrees with the importer by one character, we have
   shipped a document that teaches people to build a broken spreadsheet — and
   the failure is silent at the other end (a header we do not recognise is
   dropped, and the import still reports success).

   `backend/test/guestSheetContract.test.js` guards the column NAMES against the
   importer. These guard what this component actually produces: the header row,
   the example rows, and that the examples use THIS event's real tables, meals
   and side labels rather than generic ones the importer would reject.
   ═══════════════════════════════════════════════════════════════════════════ */

const WEDDING = {
  title: 'Yara & Karim',
  event_type: 'wedding',
  track_guest_side: true,
  // The keys sideLabel actually reads — `partner1_name` would silently fall back
  // to "Groom's Side" and the component would be tested against the wrong label.
  template_data: { partner1: 'Yara', partner2: 'Karim' },
};

const TABLES = [{ table_name: 'Head Table' }, { table_name: 'Table 2' }];
// `is_meal_field` is the flag findMealField treats as the source of truth (it is
// what submit_rsvp_v2 reads server-side). A fixture with only a meal-ish LABEL is
// not found, which is correct behaviour and would silently make the assertions
// below test the fallback examples instead of the event's real options.
const MEAL_FIELD = [{
  id: 'f1', field_label: 'Meal choice', field_key: 'meal_selection',
  field_type: 'select', is_meal_field: true,
  options: ['Kofta', 'Sea Bass'],
}];

/**
 * RFC 4180 field splitter — the same rule the backend's parseCSVLine follows.
 *
 * Written out rather than reusing `String.split(',')`, because the whole point
 * of the assertions below is that a naive split is WRONG on this file.
 */
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** The download path writes through an <a>; capture what it would have saved. */
function captureDownload() {
  const captured = {};
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: (blob) => { captured.blob = blob; return 'blob:stub'; },
    revokeObjectURL: () => {},
  });
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function stub() { captured.name = this.download; };
  return { captured, restore: () => { HTMLAnchorElement.prototype.click = realClick; } };
}

beforeEach(() => { vi.unstubAllGlobals(); });

describe('the downloadable template', () => {
  it('its header row is exactly the column keys, in order', () => {
    const columns = resolveSheetColumns({ event: WEDDING, tables: TABLES, mealOptions: ['Kofta'] });
    const csv = buildTemplateCsv(columns);
    const [header] = csv.replace(/^﻿/, '').split('\r\n');

    expect(header).toBe(columns.map((c) => c.key).join(','));
    // The one column without which a row is a guest called "Unnamed Guest".
    expect(header.startsWith('guest_name,')).toBe(true);
  });

  it('carries a BOM so Excel does not mangle a non-Latin name', () => {
    // Without it Excel reads the file in the system codepage and an Arabic guest
    // name opens as mojibake — teaching the organizer that we break Arabic
    // before they have imported anything.
    const csv = buildTemplateCsv(resolveSheetColumns({ event: WEDDING }));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('ships two example rows of different shapes, not one', () => {
    // One row cannot show that party_size and meal_selections are related, and
    // that relationship is the one people get wrong.
    const csv = buildTemplateCsv(resolveSheetColumns({ event: WEDDING, tables: TABLES }));
    const lines = csv.replace(/^﻿/, '').trim().split('\r\n');

    expect(lines).toHaveLength(3);
    expect(lines[1]).not.toBe(lines[2]);
  });

  it('every row has exactly one field per column when parsed properly', () => {
    // The property that actually matters. `meal_selections` can contain
    // "2 x Beef, 1 x Fish" and a side label can contain a comma; an unquoted
    // comma shifts every later cell one column left, which silently files a
    // meal as a note.
    const columns = resolveSheetColumns({
      event: WEDDING, tables: TABLES, mealOptions: ['Kofta', 'Sea Bass'],
    });
    const rows = buildTemplateCsv(columns).replace(/^﻿/, '').trim().split('\r\n');

    for (const row of rows) {
      expect(splitCsvLine(row)).toHaveLength(columns.length);
    }
  });

  it('quotes a value containing a comma rather than letting it split the row', () => {
    const fake = [
      { key: 'guest_name', aliases: [], example: ['Sara', 'Omar'] },
      { key: 'meal_selections', aliases: [], example: ['Guests: 2 x Beef, 1 x Fish', ''] },
    ];
    const line = buildTemplateCsv(fake).replace(/^﻿/, '').split('\r\n')[1];

    expect(line).toBe('Sara,"Guests: 2 x Beef, 1 x Fish"');
    expect(splitCsvLine(line)).toHaveLength(2);
  });

  it('uses THIS event’s side labels, not generic ones', () => {
    // A generic "Groom's Side" on an event whose partners are Yara and Karim is
    // a value the importer will not match, so copying the documentation would
    // silently lose every side.
    const columns = resolveSheetColumns({
      event: WEDDING,
      sideLabels: { partner1: 'Yara’s Side', partner2: 'Karim’s Side' },
    });
    const side = columns.find((c) => c.key === 'side');

    expect(side.example).toEqual(['Yara’s Side', 'Karim’s Side']);
  });

  it('drops the side column entirely when the event does not track sides', () => {
    const columns = resolveSheetColumns({ event: { track_guest_side: false } });
    expect(columns.find((c) => c.key === 'side')).toBeUndefined();
  });

  it('uses a real table from the chart, so the example is copy-pasteable', () => {
    const columns = resolveSheetColumns({ event: WEDDING, tables: TABLES });
    const table = columns.find((c) => c.key === 'table_name');

    expect(table.example).toContain('Head Table');
  });
});

describe('the panel in the Guest list', () => {
  it('offers the template without making anyone read anything', () => {
    render(<GuestSheetGuide event={WEDDING} tables={TABLES} customFields={MEAL_FIELD} />);

    expect(screen.getByRole('button', { name: /download the template/i })).toBeInTheDocument();
    // The summary IS shown collapsed — it is the one sentence somebody skimming
    // needs. What is behind the second click is the ten-row column reference,
    // which permanently open would push the guest list itself off the screen.
    expect(screen.getByText(/one row per invitation/i)).toBeInTheDocument();
    expect(screen.queryByText('guest_name')).not.toBeInTheDocument();
  });

  it('names every column, with its alternative spellings', () => {
    render(<GuestSheetGuide event={WEDDING} tables={TABLES} customFields={MEAL_FIELD} />);
    fireEvent.click(screen.getByRole('button', { name: /what can it contain/i }));

    for (const key of ['guest_name', 'email', 'phone', 'party_size', 'response', 'sms_consent', 'side', 'table_name', 'meal_selections', 'notes']) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
    // An organizer who can see that `rsvp` works will not invent `attending`.
    expect(screen.getByText('rsvp')).toBeInTheDocument();
    expect(screen.getByText('can_text')).toBeInTheDocument();
  });

  it('shows the event’s own meal options in the meals example', () => {
    render(<GuestSheetGuide event={WEDDING} tables={TABLES} customFields={MEAL_FIELD} />);
    fireEvent.click(screen.getByRole('button', { name: /what can it contain/i }));

    expect(screen.getByText(/Sara: Kofta; Omar: Sea Bass/)).toBeInTheDocument();
  });

  it('marks the one required column and nothing else', () => {
    render(<GuestSheetGuide event={WEDDING} tables={TABLES} customFields={MEAL_FIELD} />);
    fireEvent.click(screen.getByRole('button', { name: /what can it contain/i }));

    const required = screen.getAllByText('REQUIRED');
    expect(required).toHaveLength(1);
    // …and it sits in the guest_name row.
    expect(within(required[0].closest('td')).getByText('guest_name')).toBeInTheDocument();
  });

  it('states the four rules that cost the most when unknown', () => {
    render(<GuestSheetGuide event={WEDDING} tables={TABLES} customFields={MEAL_FIELD} />);
    fireEvent.click(screen.getByRole('button', { name: /what can it contain/i }));

    // getAllBy: the collapsed summary says this too, and it should — the rule
    // that matters most is worth saying twice.
    expect(screen.getAllByText(/one row per invitation/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/“Guest Name” and “guest_name” both work/i)).toBeInTheDocument();
    expect(screen.getByText(/skipped, not updated/i)).toBeInTheDocument();
    expect(screen.getByText(/up to 500 rows/i)).toBeInTheDocument();
  });

  it('downloads a file named after the event', () => {
    const { captured, restore } = captureDownload();
    try {
      render(<GuestSheetGuide event={WEDDING} tables={TABLES} customFields={MEAL_FIELD} />);
      fireEvent.click(screen.getByRole('button', { name: /download the template/i }));
      expect(captured.name).toBe('yara-karim-guest-list-template.csv');
    } finally {
      restore();
    }
  });
});
