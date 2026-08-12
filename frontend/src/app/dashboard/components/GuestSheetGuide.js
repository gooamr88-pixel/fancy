'use client';

/**
 * WHAT THE SPREADSHEET SHOULD CONTAIN — answered where the file is built.
 *
 * ── The gap this fills ──
 *
 * The whole answer used to be one grey sentence inside the import modal's drop
 * zone, listing nine column names run together with no explanation of what any
 * of them accepted — and it disappeared the moment a file was selected. So the
 * documentation was visible only before you had a file, and useless once you
 * did. There was nothing at all in the Guest list section, which is where an
 * organizer sits while actually preparing the list.
 *
 * The consequences were not hypothetical. A CSV headed "Guest Name" matched
 * nothing and imported four hundred guests called "Unnamed Guest" (fixed in
 * config/guestImportColumns.js). A column called `mobile` lost every phone
 * number silently. A `table_name` that did not exactly match the chart left
 * everyone unseated. None of those are mistakes an organizer can be blamed for
 * making against a nine-word hint.
 *
 * ── The shape of the answer ──
 *
 * Three layers, so somebody in a hurry and somebody being careful both get
 * served by the same panel:
 *
 *   1. A DOWNLOADABLE TEMPLATE — one click, already filled with two worked
 *      example rows using this event's own tables, meals and side labels. Most
 *      organizers should never need to read anything below it.
 *   2. THE FOUR RULES that cause the most damage when unknown.
 *   3. EVERY COLUMN, with what it accepts, an example, and the alternative
 *      spellings the importer answers to — because people will not use ours.
 *
 * ── Why the examples are event-specific ──
 *
 * A generic "Groom's Side" on an event whose partners are Yara and Karim is a
 * value the importer will not match, and an organizer copying it produces a file
 * that silently loses every side. Same for table names, which are matched
 * against the real chart. Documentation that demonstrates a value the system
 * will reject is worse than no documentation.
 */

import React, { useState, useMemo } from 'react';
import { findMealField } from '../../utils/mealField';
import { sideLabel } from '../../utils/sideLabel';
import {
  resolveSheetColumns, buildTemplateCsv, IGNORED_COLUMNS, SHEET_LIMITS,
} from '../../utils/guestSheetColumns';

const COLORS = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
  green: '#3D7A3D',
};

export default function GuestSheetGuide({ event, tables = [], customFields = [], onOpenImport }) {
  const [open, setOpen] = useState(false);

  const mealField = findMealField(customFields);

  const columns = useMemo(() => resolveSheetColumns({
    event,
    tables,
    mealOptions: mealField?.options || [],
    sideLabels: {
      partner1: sideLabel('partner1', event),
      partner2: sideLabel('partner2', event),
    },
  }), [event, tables, mealField]);

  const required = columns.filter((c) => c.required);
  const optional = columns.filter((c) => !c.required);

  /**
   * Built and downloaded in the browser.
   *
   * No endpoint, because there is nothing secret in it and a round trip would
   * make a one-click action feel like a request that can fail. The event's own
   * tables and meals are already in this component's props.
   */
  const downloadTemplate = () => {
    const csv = buildTemplateCsv(columns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = (event?.title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.download = `${slug || 'event'}-guest-list-template.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      background: COLORS.white, border: `1px solid ${COLORS.border}`,
      borderRadius: 12, overflow: 'hidden', fontFamily: 'var(--font-sans)',
    }}>
      {/* ── The one-click layer ─────────────────────────────── */}
      <div className="gsg-head" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, padding: '16px 18px', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12, minWidth: 0, flex: '1 1 260px' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: 'rgba(184,148,79,0.12)', color: COLORS.gold,
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{
              margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.charcoal, lineHeight: 1.35,
            }}>
              Your guest sheet
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: COLORS.stone, lineHeight: 1.6 }}>
              One row per invitation. Only the name is required — everything else you can
              leave blank and your guests will fill in themselves.
            </p>
          </div>
        </div>

        {/**
          * FULL-WIDTH AND STACKED ON A PHONE.
          *
          * "Download the template" and "What can it contain?" are 21 and 20
          * characters at 12px bold with `whiteSpace: nowrap` — roughly 197px and
          * 168px including padding. Two of those cannot share a line inside the
          * ~252px this card offers at 320px, so they wrapped into two ragged
          * left-aligned buttons of different widths beside a half-width
          * paragraph. (`flexWrap` had also been swept INTO the gold button
          * itself, which let its icon and its label split onto separate lines —
          * that is what actually looked broken. Removed; a button is a leaf.)
          *
          * Below sm they are one per line at full width, which is the right
          * shape for a thumb anyway. At sm and up nothing changes.
          */}
        <div className="gsg-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          <button
            type="button"
            onClick={downloadTemplate}
            style={{
              padding: '9px 16px', minHeight: 'var(--fx-touch)', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: COLORS.gold, color: COLORS.white, fontSize: 12, fontWeight: 700,
              fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.goldHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.gold; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download the template
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={{
              padding: '9px 14px', minHeight: 'var(--fx-touch)', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${COLORS.border}`, background: COLORS.white,
              color: COLORS.charcoal, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)',
              whiteSpace: 'nowrap',
            }}
          >
            {open ? 'Hide the details' : 'What can it contain?'}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: '18px', background: COLORS.softBg }}>

          {/* ── The rules that cost the most when unknown ──── */}
          <SectionLabel>Before you build it</SectionLabel>
          {/* No inline `display`, `gap` or `gridTemplateColumns` — the class owns
              all three, and an inline copy of any of them would silently beat it
              (AGENTS.md's one rule). `--3` rather than `--2`: the dashboard
              content column is far narrower than the 1200px the `--2` preset is
              sized for, so `--2` would render these four small cards in a single
              column on almost every screen. */}
          <div className="fx-grid fx-grid--3 fx-grid--gap-sm" style={{ marginBottom: 22 }}>
            <Rule
              title="One row per invitation"
              body={`A family of four is a single row with ${SHEET_LIMITS.maxPartySize >= 4 ? '4' : '4'} in the "how many people" column — not four rows. Their names go in the meals column.`}
            />
            <Rule
              title="The first row is the headings"
              body="Use the names in the table below. Capitals and spaces are fine — “Guest Name” and “guest_name” both work. A heading we do not recognise is ignored, and we will tell you which one."
            />
            <Rule
              title="Nothing is overwritten"
              body="A guest whose email is already on your list is skipped, not updated. Tables must already exist on your chart — importing never creates them."
            />
            <Rule
              title={`Up to ${SHEET_LIMITS.maxRows} rows at a time`}
              body="Longer lists import in batches — split the file and upload it more than once. Both .csv and .xlsx work; .csv is the one that imports back exactly as it was exported."
            />
          </div>

          {/* ── Every column ───────────────────────────────── */}
          <SectionLabel>The one column you must have</SectionLabel>
          <ColumnTable columns={required} />

          <div style={{ height: 18 }} />

          <SectionLabel>
            Everything else is optional — your guests answer it on the invitation
          </SectionLabel>
          <ColumnTable columns={optional} />

          {/* ── Deliberately ignored ───────────────────────── */}
          <div style={{
            marginTop: 18, padding: '11px 13px', borderRadius: 9,
            background: COLORS.white, border: `1px solid ${COLORS.border}`,
          }}>
            <p style={{ margin: 0, fontSize: 11.5, color: COLORS.stone, lineHeight: 1.65 }}>
              <strong style={{ color: COLORS.charcoal }}>Never imported:</strong>{' '}
              {IGNORED_COLUMNS.map((c) => <Code key={c}>{c}</Code>).reduce((acc, el, i) => (
                i === 0 ? [el] : [...acc, ' ', el]
              ), [])}
              . A downloaded list carries the check-in columns, and putting them back does
              nothing on purpose — who arrived is recorded at the door and nowhere else, so
              a spreadsheet can never assert that somebody attended. They are listed here
              only so you are not warned about them when you re-upload your own export.
            </p>
          </div>

          {onOpenImport && (
            <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onOpenImport}
                style={{
                  padding: '9px 18px', minHeight: 'var(--fx-touch)', borderRadius: 8, border: `1px solid ${COLORS.gold}`,
                  background: COLORS.white, color: COLORS.gold, cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)',
                }}
              >
                Upload my file
              </button>
            </div>
          )}
        </div>
      )}

      {/* Plain style element, namespaced. A scoped block would not reach the
          table rendered by the nested ColumnTable function below — a documented
          silent failure mode in this build (see frontend/AGENTS.md). */}
      <style>{`
        @media (max-width: 639.98px) {
          /* One button per line, each filling the card. Two nowrap labels of
             ~197px and ~168px cannot share the ~252px this card has at 320px. */
          .gsg-actions { width: 100%; }
          .gsg-actions button { width: 100%; justify-content: center; }
        }
        @media (max-width: 767.98px) {
          /* The column reference is a genuine table: three columns of prose that
             cannot reflow into anything readable. It scrolls sideways inside its
             own box rather than pushing the page. */
          .gsg-table { min-width: 560px; }
        }
      `}</style>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 'var(--fx-micro)', fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase',
      color: COLORS.stone, marginBottom: 9, fontFamily: 'var(--font-sans)',
    }}>
      {children}
    </div>
  );
}

function Rule({ title, body }) {
  return (
    <div style={{
      background: COLORS.white, border: `1px solid ${COLORS.border}`,
      borderRadius: 9, padding: '11px 13px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.charcoal, marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: COLORS.stone, lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}

function Code({ children }) {
  return (
    <code style={{
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '0.92em', background: COLORS.ivory, color: COLORS.charcoal,
      padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap',
    }}>{children}</code>
  );
}

/**
 * The reference itself.
 *
 * A real <table>, because this is tabular: four facts about each of ten columns,
 * compared down the page. Its min-content width is the sum of its columns and
 * therefore unbounded, so it lives inside `.fx-scroll-x` — the repo's rule for
 * content that genuinely cannot reflow (AGENTS.md).
 */
function ColumnTable({ columns }) {
  const th = {
    padding: '8px 12px', textAlign: 'left', background: COLORS.ivory,
    fontSize: 'var(--fx-micro)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: COLORS.stone, borderBottom: `1px solid ${COLORS.border}`, whiteSpace: 'nowrap',
  };
  const td = {
    padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}`,
    fontSize: 11.5, color: COLORS.stone, lineHeight: 1.6, verticalAlign: 'top',
  };

  return (
    <div className="fx-scroll-x" style={{
      borderRadius: 9, border: `1px solid ${COLORS.border}`, background: COLORS.white,
    }}>
      <table className="gsg-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Heading</th>
            <th style={th}>What it is</th>
            <th style={th}>What to write</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((c, i) => {
            const last = i === columns.length - 1;
            const cell = last ? { ...td, borderBottom: 'none' } : td;
            return (
              <tr key={c.key}>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                  <Code>{c.key}</Code>
                  {c.required && (
                    <span style={{
                      display: 'block', marginTop: 5, fontSize: 'var(--fx-micro)',
                      fontWeight: 800, letterSpacing: '0.06em', color: COLORS.gold,
                    }}>REQUIRED</span>
                  )}
                  {/* The alternative spellings, because organizers will not use
                      ours — and one who can see that `rsvp` works will not
                      invent `attending`. */}
                  {c.aliases.length > 0 && (
                    <span style={{ display: 'block', marginTop: 5, fontSize: 'var(--fx-micro)', color: COLORS.stone }}>
                      or {c.aliases.map((a) => <Code key={a}>{a}</Code>).reduce((acc, el, n) => (
                        n === 0 ? [el] : [...acc, ' / ', el]
                      ), [])}
                    </span>
                  )}
                </td>
                <td style={cell}>
                  <span style={{ display: 'block', color: COLORS.charcoal, fontWeight: 700, fontSize: 12, marginBottom: 2 }}>
                    {c.label}
                  </span>
                  {c.what}
                </td>
                <td style={cell}>
                  {/* fx-break: an email or a long meal string has a min-content
                      width equal to its whole length, which is what pushes a
                      table sideways further than it needs to go. */}
                  <span className="fx-break" style={{ display: 'block', color: COLORS.charcoal }}>
                    {c.accepts}
                  </span>
                  {(c.example || []).filter(Boolean).length > 0 && (
                    <span className="fx-break" style={{
                      display: 'block', marginTop: 5, fontSize: 'var(--fx-micro)', color: COLORS.green,
                    }}>
                      e.g. {(c.example || []).filter(Boolean)[0]}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
