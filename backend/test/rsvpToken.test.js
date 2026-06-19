require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { generateRsvpToken, verifyRsvpToken, mapIntentToResponse } = require('../utils/rsvpToken');

test('generateRsvpToken/verifyRsvpToken round-trips guest + event + response', () => {
  const token = generateRsvpToken({ rsvpId: 'r-1', eventId: 'e-1', response: 'accepted' });
  const decoded = verifyRsvpToken(token);
  assert.equal(decoded.rsvpId, 'r-1');
  assert.equal(decoded.eventId, 'e-1');
  assert.equal(decoded.response, 'accepted');
  assert.equal(decoded.purpose, 'rsvp_invite');
});

test('generateRsvpToken requires rsvpId and eventId', () => {
  assert.throws(() => generateRsvpToken({ rsvpId: 'r-1' }), /required/);
  assert.throws(() => generateRsvpToken({ eventId: 'e-1' }), /required/);
});

test('verifyRsvpToken rejects a tampered token', () => {
  const token = generateRsvpToken({ rsvpId: 'r-1', eventId: 'e-1', response: 'declined' });
  const tampered = token.slice(0, -3) + (token.slice(-3) === 'aaa' ? 'bbb' : 'aaa');
  assert.throws(() => verifyRsvpToken(tampered), /INVALID_RSVP_TOKEN/);
});

test('verifyRsvpToken rejects a token signed for a different purpose (e.g. a QR ticket)', () => {
  // A token with the same secret but no/other purpose claim must not be accepted
  // as an RSVP invite, preventing cross-subsystem replay.
  const foreign = jwt.sign({ purpose: 'qr_ticket', rsvpId: 'r-1', eventId: 'e-1' }, process.env.QR_JWT_SECRET);
  assert.throws(() => verifyRsvpToken(foreign), /INVALID_RSVP_TOKEN/);
});

test('verifyRsvpToken rejects an expired token', () => {
  const expired = jwt.sign({ purpose: 'rsvp_invite', rsvpId: 'r-1', eventId: 'e-1' }, process.env.QR_JWT_SECRET, { expiresIn: -10 });
  assert.throws(() => verifyRsvpToken(expired), /INVALID_RSVP_TOKEN/);
});

test('mapIntentToResponse maps email intents and stored values to DB responses', () => {
  assert.equal(mapIntentToResponse('accepted'), 'yes');
  assert.equal(mapIntentToResponse('yes'), 'yes');
  assert.equal(mapIntentToResponse('Attending'), 'yes');
  assert.equal(mapIntentToResponse('declined'), 'no');
  assert.equal(mapIntentToResponse('no'), 'no');
  assert.equal(mapIntentToResponse('maybe'), 'maybe');
  assert.equal(mapIntentToResponse('garbage'), null);
  assert.equal(mapIntentToResponse(undefined), null);
});
