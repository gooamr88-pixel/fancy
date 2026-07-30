require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');
const { injectModule } = require('./helpers/inject');

injectModule('../../utils/realtime', { broadcast: async () => {} });
const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const svc = require('../services/checkinSyncService');
const ctrl = require('../controllers/checkinSyncController');
const guestService = require('../services/guestService');
const { updateRSVP } = require('../controllers/rsvpController');

const EVENT = '11111111-1111-4111-8111-111111111111';
const PARTY = '33333333-3333-4333-8333-333333333333';
const CONFLICT = '66666666-6666-4666-8666-666666666666';

t.beforeEach(() => mock.reset());

// ══════════════════════════════════════════════════════════════════
// Conflicts (amendment A-16 item 5, spec §5.3 Layer 4)
// ══════════════════════════════════════════════════════════════════

test('unresolved conflicts are returned by default', async () => {
  let filters = null;
  mock.setResolver((s) => {
    if (s.table === 'event_check_in_conflicts' && s.op === 'select') {
      filters = s.filters;
      return {
        data: [{
          id: CONFLICT, guest_id: 'g1',
          winning_staff_display_name: 'Amina', winning_device_label: 'Main entrance',
          winning_checked_in_at: '2026-08-01T19:00:00Z',
          rejected_client_checkin_id: 'c-2', rejected_checked_in_at: '2026-08-01T19:06:00Z',
          rejected_staff_display_name: 'Karim', rejected_device_label: 'Garden gate',
          rejected_at: '2026-08-01T19:06:00Z', resolved_at: null,
          guests: { full_name: 'Alice', party_id: PARTY, rsvp_parties: { label: 'The Haddads' } },
        }],
      };
    }
    return {};
  });

  const out = await svc.listConflicts(EVENT);
  assert.equal(out.length, 1);
  assert.equal(out[0].guestName, 'Alice');
  assert.equal(out[0].partyLabel, 'The Haddads');
  // Both sides, which is what §5.3 L4 requires to settle what happened.
  assert.equal(out[0].kept.staffName, 'Amina');
  assert.equal(out[0].kept.gate, 'Main entrance');
  assert.equal(out[0].rejected.staffName, 'Karim');
  assert.equal(out[0].rejected.gate, 'Garden gate');
  assert.deepEqual(filters.is, [['resolved_at', null]]);
});

test('includeResolved drops the unresolved filter', async () => {
  let filters = null;
  mock.setResolver((s) => {
    if (s.table === 'event_check_in_conflicts') { filters = s.filters; return { data: [] }; }
    return {};
  });

  await svc.listConflicts(EVENT, { includeResolved: true });
  assert.equal(filters.is, undefined);
});

test('a guest name is joined, not stored, so a rename stays correct', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_check_in_conflicts') {
      return { data: [{ id: CONFLICT, guest_id: 'g1', guests: null, rejected_at: '2026-08-01T19:00:00Z' }] };
    }
    return {};
  });

  const out = await svc.listConflicts(EVENT);
  // A removed guest leaves the conflict readable rather than crashing the view.
  assert.equal(out[0].guestName, null);
  assert.equal(out[0].guestId, 'g1');
});

test('resolving records who and when, and changes no check-in', async () => {
  const touched = [];
  let patch = null;
  mock.setResolver((s) => {
    touched.push(s.table);
    if (s.table === 'event_check_in_conflicts' && s.op === 'update') {
      patch = s.payload;
      return { data: [{ id: CONFLICT }] };
    }
    return {};
  });

  const out = await svc.resolveConflict(EVENT, CONFLICT, { actorId: 'organizer-1', note: 'Rescanned by mistake' });
  assert.equal(out.ok, true);
  assert.ok(patch.resolved_at);
  assert.equal(patch.resolved_by, 'organizer-1');
  assert.equal(patch.resolution_note, 'Rescanned by mistake');
  // Resolving is an acknowledgement, not a retroactive edit. Reversing an
  // admission is the separately-audited undo flow.
  assert.equal(touched.includes('check_ins'), false);
});

test('resolving an already-resolved conflict is 404, not a silent success', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_check_in_conflicts' && s.op === 'update') return { data: [] };
    return {};
  });

  const { res } = await invoke(ctrl.resolveConflict, mockReq({
    params: { eventId: EVENT, conflictId: CONFLICT }, body: {}, user: { id: 'u1' },
  }));
  assert.equal(res.statusCode, 404);
});

test('a long resolution note is truncated rather than rejected', async () => {
  let patch = null;
  mock.setResolver((s) => {
    if (s.table === 'event_check_in_conflicts' && s.op === 'update') {
      patch = s.payload;
      return { data: [{ id: CONFLICT }] };
    }
    return {};
  });

  await svc.resolveConflict(EVENT, CONFLICT, { actorId: 'u1', note: 'x'.repeat(2000) });
  assert.equal(patch.resolution_note.length, 500);
});

test('the conflicts endpoint returns anomalies alongside', async () => {
  mock.setResolver((s) => {
    if (s.table === 'event_check_in_conflicts') return { data: [] };
    if (s.table === 'check_ins' && s.op === 'select') {
      return {
        data: [
          { id: 'ci-1', guest_id: 'g1', token_verified: false, deleted_at: null, guests: { full_name: 'Bob' } },
          { id: 'ci-2', guest_id: 'g2', token_verified: true, deleted_at: '2026-08-01T19:10:00Z', undo_reason: 'mis-scan', guests: null },
        ],
      };
    }
    return {};
  });

  const { res } = await invoke(ctrl.getConflicts,
    mockReq({ params: { eventId: EVENT }, query: {}, user: { id: 'u1' } }));

  assert.equal(res.statusCode, 200);
  const anomalies = res.body.data.anomalies;
  assert.equal(anomalies.length, 2);
  assert.equal(anomalies[0].kind, 'unverified_scan');
  assert.equal(anomalies[1].kind, 'reversed');
  // §19.5: a guest removed after checking in is in the room but not on the list.
  assert.equal(anomalies[1].guestRemoved, true);
});

// ══════════════════════════════════════════════════════════════════
// Guest category (decision D-4, amendment A-16 item 6)
// ══════════════════════════════════════════════════════════════════

const partyRow = (over = {}) => ({
  id: PARTY, label: 'Alice', response: 'yes',
  guests: [
    { id: 'g1', full_name: 'Alice', is_primary_contact: true, category: 'standard' },
    { id: 'g2', full_name: 'Bob', is_primary_contact: false, category: 'standard' },
  ],
  seating_assignments: [],
  ...over,
});

const categoryResolver = (capture) => (s) => {
  if (s.table === 'rsvp_parties' && s.op === 'update') return { data: partyRow() };
  if (s.table === 'guests' && s.op === 'upsert') { capture.rows = s.payload; return {}; }
  if (s.table === 'guests' && s.op === 'select') return { data: partyRow().guests };
  return {};
};

test('the category is written to EVERY guest in the party', async () => {
  const capture = {};
  mock.setResolver(categoryResolver(capture));

  await guestService.updateParty(EVENT, PARTY, { category: 'vip' });

  assert.ok(capture.rows, 'guests should have been upserted');
  assert.equal(capture.rows.length, 2);
  // A VIP arrives with their family and they are all VIPs at the door.
  assert.ok(capture.rows.every((r) => r.category === 'vip'));
});

test('an unrecognised category is refused rather than coerced', async () => {
  mock.setResolver(() => ({}));
  // Silently coercing to 'standard' would quietly downgrade a VIP, and nobody
  // would find out until the guest reached the door.
  const out = await guestService.updateParty(EVENT, PARTY, { category: 'platinum' });
  assert.equal(out.error, 'INVALID_CATEGORY');
  assert.equal(mock.calls.length, 0);
});

test('category matching is case-insensitive', async () => {
  const capture = {};
  mock.setResolver(categoryResolver(capture));
  await guestService.updateParty(EVENT, PARTY, { category: 'VIP' });
  assert.ok(capture.rows.every((r) => r.category === 'vip'));
});

test('omitting the category preserves each guest\'s existing value', async () => {
  const capture = {};
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties' && s.op === 'update') {
      return { data: partyRow({ guests: [
        { id: 'g1', full_name: 'Alice', is_primary_contact: true, category: 'vip' },
        { id: 'g2', full_name: 'Bob', is_primary_contact: false, category: 'vip' },
      ] }) };
    }
    if (s.table === 'guests' && s.op === 'upsert') { capture.rows = s.payload; return {}; }
    return {};
  });

  // An unrelated edit must not reset the category.
  await guestService.updateParty(EVENT, PARTY, { guestName: 'Alice Smith' });
  assert.ok(capture.rows.every((r) => r.category === 'vip'));
});

test('the endpoint rejects a bad category with 400 and names the valid ones', async () => {
  mock.setResolver(() => ({}));
  const { res } = await invoke(updateRSVP, mockReq({
    params: { eventId: EVENT, partyId: PARTY },
    body: { category: 'platinum' },
    user: { id: 'u1' },
  }));

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /standard/);
  assert.match(res.body.message, /vip/);
});

test('the exported enum is what the UI must mirror', () => {
  assert.deepEqual(guestService.GUEST_CATEGORIES, ['standard', 'vip', 'family']);
});
