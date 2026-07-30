require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { signQrTicket, verifyQrTicket, signRsvpInvite } = require('../services/tokenService');

/**
 * CROSS-LANGUAGE CONTRACT TEST — QR ticket payload shape.
 *
 * The Android app parses these tokens WITHOUT verifying the signature (decision
 * D-20), so its only contract with the server is the payload's SHAPE: which
 * claims exist, what they are named, and how the token is wrapped in a URL.
 *
 * Kotlin half: android/app/src/test/.../scan/TicketResolverTest.kt, which pins a
 * token minted by this very function.
 *
 * If the server changes a claim name, drops `purpose`, or changes the
 * `/ticket/<token>` URL shape, this fails here and there — instead of every scan
 * at a door silently resolving to "not found", which is what a device that cannot
 * parse a ticket reports.
 */

const PARTY_ID = '3f1c9a2e-7b44-4d8a-9c31-0e5f6a7b8c9d';
const EVENT_ID = '11111111-1111-4111-8111-111111111111';

const payloadOf = (token) =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));

test('CONTRACT: the payload carries exactly the claims the app reads', () => {
  const token = signQrTicket({
    partyId: PARTY_ID, eventId: EVENT_ID,
    tableName: 'Table 12', partySize: 4, eventDate: '2030-01-01T00:00:00Z',
  });
  const payload = payloadOf(token);

  assert.equal(payload.partyId, PARTY_ID);
  assert.equal(payload.eventId, EVENT_ID);
  assert.equal(payload.tableName, 'Table 12');
  assert.equal(payload.partySize, 4);
  assert.equal(payload.purpose, 'qr_ticket');
  assert.equal(typeof payload.exp, 'number');
  assert.equal(typeof payload.iat, 'number');
});

test('CONTRACT: the purpose claim is exactly "qr_ticket"', () => {
  // The app rejects any other purpose. An RSVP invite is signed with the SAME
  // secret, so this claim is the only thing separating a login link from a door
  // pass.
  const ticket = payloadOf(signQrTicket({ partyId: PARTY_ID, eventId: EVENT_ID }));
  const invite = payloadOf(signRsvpInvite({ partyId: PARTY_ID, eventId: EVENT_ID }));

  assert.equal(ticket.purpose, 'qr_ticket');
  assert.notEqual(invite.purpose, 'qr_ticket');
});

test('CONTRACT: an RSVP invite is NOT accepted as a ticket by the server either', () => {
  const invite = signRsvpInvite({ partyId: PARTY_ID, eventId: EVENT_ID });
  assert.throws(() => verifyQrTicket(invite));
});

test('CONTRACT: the token is a three-segment JWT with an unpadded base64url payload', () => {
  const token = signQrTicket({ partyId: PARTY_ID, eventId: EVENT_ID });
  const parts = token.split('.');

  assert.equal(parts.length, 3);
  assert.ok(parts.every((p) => p.length > 0));
  // The app restores padding itself; a padded payload would mean its decoder is
  // solving a problem that no longer exists, and an unpadded one that it must.
  assert.equal(parts[1].includes('='), false, 'JWT payloads are unpadded');
  assert.match(parts[1], /^[A-Za-z0-9_-]+$/, 'payload is base64URL, not standard base64');
});

test('CONTRACT: the QR encodes <origin>/ticket/<token>', () => {
  // Mirrors backend/routes/publicRoutes.js — the QR image points at the guest's
  // own ticket page so an ordinary phone camera opens something useful, which is
  // why the app must unwrap a URL rather than expect a bare token.
  const token = signQrTicket({ partyId: PARTY_ID, eventId: EVENT_ID });
  const url = `https://fancyrsvp.com/ticket/${encodeURIComponent(token)}`;

  const extracted = decodeURIComponent(url.match(/\/ticket\/([^/?#]+)/)[1]);
  assert.equal(extracted, token);
});

test('CONTRACT: encodeURIComponent leaves a JWT unchanged', () => {
  // Recorded because it explains why the app's URL-decode step is a safety net
  // rather than a necessity: every base64url character plus "." is URL-safe.
  const token = signQrTicket({ partyId: PARTY_ID, eventId: EVENT_ID });
  assert.equal(encodeURIComponent(token), token);
});

test('CONTRACT: expiry tracks the event date plus a day', () => {
  const eventDate = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
  const payload = payloadOf(signQrTicket({ partyId: PARTY_ID, eventId: EVENT_ID, eventDate }));

  const expectedExp = Math.floor((new Date(eventDate).getTime() + 24 * 3600 * 1000) / 1000);
  // Allow a second of drift between signing and this assertion.
  assert.ok(Math.abs(payload.exp - expectedExp) <= 2, `exp ${payload.exp} vs ${expectedExp}`);
});

test('CONTRACT: a ticket minted without a table is still valid', () => {
  // signQrTicketForResponse deliberately does not wait for seating, so the app
  // must handle a null tableName rather than treating it as malformed.
  const payload = payloadOf(signQrTicket({ partyId: PARTY_ID, eventId: EVENT_ID, tableName: null }));
  assert.equal(payload.partyId, PARTY_ID);
  assert.equal(payload.purpose, 'qr_ticket');
  assert.ok(payload.tableName === null || payload.tableName === undefined);
});

test('a ticket cannot be minted without both ids', () => {
  assert.throws(() => signQrTicket({ partyId: PARTY_ID }));
  assert.throws(() => signQrTicket({ eventId: EVENT_ID }));
});
