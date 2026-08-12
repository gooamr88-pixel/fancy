require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * CROSS-LAYER CONTRACT — who is told that an event moved or was called off.
 *
 * Two places have to agree on one audience:
 *
 *   • `emailScheduler.notifyGuestsOfEventChange` — SENDS to it.
 *   • `eventController.countNotifiableGuests`    — PROMISES it, in the confirm
 *     dialog, as "Tell 118 guests".
 *
 * They were two hand-written `['yes', 'maybe']` literals in two files, which is
 * exactly the arrangement where a dialog ends up quoting a number nobody
 * receives. The list now lives in the sender and the counter imports it.
 *
 * ── What changed, and why it needs pinning ──
 *
 * The audience used to be guests who had ACCEPTED or said maybe. That is right
 * only if every guest arrived by answering — and it stopped being right the
 * moment an organizer could invite somebody by hand from the dashboard. Those
 * guests sit at `pending` until they open the invitation, so an event that was
 * cancelled told them nothing at all, and the organizer's confirmation said N
 * guests had been contacted with every un-replied guest excluded from N.
 *
 * `no` stays out deliberately: they have declined, and on the SMS leg a
 * cancellation notice to somebody who is not coming is a message the organizer
 * pays for.
 */

const REPO = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const { NOTIFIABLE_RESPONSES } = require('../services/emailScheduler');

/** Every response value the schema allows, per the RSVP validators. */
const ALL_RESPONSES = ['yes', 'no', 'maybe', 'pending', 'waitlist'];

test('the audience is everyone who has not declined', () => {
  assert.deepEqual(
    [...NOTIFIABLE_RESPONSES].sort(),
    ALL_RESPONSES.filter((r) => r !== 'no').sort(),
  );
});

test('a guest who has not replied yet IS told', () => {
  // The whole point of the change. An invited guest at `pending` is somebody who
  // may well be planning to come; being silent at them about a cancellation is
  // the worst outcome this notification exists to prevent.
  assert.ok(NOTIFIABLE_RESPONSES.includes('pending'));
});

test('a guest who declined is NOT told', () => {
  assert.ok(!NOTIFIABLE_RESPONSES.includes('no'));
});

test('the sender filters on the shared list, not a literal', () => {
  const src = read('services/emailScheduler.js');
  const notify = src.slice(src.indexOf('async function notifyGuestsOfEventChange'));
  assert.match(
    notify,
    /\.in\('response', NOTIFIABLE_RESPONSES\)/,
    'notifyGuestsOfEventChange must filter on the exported constant',
  );
});

test('the counter behind the confirm dialog uses the same list', () => {
  const src = read('controllers/eventController.js');
  const counter = src.slice(src.indexOf('async function countNotifiableGuests'));
  const body = counter.slice(0, counter.indexOf('\n}'));

  assert.match(body, /NOTIFIABLE_RESPONSES/, 'the count must import the audience, never restate it');
  assert.doesNotMatch(
    body,
    /\[\s*'yes'\s*,\s*'maybe'\s*\]/,
    'a local copy of the audience is the drift this test exists to catch',
  );
});
