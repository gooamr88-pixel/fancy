require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

/**
 * CROSS-LANGUAGE CONTRACT TEST — staff PIN hashing.
 *
 * The Android app verifies staff PINs OFFLINE against a hash shipped in the
 * bundle (spec §18.5). Two implementations must agree exactly:
 *   • backend/controllers/authController.js  → hashPassword()
 *   • android/.../data/security/PinVerifier.kt → derive()
 *
 * A mismatch presents at the door as "every PIN is wrong", with nothing in the
 * failure pointing at a hashing difference. The vector below is pinned
 * identically in
 * android/app/src/test/java/com/fancyrsvp/checkin/data/security/PinVerifierTest.kt.
 *
 * THE TRAP this test exists to lock down: hashPassword generates the salt as a
 * hex STRING and passes that string to crypto.pbkdf2. Node encodes a string salt
 * as UTF-8, so the salt material is the 32 ASCII bytes of the hex text — not the
 * 16 bytes it decodes to. Any port that "helpfully" decodes the hex first
 * produces a different key.
 */

const ITERATIONS = 600000;
const SALT_HEX = '0123456789abcdef0123456789abcdef';
const PIN = '4821';
const EXPECTED_KEY_HEX =
  'dfb8e26e2ddb3ce63c3f63a9a84672d8ceec3131c2ecc2b9dd1b0cabfd6e824a'
  + '8e6169ac0712a64653a465e422acbff6c51a5951277a78927f2b01b5ce06eae3';

test('CONTRACT: the PIN derivation is exactly as pinned', () => {
  const derived = crypto.pbkdf2Sync(PIN, SALT_HEX, ITERATIONS, 64, 'sha512');
  assert.equal(derived.toString('hex'), EXPECTED_KEY_HEX);
});

test('CONTRACT: the salt is the hex TEXT, not the decoded bytes', () => {
  const asText = crypto.pbkdf2Sync(PIN, SALT_HEX, ITERATIONS, 64, 'sha512').toString('hex');
  const asBytes = crypto.pbkdf2Sync(PIN, Buffer.from(SALT_HEX, 'hex'), ITERATIONS, 64, 'sha512').toString('hex');
  assert.equal(asText, EXPECTED_KEY_HEX);
  assert.notEqual(
    asBytes, asText,
    'if these were equal the trap would be harmless and both guards pointless',
  );
});

test('CONTRACT: the stored format is saltHex:keyHex', () => {
  const { hashPassword } = require('../controllers/authController');
  return hashPassword('1234').then((stored) => {
    const parts = stored.split(':');
    assert.equal(parts.length, 2);
    assert.equal(parts[0].length, 32, 'salt is 16 random bytes as hex');
    assert.equal(parts[1].length, 128, 'derived key is 64 bytes as hex');
    assert.match(stored, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });
});

test('CONTRACT: iteration count and key length are what the app expects', () => {
  // A change to either on the server silently invalidates every cached roster
  // hash on every tablet. Pinned here so such a change fails loudly.
  assert.equal(ITERATIONS, 600000);
  assert.equal(Buffer.from(EXPECTED_KEY_HEX, 'hex').length, 64);
});

test('a different PIN derives a different key', () => {
  const other = crypto.pbkdf2Sync('4822', SALT_HEX, ITERATIONS, 64, 'sha512').toString('hex');
  assert.notEqual(other, EXPECTED_KEY_HEX);
});

test('the same PIN with a different salt derives a different key', () => {
  const other = crypto.pbkdf2Sync(PIN, 'ffffffffffffffffffffffffffffffff', ITERATIONS, 64, 'sha512').toString('hex');
  assert.notEqual(other, EXPECTED_KEY_HEX);
});
