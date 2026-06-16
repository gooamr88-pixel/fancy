require('./helpers/env'); // must run before qrHelper validates QR_JWT_SECRET
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateTicketToken, verifyTicketToken } = require('../utils/qrHelper');

test('a freshly minted ticket verifies and round-trips its payload', () => {
  const token = generateTicketToken({ rsvp_id: 'abc', event_id: 'evt' });
  const decoded = verifyTicketToken(token);
  assert.equal(decoded.rsvp_id, 'abc');
  assert.equal(decoded.event_id, 'evt');
});

test('verifyTicketToken rejects a tampered/garbage token', () => {
  assert.throws(() => verifyTicketToken('not-a-real-jwt'), /INVALID_QR_TICKET/);
});

test('verifyTicketToken rejects a token signed with a different secret', () => {
  const jwt = require('jsonwebtoken');
  const forged = jwt.sign({ rsvp_id: 'abc' }, 'attacker-secret', { algorithm: 'HS256' });
  assert.throws(() => verifyTicketToken(forged), /INVALID_QR_TICKET/);
});

test('an already-expired ticket fails verification', () => {
  const jwt = require('jsonwebtoken');
  const expired = jwt.sign({ rsvp_id: 'abc' }, process.env.QR_JWT_SECRET, { algorithm: 'HS256', expiresIn: -10 });
  assert.throws(() => verifyTicketToken(expired), /INVALID_QR_TICKET/);
});
