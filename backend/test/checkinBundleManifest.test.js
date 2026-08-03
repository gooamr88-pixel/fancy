require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });
injectModule('../../utils/realtime', { broadcast: async () => {} });

const svc = require('../services/checkinSyncService');

const EVENT = '11111111-1111-4111-8111-111111111111';

t.beforeEach(() => mock.reset());

/**
 * Builds a resolver for getBundleManifest's five parallel reads.
 *
 * The `guests` table is queried twice with different shapes (once for the hash
 * over the full set, once per page), so this returns the manifest-shaped rows.
 */
const manifestResolver = ({ guests = [], checkIns = [], staff = [], tables = [], changes = [], event = {} } = {}) => (s) => {
  if (s.table === 'events') {
    return { data: { id: EVENT, title: 'Nadia & Omar', event_date: '2026-08-01T18:00:00Z', location_name: 'Grand Hall', custom_colors: { primary: '#B8944F' }, no_kids_allowed: true, ...event } };
  }
  if (s.table === 'guests' && s.op === 'select') return { data: guests };
  if (s.table === 'check_ins' && s.op === 'select') return { data: checkIns };
  if (s.table === 'event_staff') return { data: staff };
  if (s.table === 'tables') return { data: tables };
  if (s.table === 'event_checkin_cursors') return { data: { last_seq: 7 } };
  if (s.table === 'event_guest_changes') return { data: changes };
  return {};
};

const guestRow = (id, name, table = 'Table 4', category = 'standard') => ({
  id, party_id: `p-${id}`, full_name: name, category,
  rsvp_parties: { seating_assignments: [{ tables: { table_name: table, element_type: 'table' } }] },
});

// ══════════════════════════════════════════════════════════════════
// Integrity figures (§21.1)
// ══════════════════════════════════════════════════════════════════

test('the manifest carries a record count and a content hash over the FULL guest set', async () => {
  mock.setResolver(manifestResolver({
    guests: [guestRow('g1', 'Alice'), guestRow('g2', 'Bob'), guestRow('g3', 'Carol')],
    changes: [{ seq: 42 }],
  }));

  const m = await svc.getBundleManifest(EVENT);
  assert.equal(m.integrity.recordCount, 3);
  assert.equal(m.integrity.contentHash.length, 64);
  assert.equal(m.bundleVersion, 42);
});

test('the content hash equals the canonical hash of the same guests', async () => {
  const guests = [guestRow('g2', 'Bob', 'Table 2'), guestRow('g1', 'Alice', 'Table 1')];
  mock.setResolver(manifestResolver({ guests }));

  const m = await svc.getBundleManifest(EVENT);
  const expected = crypto.createHash('sha256').update(svc.canonicalizeGuests([
    { id: 'g1', partyId: 'p-g1', fullName: 'Alice', tableName: 'Table 1', category: 'standard' },
    { id: 'g2', partyId: 'p-g2', fullName: 'Bob', tableName: 'Table 2', category: 'standard' },
  ])).digest('hex');
  assert.equal(m.integrity.contentHash, expected);
});

test('totalPages is derived from the record count, so a device knows when it is done', async () => {
  const guests = Array.from({ length: 1200 }, (_, i) => guestRow(`g${i}`, `Guest ${i}`));
  mock.setResolver(manifestResolver({ guests }));

  const m = await svc.getBundleManifest(EVENT);
  assert.equal(m.integrity.pageSize, svc.BUNDLE_PAGE_SIZE);
  assert.equal(m.integrity.totalPages, Math.ceil(1200 / svc.BUNDLE_PAGE_SIZE));
});

test('an event with no guests still reports one page rather than zero', async () => {
  mock.setResolver(manifestResolver({ guests: [] }));
  const m = await svc.getBundleManifest(EVENT);
  assert.equal(m.integrity.recordCount, 0);
  // A device looping `for page in 1..totalPages` must make at least one request
  // or it never learns the list is legitimately empty.
  assert.equal(m.integrity.totalPages, 1);
});

test('a non-table venue element is excluded from the hash, matching the bundle pages', async () => {
  // If the manifest hashed "Dance Floor" as a table name but the pages filtered
  // it out, verification would fail on every download of that event.
  const guests = [{
    id: 'g1', party_id: 'p1', full_name: 'Alice', category: 'standard',
    rsvp_parties: { seating_assignments: [{ tables: { table_name: 'Dance Floor', element_type: 'zone' } }] },
  }];
  mock.setResolver(manifestResolver({ guests }));

  const m = await svc.getBundleManifest(EVENT);
  const expected = crypto.createHash('sha256').update(svc.canonicalizeGuests([
    { id: 'g1', partyId: 'p1', fullName: 'Alice', tableName: '', category: 'standard' },
  ])).digest('hex');
  assert.equal(m.integrity.contentHash, expected);
});

// ══════════════════════════════════════════════════════════════════
// Existing check-ins (§7) — the Layer 1 guard depends on these
// ══════════════════════════════════════════════════════════════════

test('arrivals already recorded are included, so a fresh device knows who is inside', async () => {
  mock.setResolver(manifestResolver({
    guests: [guestRow('g1', 'Alice')],
    checkIns: [{
      guest_id: 'g1', party_id: 'p-g1', checked_in_at: '2026-08-01T19:00:00Z',
      method: 'manual_search', server_seq: 3, staff_display_name: 'Amina', device_label: 'Web kiosk',
    }],
  }));

  const m = await svc.getBundleManifest(EVENT);
  assert.equal(m.existingCheckIns.length, 1);
  assert.equal(m.existingCheckIns[0].guestId, 'g1');
  assert.equal(m.existingCheckIns[0].serverSeq, 3);
  assert.equal(m.existingCheckIns[0].staffName, 'Amina');
});

test('the existing-check-ins query excludes undone rows', async () => {
  let filters = null;
  mock.setResolver((s) => {
    if (s.table === 'check_ins' && s.op === 'select') { filters = s.filters; return { data: [] }; }
    return manifestResolver({ guests: [guestRow('g1', 'Alice')] })(s);
  });

  await svc.getBundleManifest(EVENT);
  // A reversed admission must not seed the device's duplicate guard, or the
  // guest could never be re-admitted after a supervisor's correction.
  assert.deepEqual(filters.is, [['deleted_at', null]]);
});

test('lastSeq is reported so the device knows where the check-in stream stands', async () => {
  mock.setResolver(manifestResolver({ guests: [guestRow('g1', 'Alice')] }));
  const m = await svc.getBundleManifest(EVENT);
  assert.equal(m.lastSeq, 7);
});

// ══════════════════════════════════════════════════════════════════
// Roster and branding
// ══════════════════════════════════════════════════════════════════

test('the roster ships PIN HASHES, never plaintext', async () => {
  mock.setResolver(manifestResolver({
    guests: [guestRow('g1', 'Alice')],
    staff: [{ id: 's1', display_name: 'Amina', role: 'supervisor', pin_hash: 'abc:def' }],
  }));

  const m = await svc.getBundleManifest(EVENT);
  assert.equal(m.staff[0].pinHash, 'abc:def');
  assert.equal(m.staff[0].displayName, 'Amina');
  assert.equal(m.staff[0].role, 'supervisor');
  assert.equal(JSON.stringify(m).includes('"pin"'), false);
});

test('branding colour is extracted from custom_colors', async () => {
  mock.setResolver(manifestResolver({ guests: [] }));
  const m = await svc.getBundleManifest(EVENT);
  assert.equal(m.event.brandingPrimaryColor, '#B8944F');
  assert.equal(m.event.venue, 'Grand Hall');
  assert.equal(m.event.noKidsAllowed, true);
});

// ══════════════════════════════════════════════════════════════════
// The event photograph (§9.8)
// ══════════════════════════════════════════════════════════════════

test('the cover photograph is carried on the manifest so the device can cache it', async () => {
  mock.setResolver(manifestResolver({
    guests: [],
    event: { cover_image_url: 'https://cdn.fancyrsvp.com/events/nadia-omar.jpg' },
  }));
  const m = await svc.getBundleManifest(EVENT);
  assert.equal(m.event.coverImageUrl, 'https://cdn.fancyrsvp.com/events/nadia-omar.jpg');
});

test('an event with no photograph reports null rather than omitting the field', async () => {
  mock.setResolver(manifestResolver({ guests: [] }));
  const m = await svc.getBundleManifest(EVENT);
  assert.equal(m.event.coverImageUrl, null);
});

/**
 * The device downloads this once, at an office, and renders it offline at a
 * venue. Anything it cannot fetch must be nulled HERE — a `data:` URI or a
 * relative path shipped to the tablet becomes a missing photograph at a wedding
 * with nobody present who can explain it.
 */
test('a non-https cover value is nulled rather than shipped to a device that cannot fetch it', async () => {
  const rejected = [
    'data:image/png;base64,iVBORw0KGgo=',
    '/uploads/cover.jpg',
    'javascript:alert(1)',
    // Cleartext is refused by the app's own network security config, so an
    // http:// address would fail on the device no matter what.
    'http://cdn.fancyrsvp.com/cover.jpg',
    '   ',
    null,
  ];
  for (const bad of rejected) {
    mock.setResolver(manifestResolver({ guests: [], event: { cover_image_url: bad } }));
    const m = await svc.getBundleManifest(EVENT);
    assert.equal(m.event.coverImageUrl, null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('an unknown event throws EVENT_NOT_FOUND rather than returning a hollow manifest', async () => {
  mock.setResolver((s) => {
    if (s.table === 'events') return { data: null, error: { code: 'PGRST116' } };
    return {};
  });
  await assert.rejects(() => svc.getBundleManifest(EVENT), (err) => err.code === 'EVENT_NOT_FOUND');
});
