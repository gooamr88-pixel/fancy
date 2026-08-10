require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  getSmsType, isRetiredSmsType, labelForKind,
  migrateLegacySmsSettings, sanitizeSmsSettings,
  SMS_TYPE_KEYS, RETIRED_SMS_TYPE_LABELS,
} = require('../config/smsMessageTypes');
const { isResendable } = require('../utils/smsUsage');

/**
 * WHAT SURVIVED THE FOUR-TYPE REBUILD.
 *
 * This file used to test `sendBulkSMSCampaign` — the free-text campaign blaster,
 * its audience resolver, its wallet pre-check and its per-campaign consent
 * attestation. All of it is gone: an organizer no longer writes their own text or
 * picks a segment, so there is nothing left to attest about at launch time and no
 * launch to attest at.
 *
 * What replaced those tests is the thing the removal put at risk. Retiring six
 * message types left history behind that the platform must still render, must
 * still refuse to re-send, and must never destroy — and the destroy path is one
 * line away from being reachable.
 */

/* ── The retired-type resend guard ───────────────────────────────────────────
 *
 * THE highest-severity defect this rebuild could have introduced.
 *
 * resendSmsMessage DELETES the sms_log row before re-dispatching. That is correct
 * for a live type: the UNIQUE (kind, ref) index would otherwise make a deliberate
 * retry a silent no-op. But for a RETIRED kind the re-dispatch then fails on
 * UNKNOWN_TYPE — and by then the audit row is gone. The organizer gets an error,
 * and a compliance record was destroyed to produce it.
 *
 * Two independent guards stop it, and both are tested here, because the cost of
 * them disagreeing is an unrecoverable deletion.
 */

test('every retired type is recognised as retired, and none is still live', () => {
  for (const kind of Object.keys(RETIRED_SMS_TYPE_LABELS)) {
    assert.equal(isRetiredSmsType(kind), true, `${kind} should be retired`);
    assert.equal(getSmsType(kind), null,
      `${kind} must not resolve as a live type — sendTransactionalSms would try to render it`);
  }
});

test('isResendable refuses a retired kind, whatever its failure reason', () => {
  // NO_ALLOWANCE is normally the most resendable reason there is: the organizer
  // tops up and the message goes. It must still be refused here.
  for (const kind of Object.keys(RETIRED_SMS_TYPE_LABELS)) {
    assert.equal(
      isResendable({ kind, status: 'skipped', skip_reason: 'NO_ALLOWANCE' }),
      false,
      `a ${kind} row must never offer a Try again button — pressing it deletes the record`,
    );
  }
});

test('isResendable still allows a LIVE type that failed for a fixable reason', () => {
  assert.equal(
    isResendable({ kind: 'invitation', status: 'skipped', skip_reason: 'NO_ALLOWANCE' }),
    true,
    'the guard must not have made every retry impossible',
  );
});

test('the resend endpoint checks the retired type BEFORE deleting the log row', () => {
  // Order is the whole defect. Asserted against the source because the ordering
  // is not observable from the outside: by the time a caller can see the error,
  // a wrong implementation has already destroyed the row.
  const src = require('fs').readFileSync(require.resolve('../controllers/campaignController'), 'utf8');

  const guardAt = src.indexOf('isRetiredSmsType(row.kind)');
  const deleteAt = src.indexOf("from('sms_log').delete()");

  assert.ok(guardAt > -1, 'resendSmsMessage must guard on isRetiredSmsType');
  assert.ok(deleteAt > -1, 'the delete is still expected to exist for live types');
  assert.ok(guardAt < deleteAt,
    'the retired-type guard MUST come before the sms_log delete, or a retired kind '
    + 'loses its audit row and then fails to send anyway');
});

/* ── The log still reads in English ──────────────────────────────────────── */

test('labelForKind names live types, retired types, and anything unknown', () => {
  assert.equal(labelForKind('invitation'), 'Invitation');
  assert.match(labelForKind('campaign'), /no longer sent/,
    'a retired row must say so rather than showing a raw key');
  assert.equal(labelForKind('something_we_never_shipped'), 'Message',
    'an unknown kind falls back to a word rather than leaking the key or rendering undefined');
});

/* ── The settings migration ──────────────────────────────────────────────── */

test('legacy settings map onto the four current keys', () => {
  const migrated = migrateLegacySmsSettings({
    rsvp_confirmation: true, rsvp_reminder: true, event_reminder: true,
    qr_ticket: true, decline_ack: false, organizer_report: true, campaign: true,
  });

  assert.deepEqual(Object.keys(migrated).sort(), [...SMS_TYPE_KEYS].sort());
  assert.equal(migrated.invitation, true);
  assert.equal(migrated.seating_reminder, true);
  assert.equal(migrated.organizer_report, true);
  assert.equal(migrated.event_update, true, 'a new type with no predecessor defaults ON');
});

test('the three merged types are OR-ed, not AND-ed', () => {
  // The reason this matters: all three defaulted ON, so an AND would mean an
  // organizer who switched off exactly ONE of them silently lost every automated
  // guest text. The safe direction to be wrong in is a message they can turn off
  // in one click, not a silence they would never think to look for.
  const oneOff = migrateLegacySmsSettings({
    rsvp_confirmation: false, event_reminder: true, qr_ticket: true, campaign: true,
  });
  assert.equal(oneOff.seating_reminder, true,
    'disabling one of the three merged sources must not disable the successor');

  const allOff = migrateLegacySmsSettings({
    rsvp_confirmation: false, event_reminder: false, qr_ticket: false, campaign: true,
  });
  assert.equal(allOff.seating_reminder, false,
    'but an organizer who switched off ALL three did mean it');
});

test('an already-migrated object is left alone', () => {
  const current = { invitation: false, seating_reminder: true, event_update: true, organizer_report: false };
  assert.deepEqual(migrateLegacySmsSettings(current), current,
    're-deriving from keys that are no longer present would reset every switch to its default');
});

test('sanitize cannot resurrect a retired key', () => {
  const out = sanitizeSmsSettings({ campaign: true, decline_ack: true, invitation: false });
  assert.equal('campaign' in out, false);
  assert.equal('decline_ack' in out, false);
  assert.equal(out.invitation, false, 'a known key is still honoured');
});

/* ── The blaster is really gone ──────────────────────────────────────────── */

test('no route or controller can still send free-form SMS text', () => {
  const controller = require('../controllers/campaignController');
  const routes = require('fs').readFileSync(require.resolve('../routes/campaignRoutes'), 'utf8');

  assert.equal(controller.sendBulkSMSCampaign, undefined);
  assert.equal(controller.getCampaignStatus, undefined);

  // Matched on the ROUTE REGISTRATION, not on the bare string. The file still
  // mentions /send-sms in a comment explaining where texting the invitation went
  // instead, and that comment is worth keeping — a loose match would force
  // whoever reads this next to delete the explanation to make a test pass.
  assert.doesNotMatch(routes, /router\.(post|get|patch|put)\(\s*['"]\/send-sms/,
    'the free-text campaign route must not come back — templated messages only');
  assert.doesNotMatch(routes, /body\(\s*['"]messageTemplate/,
    'no endpoint should accept an organizer-authored SMS body');
});

test('sendRecipient is no longer a public export', () => {
  const smsDispatch = require('../services/smsDispatch');
  assert.equal(smsDispatch.sendRecipient, undefined,
    'the carrier must be reachable only through sendTransactionalSms, so every send '
    + 'passes the entitlement, per-type, idempotency, consent and STOP gates');
  assert.equal(typeof smsDispatch.sendTransactionalSms, 'function');
});
