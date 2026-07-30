require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

const broadcasts = [];
injectModule('../../utils/realtime', {
  broadcast: async (eventId, event, payload) => { broadcasts.push({ eventId, event, payload }); },
});

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const guestService = require('../services/guestService');
const { undoCheckIn } = require('../controllers/checkinController');

const EVENT = 'evt-1';
const PARTY = 'party-1';

t.beforeEach(() => { mock.reset(); broadcasts.length = 0; });

// ══════════════════════════════════════════════════════════════════
// Legacy web-kiosk undo — finding R-1
// ══════════════════════════════════════════════════════════════════

test('undo without a reason is refused before any DB work', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(undoCheckIn,
    mockReq({ params: { eventId: EVENT }, body: { partyId: PARTY }, user: { id: 'u1' } }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'REASON_REQUIRED');
  assert.equal(mock.calls.length, 0);
});

test('undo with a whitespace-only reason is refused', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(undoCheckIn,
    mockReq({ params: { eventId: EVENT }, body: { partyId: PARTY, reason: '  ' }, user: { id: 'u1' } }));
  assert.equal(res.statusCode, 400);
  assert.equal(mock.calls.length, 0);
});

test('undo SOFT-deletes — it must never issue a DELETE against check_ins', async () => {
  const ops = [];
  mock.setResolver((s) => {
    if (s.table === 'check_ins') {
      ops.push(s.op);
      if (s.op === 'update') return { data: [{ id: 'ci-1', guest_id: 'g1' }] };
    }
    return {};
  });

  const { res } = await invoke(undoCheckIn, mockReq({
    params: { eventId: EVENT },
    body: { partyId: PARTY, reason: 'scanned the wrong guest' },
    user: { id: 'supervisor-1' },
  }));

  assert.equal(res.statusCode, 200);
  assert.ok(ops.includes('update'));
  // The whole point of R-1: arrival evidence is marked, never destroyed.
  assert.equal(ops.includes('delete'), false, 'a hard DELETE would erase arrival evidence');
});

test('undo records the actor and the reason on the row', async () => {
  let patch = null;
  mock.setResolver((s) => {
    if (s.table === 'check_ins' && s.op === 'update') {
      patch = s.payload;
      return { data: [{ id: 'ci-1', guest_id: 'g1' }] };
    }
    return {};
  });

  await invoke(undoCheckIn, mockReq({
    params: { eventId: EVENT },
    body: { partyId: PARTY, reason: 'checked in by mistake' },
    user: { id: 'supervisor-9' },
  }));

  assert.ok(patch.deleted_at);
  assert.equal(patch.deleted_by, 'supervisor-9');
  assert.equal(patch.undo_reason, 'checked in by mistake');
});

test('undo writes an audit row and tells the other devices', async () => {
  const audits = [];
  mock.setResolver((s) => {
    if (s.table === 'check_ins' && s.op === 'update') return { data: [{ id: 'ci-1' }, { id: 'ci-2' }] };
    if (s.table === 'activity_logs' && s.op === 'insert') { audits.push(s.payload); return {}; }
    return {};
  });

  const { res } = await invoke(undoCheckIn, mockReq({
    params: { eventId: EVENT },
    body: { partyId: PARTY, reason: 'duplicate scan' },
    user: { id: 'supervisor-1' },
  }));

  assert.equal(res.body.data.reversedCount, 2);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, 'checkin_undone');
  assert.equal(audits[0].actor_id, 'supervisor-1');
  assert.equal(audits[0].metadata.reason, 'duplicate scan');
  assert.equal(broadcasts[0].event, 'checkin_undone');
});

test('undoing a party with nothing live is 404', async () => {
  mock.setResolver((s) => {
    if (s.table === 'check_ins' && s.op === 'update') return { data: [] };
    return {};
  });
  const { res } = await invoke(undoCheckIn, mockReq({
    params: { eventId: EVENT }, body: { partyId: PARTY, reason: 'x' }, user: { id: 'u1' },
  }));
  assert.equal(res.statusCode, 404);
});

test('undoPartyCheckIn only touches rows that are still live', async () => {
  let filters = null;
  mock.setResolver((s) => {
    if (s.table === 'check_ins' && s.op === 'update') { filters = s.filters; return { data: [{ id: 'ci-1' }] }; }
    return {};
  });
  await guestService.undoPartyCheckIn(EVENT, PARTY, { actorId: 'u1', reason: 'r' });
  // Without the `is deleted_at null` guard, a repeated undo would overwrite the
  // original actor and reason with the second caller's.
  assert.deepEqual(filters.is, [['deleted_at', null]]);
});

// ══════════════════════════════════════════════════════════════════
// Check-in desk search — findings R-3 / A-12
// ══════════════════════════════════════════════════════════════════

const party = (id, label, guests, checkIns = []) => ({
  id, label, response: 'yes',
  guests: guests.map((n, i) => ({ id: `${id}-g${i}`, full_name: n, meal_selection: null, dietary_notes: null })),
  seating_assignments: [{ tables: { id: 't1', table_name: 'Table 4' } }],
  check_ins: checkIns,
});

/** Fast ILIKE pass returns `fast`; the fallback scan returns `all`. */
const searchResolver = (fast, all) => {
  let call = 0;
  return (s) => {
    if (s.table === 'rsvp_parties' && s.op === 'select') {
      call += 1;
      return { data: call === 1 ? fast : all };
    }
    return {};
  };
};

test('a companion is findable by their OWN name — the fast pass alone never could', async () => {
  mock.setResolver(searchResolver([], [party(PARTY, 'The Haddads', ['Rami Haddad', 'Layla Haddad'])]));
  const out = await guestService.searchGuestsForCheckin(EVENT, 'Layla');
  assert.equal(out.length, 1);
  assert.equal(out[0].guestName, 'The Haddads');
});

test('Arabic hamza and alef variants match — spec §8.5', async () => {
  mock.setResolver(searchResolver([], [party(PARTY, 'أحمد عبد الله', ['أحمد عبد الله'])]));
  const out = await guestService.searchGuestsForCheckin(EVENT, 'احمد');
  assert.equal(out.length, 1, 'searching احمد must find أحمد');
});

test('Arabic diacritics are ignored', async () => {
  mock.setResolver(searchResolver([], [party(PARTY, 'مُحَمَّد', ['مُحَمَّد'])]));
  const out = await guestService.searchGuestsForCheckin(EVENT, 'محمد');
  assert.equal(out.length, 1);
});

test('Latin accents and hyphens are ignored', async () => {
  mock.setResolver(searchResolver([], [party(PARTY, 'José Al-Masri', ['José Al-Masri'])]));
  assert.equal((await guestService.searchGuestsForCheckin(EVENT, 'jose')).length, 1);
  mock.reset();
  mock.setResolver(searchResolver([], [party(PARTY, 'José Al-Masri', ['José Al-Masri'])]));
  assert.equal((await guestService.searchGuestsForCheckin(EVENT, 'al masri')).length, 1);
});

test('the fallback scan is skipped when the fast pass already fills the limit', async () => {
  let calls = 0;
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties' && s.op === 'select') {
      calls += 1;
      return { data: Array.from({ length: 10 }, (_, i) => party(`p${i}`, `Alice ${i}`, [`Alice ${i}`])) };
    }
    return {};
  });
  await guestService.searchGuestsForCheckin(EVENT, 'Alice', 10);
  assert.equal(calls, 1, 'a satisfied fast pass must not trigger the scan');
});

test('the fast pass result is not duplicated by the fallback scan', async () => {
  const p = party(PARTY, 'Alice Smith', ['Alice Smith']);
  mock.setResolver(searchResolver([p], [p]));
  const out = await guestService.searchGuestsForCheckin(EVENT, 'Alice');
  assert.equal(out.length, 1, 'the same party must not appear twice');
});

test('an empty search term short-circuits without querying', async () => {
  mock.setResolver(() => ({}));
  assert.deepEqual(await guestService.searchGuestsForCheckin(EVENT, '   '), []);
  assert.equal(mock.calls.length, 0);
});

test('an undone check-in does not read as arrived', async () => {
  const p = party(PARTY, 'Alice Smith', ['Alice Smith'], [
    { id: 'ci-1', guest_id: `${PARTY}-g0`, checked_in_at: '2026-08-01T19:00:00Z', deleted_at: '2026-08-01T19:05:00Z' },
  ]);
  mock.setResolver(searchResolver([p], [p]));

  const out = await guestService.searchGuestsForCheckin(EVENT, 'Alice');
  assert.equal(out[0].isCheckedIn, false, 'a reversed admission must not show as arrived');
  assert.equal(out[0].checkedInCount, 0);
  assert.equal(out[0].checkedInAt, null);
});

test('a live check-in still reads as arrived', async () => {
  const p = party(PARTY, 'Alice Smith', ['Alice Smith'], [
    { id: 'ci-1', guest_id: `${PARTY}-g0`, checked_in_at: '2026-08-01T19:00:00Z', deleted_at: null },
  ]);
  mock.setResolver(searchResolver([p], [p]));

  const out = await guestService.searchGuestsForCheckin(EVENT, 'Alice');
  assert.equal(out[0].isCheckedIn, true);
  assert.equal(out[0].checkedInCount, 1);
  assert.equal(out[0].checkedInAt, '2026-08-01T19:00:00Z');
});

// ══════════════════════════════════════════════════════════════════
// checkInParty must ignore undone rows, or an undone guest can never
// be re-admitted
// ══════════════════════════════════════════════════════════════════

test('checkInParty excludes soft-deleted rows when deciding who is already in', async () => {
  let selectFilters = null;
  mock.setResolver((s) => {
    if (s.table === 'guests' && s.op === 'select') return { data: [{ id: 'g1', full_name: 'Alice' }] };
    if (s.table === 'check_ins' && s.op === 'select') { selectFilters = s.filters; return { data: [] }; }
    if (s.table === 'check_ins' && s.op === 'insert') return { data: [{ id: 'ci-2', checked_in_at: 'now' }] };
    return {};
  });

  const out = await guestService.checkInParty(EVENT, PARTY, { method: 'manual_search' });
  assert.equal(out.success, true);
  assert.deepEqual(selectFilters.is, [['deleted_at', null]],
    'without this a guest whose check-in was undone could never be re-admitted');
});
