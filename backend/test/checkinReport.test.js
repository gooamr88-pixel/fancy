require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });
injectModule('../../utils/realtime', { broadcast: async () => {} });

const svc = require('../services/checkinReportService');
const { generateCheckinReport } = require('../utils/checkinReportExcel');
const ctrl = require('../controllers/checkinSyncController');

const EVENT = '11111111-1111-4111-8111-111111111111';

t.beforeEach(() => mock.reset());

/** Minimal shaped guest, as gatherReportData produces. */
const guest = (over = {}) => ({
  guestId: over.guestId || `g-${Math.random().toString(36).slice(2, 8)}`,
  partyId: 'p1', partyLabel: 'The Haddads', fullName: 'Alice',
  isPrimaryContact: true, response: 'yes', category: 'standard',
  tableName: 'Table 4', mealSelection: null, dietaryNotes: null,
  partyNotes: null, side: null,
  arrived: false, checkedInAt: null, serverReceivedAt: null,
  method: null, staffName: null, deviceLabel: null, tokenVerified: null,
  reversedAt: null, reversedReason: null,
  ...over,
});

const arrivedAt = (iso, over = {}) => guest({
  arrived: true, checkedInAt: iso, serverReceivedAt: iso,
  method: 'qr_scan', staffName: 'Amina', deviceLabel: 'Main entrance',
  tokenVerified: true, ...over,
});

// ══════════════════════════════════════════════════════════════════
// Peak arrival window (§9.7)
// ══════════════════════════════════════════════════════════════════

test('the busiest 15-minute window is identified', () => {
  const w = svc.peakArrivalWindow([
    '2026-08-01T19:00:00Z', '2026-08-01T19:01:00Z',
    '2026-08-01T19:31:00Z', '2026-08-01T19:32:00Z',
    '2026-08-01T19:33:00Z', '2026-08-01T19:34:00Z',
  ], 15);
  assert.equal(w.arrivals, 4);
  assert.equal(new Date(w.startsAt).toISOString(), '2026-08-01T19:30:00.000Z');
});

test('no arrivals yields null rather than a fabricated window', () => {
  assert.equal(svc.peakArrivalWindow([]), null);
  assert.equal(svc.peakArrivalWindow(null), null);
});

test('ties resolve to the earliest window — the first rush is the one that mattered', () => {
  const w = svc.peakArrivalWindow([
    '2026-08-01T19:00:00Z', '2026-08-01T19:05:00Z',
    '2026-08-01T20:00:00Z', '2026-08-01T20:05:00Z',
  ], 15);
  assert.equal(w.arrivals, 2);
  assert.equal(new Date(w.startsAt).toISOString(), '2026-08-01T19:00:00.000Z');
});

test('unparseable timestamps are skipped, not counted as epoch zero', () => {
  const w = svc.peakArrivalWindow(['not-a-date', '2026-08-01T19:00:00Z'], 15);
  assert.equal(w.arrivals, 1);
  assert.equal(new Date(w.startsAt).getUTCFullYear(), 2026);
});

test('an all-invalid list yields null', () => {
  assert.equal(svc.peakArrivalWindow(['x', 'y']), null);
});

test('the hourly window aggregates what the 15-minute one splits', () => {
  const times = ['2026-08-01T19:05:00Z', '2026-08-01T19:20:00Z', '2026-08-01T19:50:00Z'];
  assert.equal(svc.peakArrivalWindow(times, 15).arrivals, 1);
  assert.equal(svc.peakArrivalWindow(times, 60).arrivals, 3);
});

// ══════════════════════════════════════════════════════════════════
// Totals and the no-show definition
// ══════════════════════════════════════════════════════════════════

test('a declined guest is NOT a no-show', () => {
  const stats = svc.computeReportStats([
    arrivedAt('2026-08-01T19:00:00Z'),
    guest({ response: 'no', fullName: 'Declined Dave' }),
    guest({ response: 'yes', fullName: 'Absent Amy' }),
  ]);
  assert.equal(stats.totals.noShows, 1, 'only the confirmed-yes absentee counts');
  assert.equal(stats.noShowList[0].fullName, 'Absent Amy');
});

test('a pending guest is not a no-show either', () => {
  const stats = svc.computeReportStats([guest({ response: 'pending' })]);
  assert.equal(stats.totals.noShows, 0);
});

test('attendance rate is measured against CONFIRMED guests, not everyone invited', () => {
  const stats = svc.computeReportStats([
    arrivedAt('2026-08-01T19:00:00Z'),
    guest({ response: 'yes' }),
    guest({ response: 'no' }), guest({ response: 'no' }), guest({ response: 'no' }),
  ]);
  // 1 of 2 confirmed = 50%. Against all 5 invited it would read 20% and make a
  // well-attended event look like a failure.
  assert.equal(stats.totals.attendanceRate, 50);
  assert.equal(stats.totals.invited, 5);
  assert.equal(stats.totals.confirmedYes, 2);
});

test('an event with no confirmed guests reports 0% rather than dividing by zero', () => {
  const stats = svc.computeReportStats([guest({ response: 'no' })]);
  assert.equal(stats.totals.attendanceRate, 0);
});

test('a reversed admission is neither an arrival nor a no-show', () => {
  const stats = svc.computeReportStats([
    guest({ response: 'yes', arrived: false, reversedAt: '2026-08-01T19:10:00Z', reversedReason: 'wrong guest' }),
  ]);
  assert.equal(stats.totals.arrived, 0);
  assert.equal(stats.totals.noShows, 0, 'a reversal is not an absence');
  assert.equal(stats.totals.reversed, 1);
  assert.equal(stats.anomalies.reversedAdmissions, 1);
});

test('first and last arrival bracket the night', () => {
  const stats = svc.computeReportStats([
    arrivedAt('2026-08-01T20:30:00Z'),
    arrivedAt('2026-08-01T19:00:00Z'),
    arrivedAt('2026-08-01T19:45:00Z'),
  ]);
  assert.equal(stats.firstArrivalAt, '2026-08-01T19:00:00Z');
  assert.equal(stats.lastArrivalAt, '2026-08-01T20:30:00Z');
});

// ══════════════════════════════════════════════════════════════════
// Anomalies — the report is the only place these become visible
// ══════════════════════════════════════════════════════════════════

test('a scan that failed verification is flagged', () => {
  const stats = svc.computeReportStats([
    arrivedAt('2026-08-01T19:00:00Z', { tokenVerified: false }),
    arrivedAt('2026-08-01T19:01:00Z', { tokenVerified: true }),
  ]);
  assert.equal(stats.anomalies.unverifiedScans, 1);
});

test('a manual check-in with no token is NOT flagged as unverified', () => {
  const stats = svc.computeReportStats([
    arrivedAt('2026-08-01T19:00:00Z', { method: 'manual_search', tokenVerified: null }),
  ]);
  // null means "no ticket presented", which is normal. Only an explicit false
  // is an anomaly — conflating them would flag every manual arrival.
  assert.equal(stats.anomalies.unverifiedScans, 0);
});

test('significant device clock divergence is flagged', () => {
  const stats = svc.computeReportStats([
    arrivedAt('2026-08-01T19:00:00Z', { serverReceivedAt: '2026-08-01T19:00:30Z' }), // 30s drift, fine
    arrivedAt('2026-08-01T19:00:00Z', { serverReceivedAt: '2026-08-01T20:00:00Z' }), // 1h, not fine
  ]);
  assert.equal(stats.anomalies.clockSkewed, 1);
});

test('divergence is absolute — a device running FAST is flagged too', () => {
  const stats = svc.computeReportStats([
    arrivedAt('2027-01-01T00:00:00Z', { serverReceivedAt: '2026-08-01T19:00:00Z' }),
  ]);
  assert.equal(stats.anomalies.clockSkewed, 1);
});

test('conflicts are counted, and unresolved ones separately', () => {
  const stats = svc.computeReportStats([arrivedAt('2026-08-01T19:00:00Z')], [
    { id: 'c1', guestId: 'g1', resolvedAt: null },
    { id: 'c2', guestId: 'g2', resolvedAt: '2026-08-02T10:00:00Z' },
  ]);
  assert.equal(stats.anomalies.conflicts, 2);
  assert.equal(stats.anomalies.unresolvedConflicts, 1);
});

// ══════════════════════════════════════════════════════════════════
// Breakdowns
// ══════════════════════════════════════════════════════════════════

test('category breakdown reports arrived-of-total, not just totals', () => {
  const stats = svc.computeReportStats([
    arrivedAt('2026-08-01T19:00:00Z', { category: 'vip' }),
    guest({ category: 'vip', response: 'yes' }),
    arrivedAt('2026-08-01T19:05:00Z', { category: 'standard' }),
  ]);
  const vip = stats.byCategory.find((c) => c.key === 'vip');
  assert.equal(vip.count, 2);
  assert.equal(vip.arrived, 1);
});

test('staff and device breakdowns count only arrivals', () => {
  const stats = svc.computeReportStats([
    arrivedAt('2026-08-01T19:00:00Z', { staffName: 'Amina', deviceLabel: 'Main' }),
    arrivedAt('2026-08-01T19:01:00Z', { staffName: 'Amina', deviceLabel: 'Main' }),
    arrivedAt('2026-08-01T19:02:00Z', { staffName: 'Karim', deviceLabel: 'Garden' }),
    guest({ response: 'yes' }),
  ]);
  assert.deepEqual(stats.byStaff, [{ key: 'Amina', count: 2 }, { key: 'Karim', count: 1 }]);
  assert.equal(stats.byDevice.length, 2);
});

test('tally skips blank keys instead of inventing an empty bucket', () => {
  assert.deepEqual(svc.tally([{ k: 'a' }, { k: null }, { k: '' }], (r) => r.k), [{ key: 'a', count: 1 }]);
});

test('tally orders by descending count then alphabetically for stable output', () => {
  const out = svc.tally(
    [{ k: 'b' }, { k: 'a' }, { k: 'c' }, { k: 'c' }],
    (r) => r.k,
  );
  assert.deepEqual(out, [{ key: 'c', count: 2 }, { key: 'a', count: 1 }, { key: 'b', count: 1 }]);
});

test('an empty event produces a coherent zeroed report rather than throwing', () => {
  const stats = svc.computeReportStats([], []);
  assert.equal(stats.totals.invited, 0);
  assert.equal(stats.totals.attendanceRate, 0);
  assert.equal(stats.peakWindow, null);
  assert.deepEqual(stats.noShowList, []);
});

// ══════════════════════════════════════════════════════════════════
// Workbook generation
// ══════════════════════════════════════════════════════════════════

const sampleReport = () => {
  const guests = [
    arrivedAt('2026-08-01T19:00:00Z', { fullName: 'Alice', category: 'vip' }),
    arrivedAt('2026-08-01T19:05:00Z', { fullName: 'Bob', tokenVerified: false }),
    guest({ fullName: 'Absent Amy', response: 'yes' }),
    guest({ fullName: 'Reversed Rick', response: 'yes', reversedAt: '2026-08-01T19:20:00Z', reversedReason: 'mis-scan' }),
  ];
  const conflicts = [{ id: 'c1', guestId: guests[0].guestId, winningStaff: 'Amina', rejectedStaff: 'Karim', resolvedAt: null }];
  return {
    event: { id: EVENT, title: 'Nadia & Omar', eventDate: '2026-08-01T18:00:00Z', venue: 'Grand Hall' },
    guests, conflicts, stats: svc.computeReportStats(guests, conflicts),
    truncated: false, generatedAt: '2026-08-02T09:00:00Z',
  };
};

test('the workbook builds and contains all five sheets', async () => {
  const buf = await generateCheckinReport(sampleReport());
  assert.ok(Buffer.from(buf).length > 3000, 'workbook should be non-trivial');

  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(buf));
  assert.deepEqual(
    wb.worksheets.map((w) => w.name),
    ['Summary', 'Attendance', 'No-Shows', 'Breakdown', 'Conflicts'],
  );
});

test('the attendance sheet distinguishes all four statuses', async () => {
  const buf = await generateCheckinReport(sampleReport());
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(buf));

  const statuses = [];
  wb.getWorksheet('Attendance').eachRow((row, i) => {
    if (i > 1) statuses.push(row.getCell(6).value);
  });
  assert.deepEqual(statuses.sort(), ['Arrived', 'Arrived', 'No-show', 'Reversed']);
});

test('a formula-injection attempt in a guest name is neutralised', async () => {
  const guests = [arrivedAt('2026-08-01T19:00:00Z', { fullName: '=cmd|calc!A1' })];
  const buf = await generateCheckinReport({
    event: { id: EVENT, title: 'X', eventDate: '2026-08-01T18:00:00Z', venue: null },
    guests, conflicts: [], stats: svc.computeReportStats(guests, []),
    truncated: false, generatedAt: '2026-08-02T09:00:00Z',
  });

  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(buf));
  const name = String(wb.getWorksheet('Attendance').getRow(2).getCell(1).value);
  // This workbook is emailed to clients who open it in Excel; a leading = would
  // be evaluated as a formula.
  assert.ok(!name.startsWith('='), `name cell must not start with = (got ${name})`);
});

test('a clean event says so explicitly instead of leaving blank sheets', async () => {
  const guests = [arrivedAt('2026-08-01T19:00:00Z')];
  const buf = await generateCheckinReport({
    event: { id: EVENT, title: 'Clean', eventDate: '2026-08-01T18:00:00Z', venue: null },
    guests, conflicts: [], stats: svc.computeReportStats(guests, []),
    truncated: false, generatedAt: '2026-08-02T09:00:00Z',
  });

  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(buf));
  const conflictText = String(wb.getWorksheet('Conflicts').getRow(2).getCell(1).value || '');
  const noShowText = String(wb.getWorksheet('No-Shows').getRow(2).getCell(1).value || '');
  assert.match(conflictText, /No duplicate admissions/);
  assert.match(noShowText, /Everyone who confirmed attended/);
});

// ══════════════════════════════════════════════════════════════════
// Endpoint
// ══════════════════════════════════════════════════════════════════

test('PDF is refused with 501, not silently served as something else', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(ctrl.getReport,
    mockReq({ params: { eventId: EVENT }, query: { format: 'pdf' }, user: { id: 'u1' } }));
  assert.equal(res.statusCode, 501);
  assert.equal(res.body.error, 'FORMAT_NOT_IMPLEMENTED');
});

test('an unknown format is rejected', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(ctrl.getReport,
    mockReq({ params: { eventId: EVENT }, query: { format: 'csv' }, user: { id: 'u1' } }));
  assert.equal(res.statusCode, 400);
});

test('json format returns the same computed stats the workbook uses', async () => {
  mock.setResolver((s) => {
    if (s.table === 'events') return { data: { id: EVENT, title: 'Nadia & Omar', event_date: '2026-08-01T18:00:00Z' } };
    if (s.table === 'guests' && s.op === 'select') {
      return { data: [{
        id: 'g1', party_id: 'p1', full_name: 'Alice', category: 'vip', is_primary_contact: true,
        rsvp_parties: { id: 'p1', label: 'Alice', response: 'yes', seating_assignments: [{ tables: { table_name: 'Table 4', element_type: 'table' } }] },
        check_ins: [{ id: 'ci1', checked_in_at: '2026-08-01T19:00:00Z', server_received_at: '2026-08-01T19:00:02Z', method: 'qr_scan', staff_display_name: 'Amina', device_label: 'Main', token_verified: true, deleted_at: null }],
      }] };
    }
    if (s.table === 'event_check_in_conflicts') return { data: [] };
    return {};
  });

  const { res } = await invoke(ctrl.getReport,
    mockReq({ params: { eventId: EVENT }, query: { format: 'json' }, user: { id: 'u1' } }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.stats.totals.arrived, 1);
  assert.equal(res.body.data.stats.totals.attendanceRate, 100);
  assert.equal(res.body.data.guests[0].tableName, 'Table 4');
});

test('an unknown event is 404', async () => {
  mock.setResolver((s) => {
    if (s.table === 'events') return { data: null, error: { code: 'PGRST116' } };
    return {};
  });
  const { res } = await invoke(ctrl.getReport,
    mockReq({ params: { eventId: EVENT }, query: {}, user: { id: 'u1' } }));
  assert.equal(res.statusCode, 404);
});

test('xlsx is served with download headers and no caching', async () => {
  mock.setResolver((s) => {
    if (s.table === 'events') return { data: { id: EVENT, title: 'Nadia & Omar', event_date: '2026-08-01T18:00:00Z' } };
    if (s.table === 'guests' && s.op === 'select') return { data: [] };
    if (s.table === 'event_check_in_conflicts') return { data: [] };
    return {};
  });

  const { res } = await invoke(ctrl.getReport,
    mockReq({ params: { eventId: EVENT }, query: {}, user: { id: 'u1' } }));
  assert.match(res.headers['Content-Type'], /spreadsheetml/);
  // "&" is outside the filename allowlist, so it is dropped and the resulting
  // whitespace run collapses to one space.
  assert.equal(res.headers['Content-Disposition'], 'attachment; filename="checkin-report-Nadia Omar.xlsx"');
  // An attendance record of a private event must not sit in a shared cache.
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('a hostile event title cannot escape the download filename', async () => {
  mock.setResolver((s) => {
    if (s.table === 'events') return { data: { id: EVENT, title: 'evil"; rm -rf /\r\nX:', event_date: '2026-08-01T18:00:00Z' } };
    if (s.table === 'guests' && s.op === 'select') return { data: [] };
    if (s.table === 'event_check_in_conflicts') return { data: [] };
    return {};
  });

  const { res } = await invoke(ctrl.getReport,
    mockReq({ params: { eventId: EVENT }, query: {}, user: { id: 'u1' } }));
  const cd = res.headers['Content-Disposition'];
  assert.ok(!cd.includes('"; rm'), 'quotes and shell text must be stripped');
  assert.ok(!/[\r\n]/.test(cd), 'a header must not contain CRLF');
});
