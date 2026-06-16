const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isAcceptedResponse, isDeclinedResponse } = require('../utils/responseHelpers');

test('isAcceptedResponse recognizes accepted variants case-insensitively', () => {
  for (const v of ['yes', 'YES', ' Yes ', 'accepted', 'Attending']) {
    assert.equal(isAcceptedResponse(v), true, `expected ${JSON.stringify(v)} to be accepted`);
  }
});

test('isAcceptedResponse rejects declines, pending, and empties', () => {
  for (const v of ['no', 'declined', 'pending', '', null, undefined]) {
    assert.equal(isAcceptedResponse(v), false, `expected ${JSON.stringify(v)} to be not-accepted`);
  }
});

test('isDeclinedResponse recognizes declined variants case-insensitively', () => {
  for (const v of ['no', 'NO', ' No ', 'declined', 'Not Attending']) {
    assert.equal(isDeclinedResponse(v), true, `expected ${JSON.stringify(v)} to be declined`);
  }
});

test('accepted and declined are mutually exclusive for known values', () => {
  for (const v of ['yes', 'no', 'accepted', 'declined', 'attending']) {
    assert.notEqual(isAcceptedResponse(v), isDeclinedResponse(v));
  }
});
