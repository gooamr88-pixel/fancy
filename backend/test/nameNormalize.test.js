require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeNameForSearch } = require('../utils/normalize');

const same = (a, b) => assert.equal(
  normalizeNameForSearch(a), normalizeNameForSearch(b),
  `expected "${a}" and "${b}" to normalize alike (got "${normalizeNameForSearch(a)}" vs "${normalizeNameForSearch(b)}")`,
);

// ══════════════════════════════════════════════════════════════════
// Arabic — spec §8.5. Without these the search is unusable on the
// guest lists this product actually serves.
// ══════════════════════════════════════════════════════════════════

test('alef variants fold together — the single most common Arabic search failure', () => {
  same('أحمد', 'احمد');   // hamza above
  same('إحمد', 'احمد');   // hamza below
  same('آحمد', 'احمد');   // madda
  same('ٱحمد', 'احمد');   // wasla
});

test('tashkeel (diacritics) are ignored', () => {
  same('مُحَمَّد', 'محمد');
  same('عَلِيّ', 'علي');
  same('فَاطِمَة', 'فاطمة');
});

test('tatweel (kashida stretch) is ignored', () => {
  same('محـــمد', 'محمد');
});

test('ta marbuta and ha are interchangeable', () => {
  same('فاطمة', 'فاطمه');
  same('عائشة', 'عائشه');
});

test('ya variants fold together', () => {
  same('علي', 'على');   // ya vs alef maksura
  same('يحيى', 'يحيي');
});

test('hamza-on-waw and hamza-on-ya fold to their base letters', () => {
  same('رؤوف', 'رووف');
  same('مسائل', 'مسايل');
  // NOT asserted: جبرئيل vs جبريل. Those differ by a whole letter, not just a
  // hamza form, and matching them would need doubled-letter collapsing — which
  // would over-fold and start merging genuinely different names.
});

test('Persian/Urdu keyboard letters fold to their Arabic equivalents', () => {
  same('کريم', 'كريم');   // Persian kaf
  same('علی', 'علي');     // Persian ya
});

test('Arabic-Indic digits fold to ASCII, so table numbers match either way', () => {
  assert.equal(normalizeNameForSearch('طاولة ٥'), normalizeNameForSearch('طاولة 5'));
  assert.equal(normalizeNameForSearch('۷'), '7');
});

test('a realistic full name matches its casually-typed form', () => {
  same('أحمد عبد الله الأنصاري', 'احمد عبد الله الانصاري');
  same('مُحَمَّد بن راشِد', 'محمد بن راشد');
});

// ══════════════════════════════════════════════════════════════════
// Latin
// ══════════════════════════════════════════════════════════════════

test('case is ignored', () => {
  same('ALICE SMITH', 'alice smith');
});

test('accents fold', () => {
  same('José', 'Jose');
  same('Zoë', 'Zoe');
  same('François', 'Francois');
  same('Håkan', 'Hakan');
});

test('apostrophes and hyphens are ignored', () => {
  same("O'Brien", 'OBrien');
  same('Al-Masri', 'Al Masri');
  same('Anne-Marie', 'Anne Marie');
  same('D’Angelo', 'DAngelo');
});

test('repeated and surrounding whitespace collapses', () => {
  same('  Alice   Smith  ', 'Alice Smith');
});

// ══════════════════════════════════════════════════════════════════
// Guarantees the caller depends on
// ══════════════════════════════════════════════════════════════════

test('distinct people still do not collide', () => {
  assert.notEqual(normalizeNameForSearch('احمد'), normalizeNameForSearch('محمد'));
  assert.notEqual(normalizeNameForSearch('Alice'), normalizeNameForSearch('Alicia'));
  assert.notEqual(normalizeNameForSearch('سارة'), normalizeNameForSearch('سميرة'));
});

test('substring matching works on the normalized form — this is how the search is used', () => {
  assert.ok(normalizeNameForSearch('أحمد عبد الله').includes(normalizeNameForSearch('عبد')));
  assert.ok(normalizeNameForSearch('José Antonio Ruiz').includes(normalizeNameForSearch('antonio')));
});

test('null, undefined and blank input return an empty string, never a crash', () => {
  assert.equal(normalizeNameForSearch(null), '');
  assert.equal(normalizeNameForSearch(undefined), '');
  assert.equal(normalizeNameForSearch(''), '');
  assert.equal(normalizeNameForSearch('   '), '');
});

test('normalization is idempotent', () => {
  for (const name of ['أحمد عبد الله', 'José-María', "O'Brien", 'مُحَمَّد']) {
    const once = normalizeNameForSearch(name);
    assert.equal(normalizeNameForSearch(once), once, `not idempotent for ${name}`);
  }
});

test('it is a match key, not a display name — mixed scripts survive intact', () => {
  // Guest names are rendered exactly as stored (§9.9). This must never be used
  // for display, but it also must not destroy the Arabic entirely.
  const out = normalizeNameForSearch('احمد Smith');
  assert.ok(out.includes('احمد'));
  assert.ok(out.includes('smith'));
});
