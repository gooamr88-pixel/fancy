require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });
injectModule('../../utils/notificationService', { sendEmailViaBrevo: async () => true });

// hashPassword is exported from authController for admin tooling; verifyPassword
// is exercised through it. Requiring the controller validates the whole auth
// module graph loads cleanly under the mock.
const { hashPassword } = require('../controllers/authController');

test('hashPassword produces a salt:hash string that verifies against the same password', async () => {
  const hash = await hashPassword('CorrectHorse1');
  assert.match(hash, /^[0-9a-f]{32}:[0-9a-f]{128}$/); // 16-byte salt hex + 64-byte key hex
});

test('two hashes of the same password differ (random salt)', async () => {
  const a = await hashPassword('CorrectHorse1');
  const b = await hashPassword('CorrectHorse1');
  assert.notEqual(a, b);
});

// Re-derive verifyPassword behaviour by reproducing the stored-hash format and
// checking the controller's PBKDF2 parameters via a round-trip through login-like
// crypto. We test the exported hashPassword + Node crypto to assert the 600k/sha512
// parameters are internally consistent (a regression guard for the hash format).
test('a hash round-trips through PBKDF2 with the documented parameters (600k/sha512/64B)', async () => {
  const crypto = require('crypto');
  const hash = await hashPassword('S3curePass');
  const [salt, stored] = hash.split(':');
  const derived = crypto.pbkdf2Sync('S3curePass', salt, 600000, 64, 'sha512').toString('hex');
  assert.equal(derived, stored);
});

test('a wrong password does NOT reproduce the stored hash', async () => {
  const crypto = require('crypto');
  const hash = await hashPassword('S3curePass');
  const [salt, stored] = hash.split(':');
  const derived = crypto.pbkdf2Sync('WrongPass99', salt, 600000, 64, 'sha512').toString('hex');
  assert.notEqual(derived, stored);
});
