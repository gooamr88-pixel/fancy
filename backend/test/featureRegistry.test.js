/**
 * Feature Registry unit tests.
 * Validates the integrity of the central feature catalog — duplicate keys,
 * naming conventions, helper correctness — so regressions in the registry
 * surface immediately rather than as mysterious 403s in production.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  PLATFORM_FEATURES,
  FEATURE_CATEGORIES,
  FREE_TIER_FEATURES,
  getFeaturesByCategory,
  getFeatureByKey,
  isValidFeatureKey,
  validateFeatureKeys,
} = require('../config/featureRegistry');

describe('featureRegistry', () => {
  it('exports a non-empty PLATFORM_FEATURES array', () => {
    assert.ok(Array.isArray(PLATFORM_FEATURES));
    assert.ok(PLATFORM_FEATURES.length >= 10, 'Expected at least 10 features');
  });

  it('every feature has the required fields', () => {
    for (const f of PLATFORM_FEATURES) {
      assert.ok(f.key, `Missing key: ${JSON.stringify(f)}`);
      assert.ok(f.label, `Missing label for ${f.key}`);
      assert.ok(f.description, `Missing description for ${f.key}`);
      assert.ok(f.category, `Missing category for ${f.key}`);
      assert.equal(typeof f.freeDefault, 'boolean', `freeDefault must be boolean for ${f.key}`);
    }
  });

  it('all keys are unique', () => {
    const keys = PLATFORM_FEATURES.map(f => f.key);
    const unique = new Set(keys);
    assert.equal(unique.size, keys.length, `Duplicate keys found: ${keys.filter((k, i) => keys.indexOf(k) !== i)}`);
  });

  it('all keys follow lowercase_snake_case convention', () => {
    for (const f of PLATFORM_FEATURES) {
      assert.match(f.key, /^[a-z][a-z0-9_]*$/, `Key '${f.key}' violates snake_case`);
    }
  });

  it('FREE_TIER_FEATURES is a subset of all keys', () => {
    const allKeys = new Set(PLATFORM_FEATURES.map(f => f.key));
    for (const k of FREE_TIER_FEATURES) {
      assert.ok(allKeys.has(k), `Free-tier feature '${k}' not in PLATFORM_FEATURES`);
    }
  });

  it('FREE_TIER_FEATURES matches features with freeDefault=true', () => {
    const expected = PLATFORM_FEATURES.filter(f => f.freeDefault).map(f => f.key);
    assert.deepEqual([...FREE_TIER_FEATURES].sort(), expected.sort());
  });

  it('FEATURE_CATEGORIES contains unique sorted category names', () => {
    assert.ok(FEATURE_CATEGORIES.length > 0);
    const fromFeatures = [...new Set(PLATFORM_FEATURES.map(f => f.category))];
    assert.deepEqual(FEATURE_CATEGORIES, fromFeatures);
  });

  it('getFeaturesByCategory groups correctly', () => {
    const map = getFeaturesByCategory();
    assert.ok(map instanceof Map);
    let total = 0;
    for (const [cat, features] of map) {
      assert.ok(features.length > 0, `Category '${cat}' is empty`);
      for (const f of features) {
        assert.equal(f.category, cat, `Feature '${f.key}' in wrong category bucket`);
      }
      total += features.length;
    }
    assert.equal(total, PLATFORM_FEATURES.length, 'Category grouping lost features');
  });

  it('getFeatureByKey returns the correct feature or undefined', () => {
    const f = getFeatureByKey('seating_map');
    assert.ok(f);
    assert.equal(f.key, 'seating_map');
    assert.equal(f.label, 'Seating chart designer');

    const missing = getFeatureByKey('nonexistent_feature_xyz');
    assert.equal(missing, undefined);
  });

  it('isValidFeatureKey returns boolean correctly', () => {
    assert.equal(isValidFeatureKey('rsvp_basic'), true);
    assert.equal(isValidFeatureKey('sms_campaigns'), true);
    assert.equal(isValidFeatureKey('not_a_feature'), false);
    assert.equal(isValidFeatureKey(''), false);
  });

  it('validateFeatureKeys separates valid from invalid', () => {
    const result = validateFeatureKeys(['rsvp_basic', 'bad_key', 'seating_map', 123, null]);
    assert.deepEqual(result.valid, ['rsvp_basic', 'seating_map']);
    assert.deepEqual(result.invalid, ['bad_key', 123, null]);
  });

  it('validateFeatureKeys handles empty input', () => {
    const result = validateFeatureKeys([]);
    assert.deepEqual(result.valid, []);
    assert.deepEqual(result.invalid, []);
  });
});
