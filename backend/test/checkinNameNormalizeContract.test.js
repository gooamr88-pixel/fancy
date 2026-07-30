require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeNameForSearch } = require('../utils/normalize');

/**
 * CROSS-LANGUAGE CONTRACT TEST — name normalisation for search.
 *
 * Two implementations must agree:
 *   • backend/utils/normalize.js            → normalizeNameForSearch()
 *   • android/.../util/NameNormalizer.kt    → normalize()
 *
 * The device search is the primary path (§8.5) but the web kiosk hits the server
 * one. A divergence means staff at one door get different results from staff at
 * another for the same query — and it would only ever be noticed at a venue,
 * mid-event, with a queue forming.
 *
 * The vectors below are pinned identically in
 * android/app/src/test/java/com/fancyrsvp/checkin/util/NameNormalizerTest.kt.
 *
 * Inputs are written as \u escapes, never as literal Arabic: a combining mark in
 * a source file is invisible in review and in a diff, and an editor's encoding
 * normalisation can silently alter it. What is being asserted here is an exact
 * sequence of code points, so it must be written as one.
 */

// [inputCodePoints, expectedOutput]
const VECTORS = [
  // Alef variants all fold to bare alef — the most common Arabic search failure.
  ['أحمد', 'احمد'],                 // hamza above
  ['إحمد', 'احمد'],                 // hamza below
  ['آحمد', 'احمد'],                 // madda
  ['ٱحمد', 'احمد'],                 // wasla
  ['احمد', 'احمد'],                 // already bare

  // Tashkeel and tatweel are ignored.
  ['مُحَمَّد', 'محمد'],
  ['محــمد', 'محمد'],

  // Ta marbuta -> ha.
  ['فاطمة', 'فاطمه'],
  ['فاطمه', 'فاطمه'],

  // Ya variants.
  ['علي', 'علي'],
  ['على', 'علي'],

  // Hamza on waw / ya drop to base letters.
  ['رؤوف', 'رووف'],
  ['مسائل', 'مسايل'],

  // Persian keyboard kaf.
  ['کريم', 'كريم'],

  // Arabic-Indic digits fold to ASCII.
  ['طاولة ٥', 'طاوله 5'],

  // Latin accent folding.
  ['José', 'jose'],
  ['Zoë', 'zoe'],
  ['François', 'francois'],

  // Punctuation classes: apostrophes vanish, hyphens become spaces.
  ["O'Brien", 'obrien'],
  ['D’Angelo', 'dangelo'],
  ['Al-Masri', 'al masri'],
  ['Anne-Marie', 'anne marie'],

  // Whitespace and case.
  ['  Alice   Smith  ', 'alice smith'],
  ['ALICE SMITH', 'alice smith'],

  // A realistic full name, and a mixed-script one.
  [
    'أحمد عبد الله الأنصاري',
    'احمد عبد الله الانصاري',
  ],
  ['احمد Smith', 'احمد smith'],

  ['', ''],
];

test('CONTRACT: every pinned vector normalises exactly as recorded', () => {
  for (const [input, expected] of VECTORS) {
    assert.equal(
      normalizeNameForSearch(input),
      expected,
      `input ${JSON.stringify(input)} -> got ${JSON.stringify(normalizeNameForSearch(input))}, want ${JSON.stringify(expected)}`,
    );
  }
});

test('CONTRACT: a non-breaking space is treated as whitespace', () => {
  // JS \s covers NBSP; Java's does not, so the Kotlin port carries an explicit
  // whitespace class. If this ever stops holding on either side, a pasted guest
  // name containing an NBSP becomes unfindable on one platform only.
  assert.equal(normalizeNameForSearch('Alice Smith'), 'alice smith');
});

test('CONTRACT: null and undefined return an empty string, never a crash', () => {
  assert.equal(normalizeNameForSearch(null), '');
  assert.equal(normalizeNameForSearch(undefined), '');
});

test('CONTRACT: normalisation is idempotent', () => {
  for (const [input] of VECTORS) {
    const once = normalizeNameForSearch(input);
    assert.equal(normalizeNameForSearch(once), once, `not idempotent for ${JSON.stringify(input)}`);
  }
});

test('CONTRACT: distinct people still do not collide', () => {
  // The folding must not be so aggressive that it merges different names — that
  // would be worse than failing to match, because staff would admit the wrong
  // guest.
  const pairs = [
    ['احمد', 'محمد'],
    ['سارة', 'سميرة'],
    ['Alice', 'Alicia'],
  ];
  for (const [a, b] of pairs) {
    assert.notEqual(normalizeNameForSearch(a), normalizeNameForSearch(b));
  }
});
