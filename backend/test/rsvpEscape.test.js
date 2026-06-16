require('./helpers/env'); // controllers require config/supabase + qrHelper at load
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { escapeLikePattern } = require('../controllers/rsvpController');

test('escapeLikePattern escapes the ILIKE wildcards and the escape char itself', () => {
  // % and _ are wildcards; \ is the escape character. All must be backslash-escaped
  // so a guest searching "50%_off\x" cannot turn the query into a wildcard scan.
  assert.equal(escapeLikePattern('50%_off\\x'), '50\\%\\_off\\\\x');
});

test('escapeLikePattern leaves ordinary text unchanged', () => {
  assert.equal(escapeLikePattern('Alice Smith'), 'Alice Smith');
});

test('escapeLikePattern neutralizes a wildcard-only injection attempt', () => {
  // "%" alone would otherwise match every guest in the event.
  assert.equal(escapeLikePattern('%'), '\\%');
});
