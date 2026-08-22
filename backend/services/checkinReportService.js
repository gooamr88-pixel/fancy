/**
 * Post-event attendance report (spec §9.7).
 *
 * "Server-generated export containing every invited guest, arrival status,
 * arrival time, party grouping, table, category, operator, and method, plus
 * summary statistics including peak arrival period and a no-show list."
 *
 * Two halves, deliberately separated:
 *   • gatherReportData() talks to the database.
 *   • computeReportStats() is PURE — it takes shaped rows and returns numbers.
 *
 * The split exists so the statistics (peak arrival window, no-show counts,
 * clock divergence) are unit-testable without a database. Those are the parts
 * a client will read closely and the parts most likely to be quietly wrong.
 *
 * Three things this report must surface that a naive attendance dump would
 * silently swallow:
 *   • REVERSED admissions — an undone check-in is not an arrival, but it is
 *     also not a no-show, and conflating either way misleads.
 *   • CONFLICTS — two offline devices admitting the same guest (§5.3 Layer 4).
 *   • ANOMALIES — a scanned ticket that failed server-side verification
 *     (amendment A-11). Since decision D-20 removed on-device verification,
 *     this report is the ONLY place a forged scan ever becomes visible.
 */
const { supabase } = require('../config/supabase');
const { formatCompanionMealCounts } = require('./guestService');

/** Guests fetched per page while assembling the report. */
const REPORT_PAGE = 1000;
/** Hard ceiling, mirroring exportParties' existing cap. */
const REPORT_MAX_GUESTS = 20000;

/**
 * Buckets arrivals into fixed windows and returns the busiest one.
 *
 * §9.7 asks for a "peak arrival period". A rolling maximum would be more
 * precise but is harder to state plainly in a report; a fixed 15-minute grid is
 * what a venue actually plans staffing around, so that is what is reported.
 */
function peakArrivalWindow(timestamps, windowMinutes = 15) {
  if (!timestamps || timestamps.length === 0) return null;

  const windowMs = windowMinutes * 60 * 1000;
  const buckets = new Map();

  for (const ts of timestamps) {
    const ms = new Date(ts).getTime();
    if (!Number.isFinite(ms)) continue;
    const key = Math.floor(ms / windowMs) * windowMs;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  if (buckets.size === 0) return null;

  let bestKey = null;
  let bestCount = -1;
  // Ascending so ties resolve to the EARLIEST window — the first rush is the
  // one that needed the staffing, and a later tie is not more interesting.
  for (const key of [...buckets.keys()].sort((a, b) => a - b)) {
    const count = buckets.get(key);
    if (count > bestCount) { bestCount = count; bestKey = key; }
  }

  return {
    startsAt: new Date(bestKey).toISOString(),
    endsAt: new Date(bestKey + windowMs).toISOString(),
    windowMinutes,
    arrivals: bestCount,
  };
}

/** Counts by an arbitrary key, returned sorted by descending count. */
function tally(rows, keyFn) {
  const counts = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (k === null || k === undefined || k === '') continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
}

/**
 * Significant divergence between a device's clock and the server's.
 *
 * §10 requires both times be recorded and the report show where they diverge
 * significantly. Five minutes is the threshold: below that it is clock drift
 * and noise, above it the arrival timeline is misleading and someone should
 * know before they reconcile a dispute from it.
 */
const CLOCK_SKEW_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Computes every figure in the report from shaped rows. Pure.
 *
 * @param {Array} guests  one entry per invited person (see gatherReportData)
 * @param {Array} conflicts
 */
function computeReportStats(guests, conflicts = []) {
  const arrived = guests.filter((g) => g.arrived);
  const reversed = guests.filter((g) => !g.arrived && g.reversedAt);
  // A no-show is someone who said YES and never arrived. Someone who declined
  // is not a no-show, and counting them as one would make every event look
  // catastrophic.
  const noShows = guests.filter((g) => !g.arrived && !g.reversedAt && g.response === 'yes');

  const arrivalTimes = arrived.map((g) => g.checkedInAt).filter(Boolean);
  const sorted = [...arrivalTimes].sort();

  const skewed = arrived.filter((g) => {
    if (!g.checkedInAt || !g.serverReceivedAt) return false;
    return Math.abs(new Date(g.checkedInAt).getTime() - new Date(g.serverReceivedAt).getTime())
      > CLOCK_SKEW_THRESHOLD_MS;
  });

  const invitedYes = guests.filter((g) => g.response === 'yes').length;

  return {
    totals: {
      invited: guests.length,
      confirmedYes: invitedYes,
      arrived: arrived.length,
      noShows: noShows.length,
      reversed: reversed.length,
      // Denominator is confirmed-yes, not everyone invited: a declined guest
      // never intended to come, so including them understates turnout.
      attendanceRate: invitedYes ? Math.round((arrived.length / invitedYes) * 1000) / 10 : 0,
    },
    firstArrivalAt: sorted[0] || null,
    lastArrivalAt: sorted[sorted.length - 1] || null,
    peakWindow: peakArrivalWindow(arrivalTimes, 15),
    peakHour: peakArrivalWindow(arrivalTimes, 60),
    byCategory: tally(guests, (g) => g.category || 'standard').map((row) => ({
      ...row,
      arrived: arrived.filter((g) => (g.category || 'standard') === row.key).length,
    })),
    byMethod: tally(arrived, (g) => g.method),
    byStaff: tally(arrived, (g) => g.staffName),
    byDevice: tally(arrived, (g) => g.deviceLabel),
    byTable: tally(arrived, (g) => g.tableName),
    anomalies: {
      // Explicitly false, not falsy: null means "no token presented", which is
      // normal for manual/group/override and must not be flagged.
      unverifiedScans: arrived.filter((g) => g.tokenVerified === false).length,
      conflicts: conflicts.length,
      unresolvedConflicts: conflicts.filter((c) => !c.resolvedAt).length,
      clockSkewed: skewed.length,
      reversedAdmissions: reversed.length,
    },
    noShowList: noShows.map((g) => ({
      fullName: g.fullName, partyLabel: g.partyLabel,
      tableName: g.tableName, category: g.category,
    })),
  };
}

/**
 * Loads every invited person plus their arrival state.
 *
 * Paginated because a report is generated once and must not fall over on a
 * large event, and because Supabase caps a single range read.
 */
async function gatherReportData(eventId) {
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('id, title, event_date, timezone, location_name, location_address')
    .eq('id', eventId)
    .single();
  if (eventErr || !event) {
    const err = new Error('EVENT_NOT_FOUND');
    err.code = 'EVENT_NOT_FOUND';
    throw err;
  }

  const guests = [];
  for (let page = 0; page * REPORT_PAGE < REPORT_MAX_GUESTS; page += 1) {
    const from = page * REPORT_PAGE;
    const { data, error } = await supabase
      .from('guests')
      .select(`
        id, party_id, full_name, category, meal_selection, dietary_notes, is_primary_contact,
        rsvp_parties!inner(id, label, response, notes, side, companion_meal_counts,
                           seating_assignments(tables(table_name, element_type))),
        check_ins(id, checked_in_at, server_received_at, method, staff_display_name,
                  device_label, token_verified, deleted_at, undo_reason,
                  undone_by_staff_name)
      `)
      .eq('event_id', eventId)
      .order('id', { ascending: true })
      .range(from, from + REPORT_PAGE - 1);
    if (error) throw error;

    const rows = data || [];
    guests.push(...rows);
    if (rows.length < REPORT_PAGE) break;
  }

  const { data: conflictRows, error: conflictErr } = await supabase
    .from('event_check_in_conflicts')
    .select('id, guest_id, winning_staff_display_name, winning_device_label, winning_checked_in_at, rejected_staff_display_name, rejected_device_label, rejected_checked_in_at, rejected_at, resolved_at')
    .eq('event_id', eventId);
  if (conflictErr) throw conflictErr;

  const shaped = guests.map((g) => {
    const party = g.rsvp_parties || {};
    const sa = Array.isArray(party.seating_assignments) ? party.seating_assignments[0] : party.seating_assignments;
    const tbl = sa?.tables;
    const all = g.check_ins || [];
    const live = all.find((c) => !c.deleted_at) || null;
    const undone = all.find((c) => c.deleted_at) || null;

    return {
      guestId: g.id,
      partyId: g.party_id,
      partyLabel: party.label || null,
      fullName: g.full_name,
      isPrimaryContact: !!g.is_primary_contact,
      response: party.response || 'pending',
      category: g.category || 'standard',
      // Only element_type='table' is a seat; the same table holds stages, bars
      // and dance floors, and reporting one as a guest's table is nonsense.
      tableName: tbl && tbl.element_type === 'table' ? tbl.table_name : null,
      mealSelection: g.meal_selection || null,
      dietaryNotes: g.dietary_notes || null,
      partyNotes: party.notes || null,
      side: party.side || null,
      // See checkinSyncService: a companion has no meal of their own, the party
      // carries a tally. Without this the report shows a party of four with one
      // meal and three blanks.
      partyMealSummary: formatCompanionMealCounts(party.companion_meal_counts) || null,
      arrived: !!live,
      checkedInAt: live?.checked_in_at || null,
      serverReceivedAt: live?.server_received_at || null,
      method: live?.method || null,
      staffName: live?.staff_display_name || null,
      deviceLabel: live?.device_label || null,
      tokenVerified: live ? live.token_verified : null,
      reversedAt: undone?.deleted_at || null,
      reversedReason: undone?.undo_reason || null,
      reversedBy: undone?.undone_by_staff_name || null,
    };
  });

  const conflicts = (conflictRows || []).map((c) => ({
    id: c.id,
    guestId: c.guest_id,
    winningStaff: c.winning_staff_display_name,
    winningDevice: c.winning_device_label,
    winningAt: c.winning_checked_in_at,
    rejectedStaff: c.rejected_staff_display_name,
    rejectedDevice: c.rejected_device_label,
    rejectedAt: c.rejected_checked_in_at || c.rejected_at,
    resolvedAt: c.resolved_at,
  }));

  return {
    event: {
      id: event.id,
      title: event.title,
      eventDate: event.event_date,
      timezone: event.timezone || null,
      venue: event.location_name || null,
      venueAddress: event.location_address || null,
    },
    guests: shaped,
    conflicts,
    stats: computeReportStats(shaped, conflicts),
    truncated: guests.length >= REPORT_MAX_GUESTS,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  REPORT_PAGE,
  REPORT_MAX_GUESTS,
  CLOCK_SKEW_THRESHOLD_MS,
  peakArrivalWindow,
  tally,
  computeReportStats,
  gatherReportData,
};
