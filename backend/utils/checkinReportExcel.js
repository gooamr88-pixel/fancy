/**
 * Post-event attendance report workbook (spec §9.7).
 *
 * Separate from utils/excelHelper.js on purpose. That file builds the
 * organizer's guest-list export and is shaped around pre-event data (meals,
 * seating capacity). This one is an ATTENDANCE record: who actually walked in,
 * when, admitted by whom, and — most importantly — everything that went wrong
 * while it was being recorded. Bolting attendance analytics onto the existing
 * export would have meant one sheet layout serving two unrelated questions.
 *
 * Every string that came from a guest, an organizer, or a staff member goes
 * through sanitizeCsvValue. A spreadsheet cell beginning `=` or `+` is a
 * formula, and this workbook is emailed to clients who open it in Excel.
 */
const ExcelJS = require('exceljs');
const { sanitizeCsvValue } = require('./csvHelper');
const { formatInZone, zoneAbbreviation } = require('./timezone');

const GOLD = 'FFB8944F';
const CHARCOAL = 'FF191B1E';
const AMBER = 'FFC8871B';
const RED = 'FFB03A2E';
const SAGE = 'FF4A7C59';

const styleHeader = (sheet, argb) => {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
};

const s = (v) => sanitizeCsvValue(v) || '';

/**
 * ISO → a local date-time string on the EVENT's clock, with the zone named.
 *
 * The docstring here used to say "in the reader's local time", and that was
 * never true. This file runs on the SERVER, so `toLocaleString()` with no zone
 * rendered every arrival in whatever timezone the VPS happens to be configured
 * for — a fact about the hosting provider, printed into a spreadsheet an
 * organizer opens to reconcile who walked through the door and when.
 *
 * Every timestamp in this report — arrivals, peak windows, conflict
 * resolutions — happened at one venue, so they all belong on that venue's
 * clock. Labelled, because a column of times that silently belongs to a
 * different zone than the reader assumes is worse than no times at all.
 */
const fmtIn = (iso, timeZone) => {
  const formatted = formatInZone(iso, timeZone, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  if (!formatted) return '';
  const abbr = zoneAbbreviation(iso, timeZone);
  return abbr ? `${formatted} ${abbr}` : formatted;
};

const fmtWindowIn = (w, timeZone) => (w
  ? `${fmtIn(w.startsAt, timeZone)} → ${fmtIn(w.endsAt, timeZone)} (${w.arrivals} arrivals)`
  : 'No arrivals recorded');

async function generateCheckinReport(report) {
  const { event, guests, conflicts, stats } = report;

  // Bound once here rather than threaded through ten call sites: every date in
  // this workbook is on the same clock, so passing the zone to each one would
  // be repetition that invites exactly one of them to be forgotten.
  const fmt = (iso) => fmtIn(iso, event?.timezone);
  const fmtWindow = (w) => fmtWindowIn(w, event?.timezone);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Fancy RSVP';
  wb.created = new Date();

  // ── 1. Summary ──
  const sum = wb.addWorksheet('Summary');
  sum.columns = [
    { header: 'Metric', key: 'metric', width: 34 },
    { header: 'Value', key: 'value', width: 46 },
  ];
  styleHeader(sum, CHARCOAL);

  const rows = [
    ['Event', s(event.title)],
    ['Date', fmt(event.eventDate)],
    ['Venue', s(event.venue)],
    ['Report generated', fmt(report.generatedAt)],
    ['', ''],
    ['Invited (people)', stats.totals.invited],
    ['Confirmed attending', stats.totals.confirmedYes],
    ['Arrived', stats.totals.arrived],
    ['No-shows', stats.totals.noShows],
    ['Attendance rate', `${stats.totals.attendanceRate}% of confirmed`],
    ['', ''],
    ['First arrival', fmt(stats.firstArrivalAt)],
    ['Last arrival', fmt(stats.lastArrivalAt)],
    ['Peak 15 minutes', fmtWindow(stats.peakWindow)],
    ['Peak hour', fmtWindow(stats.peakHour)],
  ];

  if (report.truncated) {
    rows.push(['', ''], ['⚠ Truncated', `Report capped at ${guests.length} guests — data may be incomplete.`]);
  }

  rows.forEach(([metric, value]) => sum.addRow({ metric, value }));

  // The anomaly block is on the FIRST sheet, not buried at the back. If two
  // devices double-admitted someone or a ticket failed verification, that is
  // the first thing the client needs to see — not a footnote after 400 rows.
  sum.addRow({ metric: '', value: '' });
  const anomalyHeader = sum.addRow({ metric: 'Issues requiring attention', value: '' });
  anomalyHeader.font = { bold: true };

  const a = stats.anomalies;
  const anomalyRows = [
    ['Reversed admissions', a.reversedAdmissions],
    ['Duplicate-admission conflicts', a.conflicts],
    ['  of which unresolved', a.unresolvedConflicts],
    ['Scans that failed verification', a.unverifiedScans],
    ['Device clock divergence > 5 min', a.clockSkewed],
  ];
  anomalyRows.forEach(([metric, value]) => {
    const row = sum.addRow({ metric, value });
    if (Number(value) > 0) {
      row.getCell('value').font = { bold: true, color: { argb: RED } };
    }
  });

  if (Object.values(a).every((v) => !v)) {
    sum.addRow({ metric: '', value: 'No issues detected — every arrival is clean and accounted for.' });
  }

  // ── 2. Attendance (the §9.7 required columns) ──
  const att = wb.addWorksheet('Attendance');
  att.columns = [
    { header: 'Guest Name', key: 'name', width: 26 },
    { header: 'Party', key: 'party', width: 24 },
    { header: 'Category', key: 'category', width: 12 },
    { header: 'RSVP', key: 'response', width: 10 },
    { header: 'Table', key: 'table', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Arrived At', key: 'arrived', width: 22 },
    { header: 'Method', key: 'method', width: 15 },
    { header: 'Admitted By', key: 'staff', width: 18 },
    { header: 'Device', key: 'device', width: 18 },
    { header: 'Ticket Verified', key: 'verified', width: 15 },
    { header: 'Meal', key: 'meal', width: 18 },
    { header: 'Dietary Notes', key: 'dietary', width: 24 },
    { header: 'Notes', key: 'notes', width: 28 },
  ];
  styleHeader(att, GOLD);

  const methodLabel = {
    qr_scan: 'QR scan',
    manual_search: 'Manual search',
    self_service: 'Self-service',
    group: 'Group check-in',
    override: 'Supervisor override',
  };

  for (const g of guests) {
    // Three states, not two. A reversed admission is neither an arrival nor a
    // no-show, and flattening it into either one misrepresents the night.
    const status = g.arrived ? 'Arrived' : (g.reversedAt ? 'Reversed' : (g.response === 'yes' ? 'No-show' : 'Not expected'));

    const row = att.addRow({
      name: s(g.fullName),
      party: s(g.partyLabel),
      category: s(g.category),
      response: s(g.response),
      table: s(g.tableName) || 'Unassigned',
      status,
      arrived: fmt(g.checkedInAt),
      method: g.method ? (methodLabel[g.method] || s(g.method)) : '',
      staff: s(g.staffName),
      device: s(g.deviceLabel),
      verified: g.tokenVerified === true ? 'Yes' : (g.tokenVerified === false ? 'FAILED' : ''),
      meal: s(g.mealSelection),
      dietary: s(g.dietaryNotes),
      // A reversal is the one action that removes someone from the attendance
      // record, so the report names who performed it alongside why.
      notes: s(g.reversedAt
        ? `Reversed by ${g.reversedBy || 'the organizer'}: ${g.reversedReason || 'no reason recorded'}`
        : g.partyNotes),
    });

    if (status === 'No-show') row.getCell('status').font = { color: { argb: AMBER } };
    if (status === 'Reversed') row.getCell('status').font = { color: { argb: RED } };
    if (g.tokenVerified === false) row.getCell('verified').font = { bold: true, color: { argb: RED } };
    if (g.category === 'vip') row.getCell('category').font = { bold: true, color: { argb: GOLD } };
  }

  // ── 3. No-shows ──
  const ns = wb.addWorksheet('No-Shows');
  ns.columns = [
    { header: 'Guest Name', key: 'name', width: 26 },
    { header: 'Party', key: 'party', width: 24 },
    { header: 'Table', key: 'table', width: 16 },
    { header: 'Category', key: 'category', width: 12 },
  ];
  styleHeader(ns, AMBER);
  if (stats.noShowList.length === 0) {
    ns.addRow({ name: 'Everyone who confirmed attended.' });
  } else {
    stats.noShowList.forEach((g) => ns.addRow({
      name: s(g.fullName), party: s(g.partyLabel),
      table: s(g.tableName) || 'Unassigned', category: s(g.category),
    }));
  }

  // ── 4. Arrival breakdown ──
  const br = wb.addWorksheet('Breakdown');
  br.columns = [
    { header: 'Grouping', key: 'grouping', width: 18 },
    { header: 'Value', key: 'value', width: 30 },
    { header: 'Arrivals', key: 'count', width: 12 },
  ];
  styleHeader(br, SAGE);

  const addGroup = (label, entries, extra) => {
    if (!entries || entries.length === 0) return;
    entries.forEach((e) => br.addRow({
      grouping: label,
      value: s(e.key),
      count: extra ? `${e.arrived} of ${e.count}` : e.count,
    }));
  };
  addGroup('Category', stats.byCategory, true);
  addGroup('Method', stats.byMethod);
  addGroup('Staff member', stats.byStaff);
  addGroup('Device', stats.byDevice);
  addGroup('Table', stats.byTable);

  // ── 5. Conflicts (§5.3 Layer 4) ──
  const cf = wb.addWorksheet('Conflicts');
  cf.columns = [
    { header: 'Guest', key: 'guest', width: 26 },
    { header: 'Admitted By (kept)', key: 'wstaff', width: 20 },
    { header: 'Device (kept)', key: 'wdevice', width: 18 },
    { header: 'Time (kept)', key: 'wtime', width: 22 },
    { header: 'Also Admitted By', key: 'rstaff', width: 20 },
    { header: 'Device', key: 'rdevice', width: 18 },
    { header: 'Time', key: 'rtime', width: 22 },
    { header: 'Resolved', key: 'resolved', width: 22 },
  ];
  styleHeader(cf, RED);

  if (conflicts.length === 0) {
    cf.addRow({ guest: 'No duplicate admissions occurred.' });
  } else {
    const nameOf = new Map(guests.map((g) => [g.guestId, g.fullName]));
    conflicts.forEach((c) => cf.addRow({
      guest: s(nameOf.get(c.guestId) || c.guestId),
      wstaff: s(c.winningStaff), wdevice: s(c.winningDevice), wtime: fmt(c.winningAt),
      rstaff: s(c.rejectedStaff), rdevice: s(c.rejectedDevice), rtime: fmt(c.rejectedAt),
      resolved: c.resolvedAt ? fmt(c.resolvedAt) : 'UNRESOLVED',
    }));
  }

  return wb.xlsx.writeBuffer();
}

module.exports = { generateCheckinReport };
