require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { injectModule } = require('./helpers/inject');
const { createMockSupabase } = require('./helpers/mockSupabase');

injectModule('../../config/supabase', { supabase: createMockSupabase().supabase });
const svc = require('../services/checkinSyncService');

/**
 * CROSS-LANGUAGE CONTRACT TEST.
 *
 * The bundle content hash is computed independently by two implementations:
 *   • backend/services/checkinSyncService.js  → canonicalizeGuests()
 *   • android/.../util/BundleIntegrity.kt     → canonicalize()
 *
 * If they disagree by a single byte, EVERY bundle download fails verification
 * and no device can ever be armed. The failure would appear as "preparation is
 * broken" with no indication that a serialisation detail was the cause.
 *
 * Neither side may be changed without the other. This fixture and its expected
 * output are the contract, duplicated verbatim in
 * android/app/src/test/java/com/fancyrsvp/checkin/util/BundleIntegrityTest.kt.
 * Both suites assert the same constants, so a one-sided edit fails here or
 * there rather than silently in the field.
 */

// Deliberately awkward: unsorted input, an Arabic name, a Latin accent, an
// embedded quote, a tab, a newline, a backslash, a null table, an empty table,
// and a null category. Every escaping and defaulting rule at once.
const FIXTURE = [
  { id: 'b-2', partyId: 'p1', fullName: 'Bob "Bobby" Smith', tableName: 'Table 2', category: 'standard' },
  { id: 'a-1', partyId: 'p1', fullName: 'أحمد عبد الله', tableName: null, category: 'vip' },
  { id: 'c-3', partyId: 'p2', fullName: 'José Al-Masri', tableName: 'Table 10', category: null },
  { id: 'd-4', partyId: 'p2', fullName: 'Tab\tand\nNewline\\slash', tableName: '', category: 'family' },
];

const EXPECTED_CANONICAL =
  '[["a-1","p1","أحمد عبد الله","","vip"],'
  + '["b-2","p1","Bob \\"Bobby\\" Smith","Table 2","standard"],'
  + '["c-3","p2","José Al-Masri","Table 10","standard"],'
  + '["d-4","p2","Tab\\tand\\nNewline\\\\slash","","family"]]';

const EXPECTED_SHA256 = '9908c85762112bd17249e4050e8f3579615cc7ee595dcccb4fd539e3ce63dc9a';

test('CONTRACT: the canonical serialisation is exactly as pinned', () => {
  assert.equal(svc.canonicalizeGuests(FIXTURE), EXPECTED_CANONICAL);
});

test('CONTRACT: the content hash is exactly as pinned', () => {
  const hash = crypto.createHash('sha256')
    .update(svc.canonicalizeGuests(FIXTURE)).digest('hex');
  assert.equal(hash, EXPECTED_SHA256);
});

test('CONTRACT: rows are sorted by id, so input order cannot affect the hash', () => {
  const shuffled = [FIXTURE[3], FIXTURE[1], FIXTURE[0], FIXTURE[2]];
  assert.equal(svc.canonicalizeGuests(shuffled), EXPECTED_CANONICAL);
});

test('CONTRACT: a null category defaults to "standard"', () => {
  // c-3 has category: null and must serialise as "standard" — the Kotlin side
  // applies the same default, and a mismatch here is a silent hash divergence.
  assert.ok(svc.canonicalizeGuests(FIXTURE).includes('"c-3","p2","José Al-Masri","Table 10","standard"'));
});

test('CONTRACT: a null table and an empty table both serialise as ""', () => {
  const canon = svc.canonicalizeGuests(FIXTURE);
  assert.ok(canon.includes('"a-1","p1","أحمد عبد الله","","vip"'), 'null tableName → ""');
  assert.ok(canon.includes('"d-4","p2","Tab\\tand\\nNewline\\\\slash","","family"'), 'empty tableName → ""');
});

test('CONTRACT: Arabic is NOT escaped — the hash covers its UTF-8 bytes', () => {
  const canon = svc.canonicalizeGuests(FIXTURE);
  assert.ok(canon.includes('أحمد عبد الله'), 'Arabic must appear literally, not as \\uXXXX');
  assert.ok(!canon.includes('\\u06'), 'no unicode escaping of Arabic');
});

test('CONTRACT: the serialisation carries no incidental whitespace', () => {
  const canon = svc.canonicalizeGuests(FIXTURE);
  // A pretty-printed variant would hash differently. Only the tab/newline
  // INSIDE the escaped guest name may appear, and those are two-character
  // escape sequences, not literal whitespace.
  assert.ok(!/\[\s/.test(canon), 'no space after [');
  assert.ok(!/,\s/.test(canon), 'no space after ,');
  assert.equal(canon.includes('\n'), false, 'no literal newline');
  assert.equal(canon.includes('\t'), false, 'no literal tab');
});

test('an empty guest list hashes deterministically', () => {
  assert.equal(svc.canonicalizeGuests([]), '[]');
  assert.equal(
    crypto.createHash('sha256').update('[]').digest('hex'),
    '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
  );
});

test('dropping one guest changes the hash — this is what catches a truncated download', () => {
  const truncated = FIXTURE.slice(0, 3);
  assert.notEqual(svc.canonicalizeGuests(truncated), EXPECTED_CANONICAL);
});

test('changing only a table assignment changes the hash', () => {
  const moved = FIXTURE.map((g) => (g.id === 'b-2' ? { ...g, tableName: 'Table 9' } : g));
  assert.notEqual(svc.canonicalizeGuests(moved), EXPECTED_CANONICAL);
});

// ─────────────────────────────────────────────────────────────────────────────
// The hash covers exactly five fields — [id, partyId, fullName, tableName,
// category]. Everything else the bundle carries (mealSelection, dietaryNotes,
// partyNotes, side, partyMealSummary) is payload the device displays, NOT part
// of the integrity contract.
//
// That is what makes it safe for the backend to add a field: the hash is
// unchanged, and the Android Json is configured `ignoreUnknownKeys = true`
// precisely so a tablet that has been offline for a week keeps working
// (AppModule.kt §21.4). This test pins that property, so a future change that
// widens canonicalizeGuests has to be a deliberate, coordinated decision rather
// than an accident that bricks every paired device.
// ─────────────────────────────────────────────────────────────────────────────

test('CONTRACT: adding a display-only field cannot change the hash', () => {
  const enriched = FIXTURE.map((g) => ({
    ...g,
    partyMealSummary: '2 x Fish, 1 x Beef',
    mealSelection: 'Chicken',
    dietaryNotes: 'No nuts',
    someFutureField: { anything: [1, 2, 3] },
  }));
  assert.equal(svc.canonicalizeGuests(enriched), EXPECTED_CANONICAL);
});

test('CONTRACT: the five hashed fields are still the five hashed fields', () => {
  // Each of these MUST change the hash. If one stops doing so, the bundle can
  // be corrupted in that field without any device noticing.
  for (const field of ['id', 'partyId', 'fullName', 'tableName', 'category']) {
    const mutated = FIXTURE.map((g, i) => (i === 0 ? { ...g, [field]: 'zzz-changed' } : g));
    assert.notEqual(
      svc.canonicalizeGuests(mutated), EXPECTED_CANONICAL,
      `${field} is part of the integrity contract and must affect the hash`,
    );
  }
});
