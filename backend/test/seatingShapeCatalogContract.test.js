require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * CROSS-LAYER CONTRACT TEST — the seating element shape catalogue.
 *
 * The catalogue now has exactly ONE frontend home,
 * `frontend/src/app/utils/seatingGeometry.js`, imported by the organizer
 * editor and both guest maps. It still has to agree with two backend layers
 * that cannot import it:
 *   1. `TABLE_SHAPES` / `ZONE_SHAPES` in backend/controllers/tableController.js
 *   2. the DB `CHECK tables_shape_check`
 *
 * Before the consolidation there were four hand-maintained copies and both
 * ways they could disagree shipped: the editor palette grew to 14 venue zones
 * while the API and the CHECK stayed at 6 (every pick returned
 * `Invalid shape "<name>"`), and the guest maps stayed at 6 too — which does
 * not error at all, it falls through to `SHAPES.round` and draws the buffet as
 * a round table.
 *
 * These read the real files rather than restating a list, so the test can only
 * pass when the layers genuinely agree. Regex-scraping the frontend is crude,
 * but a backend test cannot import an ESM module from the Next tree, and the
 * alternative — a fresh hand-maintained copy of the list, here — is the very
 * failure mode being guarded against.
 */

const REPO = path.join(__dirname, '..', '..');
const GEOMETRY = 'frontend/src/app/utils/seatingGeometry.js';
// Every surface that draws the venue layout. None may hold its own catalogue.
const CONSUMERS = [
  'frontend/src/app/dashboard/seating-map/page.js',
  'frontend/src/app/[slug]/rsvp/SeatingMiniMap.js',
  'frontend/src/app/[slug]/rsvp/SeatingMapFullscreen.js',
];

const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const { TABLE_SHAPES, ZONE_SHAPES, ALL_SHAPES } = require('../controllers/tableController');

/** Top-level keys of the `export const SHAPES = { … }` object literal. */
function scrapeShapeKeys(relPath) {
  const block = read(relPath).match(/(?:export )?const SHAPES = \{([\s\S]*?)\n\};/);
  assert.ok(block, `could not locate the SHAPES catalogue in ${relPath}`);
  const keys = block[1]
    .split('\n')
    .map((line) => line.match(/^\s{2}([a-z_]+)\s*:\s*\{/))
    .filter(Boolean)
    .map((m) => m[1]);
  // Guards the scraper itself: a regex that silently matched nothing would make
  // every assertion below vacuously true.
  assert.ok(keys.length >= 10, `scraped only ${keys.length} shapes from ${relPath} — the regex has drifted`);
  return keys;
}

/** Shapes named in the newest migration that (re)defines tables_shape_check. */
function scrapeCheckConstraint() {
  const dir = path.join(REPO, 'supabase', 'migrations');
  const file = fs.readdirSync(dir).sort().reverse()
    .find((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes('ADD CONSTRAINT tables_shape_check'));
  assert.ok(file, 'no migration defines tables_shape_check');
  const sql = fs.readFileSync(path.join(dir, file), 'utf8');
  const body = sql.match(/ADD CONSTRAINT tables_shape_check CHECK \(shape IN \(([\s\S]*?)\)\);/);
  assert.ok(body, `could not parse the CHECK body in ${file}`);
  return [...body[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

test('CONTRACT: the catalogue has exactly one home — no consumer re-declares it', () => {
  for (const file of CONSUMERS) {
    const src = read(file);
    assert.ok(
      !/const SHAPES = \{/.test(src),
      `${file} declares its own SHAPES catalogue — import it from ${GEOMETRY} instead`,
    );
    assert.ok(
      src.includes("from '../../utils/seatingGeometry'"),
      `${file} does not import the shared catalogue`,
    );
  }
});

test('CONTRACT: no consumer re-derives an element centre by hand', () => {
  // elCenterX/elCenterY exist because position_x/position_y is the element's
  // TOP-LEFT corner; reading it as a centre shifted every element by half its
  // own size and scrambled the print/export layout.
  for (const file of CONSUMERS) {
    const src = read(file);
    assert.ok(
      !/elWidth\(el\) \/ 2|elHeight\(el\) \/ 2/.test(src),
      `${file} re-derives a centre by hand — use elCenterX/elCenterY/elBox`,
    );
  }
});

test('CONTRACT: every shape the organizer can pick is accepted by the API', () => {
  const missing = scrapeShapeKeys(GEOMETRY).filter((s) => !ALL_SHAPES.includes(s));
  assert.deepEqual(missing, [], 'these palette shapes would fail with "Invalid shape"');
});

test('CONTRACT: every shape the API accepts is allowed by the DB CHECK', () => {
  const allowed = scrapeCheckConstraint();
  const missing = ALL_SHAPES.filter((s) => !allowed.includes(s));
  assert.deepEqual(missing, [], 'the API would accept these and the insert would then fail');
});

test('the legacy "rectangular" alias stays accepted for rows written before the rename', () => {
  assert.ok(TABLE_SHAPES.includes('rectangular'));
  assert.ok(scrapeCheckConstraint().includes('rectangular'));
  // The alias is deliberately NOT in the frontend catalogue — shapeMeta() maps
  // it onto 'rectangle' so it never needs its own palette tile.
  assert.ok(!scrapeShapeKeys(GEOMETRY).includes('rectangular'));
  assert.ok(read(GEOMETRY).includes("shape === 'rectangular' ? 'rectangle'"));
});

test('tables and zones are disjoint sets', () => {
  const overlap = TABLE_SHAPES.filter((s) => ZONE_SHAPES.includes(s));
  assert.deepEqual(overlap, []);
});

test('every zone advertises an icon that actually exists in Icon.js', () => {
  const geometry = read(GEOMETRY);
  const iconNames = new Set(
    [...read('frontend/src/app/components/icons/Icon.js').matchAll(/^ {2}([a-zA-Z]+):/gm)].map((m) => m[1]),
  );
  const declared = [...geometry.matchAll(/icon: '([a-zA-Z]+)'/g)].map((m) => m[1]);
  assert.ok(declared.length > 0, 'no zone icons scraped — the regex has drifted');
  const missing = declared.filter((n) => !iconNames.has(n));
  assert.deepEqual(missing, [], 'these icon names render as nothing on both guest maps');
});
