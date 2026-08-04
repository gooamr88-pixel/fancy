require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');

/**
 * SMS CONSENT FOLLOWS THE NUMBER, NOT THE PARTY.
 *
 * Consent is stored on rsvp_parties.sms_consent, but every send resolves the
 * actual destination from guests.phone at send time. Nothing connected the two:
 * an organizer editing the primary contact's number left `sms_consent = true`
 * standing, and the send gate — which only ever compares the CURRENT phone
 * against that flag — happily texted a number whose owner had never seen a
 * consent checkbox. That is a stranger receiving marketing SMS on the strength
 * of somebody else's opt-in.
 *
 * updateParty now revokes on a genuine change of destination. These tests pin
 * the three properties that make the revocation correct rather than merely
 * present: it fires on a real change, it does NOT fire on a reformat of the same
 * number, and it leaves the door open for an immediate re-attestation.
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const guestService = require('../services/guestService');

const EVENT = '11111111-1111-4111-8111-111111111111';
const PARTY = '22222222-2222-4222-8222-222222222222';
const GUEST = '33333333-3333-4333-8333-333333333333';
const ACTOR = '44444444-4444-4444-8444-444444444444';

t.beforeEach(() => mock.reset());

/**
 * Script updateParty's reads: the party row it re-selects after the top-level
 * update (carrying its existing consent state and primary guest), plus the guest
 * reconciliation writes. Returns the list of rsvp_parties UPDATE payloads.
 */
function scriptUpdateParty({ existingPhone, consentAt }) {
  const updates = [];
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties' && s.op === 'update') {
      updates.push({ payload: s.payload, filters: s.filters });
      // The post-update re-select returns the party with its guests embedded.
      return {
        data: {
          id: PARTY,
          event_id: EVENT,
          label: 'Alice',
          sms_consent: !!consentAt,
          sms_consent_at: consentAt,
          guests: [{
            id: GUEST, full_name: 'Alice', is_primary_contact: true,
            phone: existingPhone, email: 'a@x.com',
          }],
          seating_assignments: [],
        },
      };
    }
    if (s.table === 'guests' && s.op === 'select') {
      // findContactConflict selects `full_name` to look for the SAME contact on a
      // DIFFERENT party. Returning a row here would abort the edit with
      // DUPLICATE_PHONE before any consent logic runs, so it must come back empty.
      if (s.cols === 'full_name') return { data: [] };
      // getPrimaryPhone selects `phone`.
      return { data: [{ phone: existingPhone }] };
    }
    return {};
  });
  return updates;
}

const consentWrites = (updates) =>
  updates.filter((u) => u.payload && 'sms_consent' in u.payload);

test('changing the primary contact\'s number revokes the consent it carried', async () => {
  const updates = scriptUpdateParty({
    existingPhone: '+15551112222',
    consentAt: '2026-08-01T10:00:00.000Z',
  });

  await guestService.updateParty(EVENT, PARTY, {
    phone: '+15559998888', actorUserId: ACTOR,
  });

  const revoke = consentWrites(updates).find((u) => u.payload.sms_consent === false);
  assert.ok(revoke, 'a changed destination must clear the consent recorded for the old one');
  assert.equal(revoke.payload.sms_consent_at, null,
    'clearing the timestamp is what makes the party "never decided" again, so it can be re-attested');
  assert.equal(revoke.payload.sms_consent_method, null);
  assert.equal(revoke.payload.sms_consent_attested_by, null,
    'a stale attester must not survive onto a number they never vouched for');
});

test('reformatting the SAME number does not revoke a valid consent', async () => {
  const updates = scriptUpdateParty({
    existingPhone: '+15551112222',
    consentAt: '2026-08-01T10:00:00.000Z',
  });

  // Same subscriber, human formatting — normalizes to the identical E.164.
  await guestService.updateParty(EVENT, PARTY, {
    phone: '(555) 111-2222', actorUserId: ACTOR,
  });

  assert.equal(consentWrites(updates).length, 0,
    'comparing raw strings instead of canonical E.164 would destroy consent on a cosmetic edit');
});

test('a party that never recorded a decision has nothing to revoke', async () => {
  const updates = scriptUpdateParty({ existingPhone: '+15551112222', consentAt: null });

  await guestService.updateParty(EVENT, PARTY, {
    phone: '+15559998888', actorUserId: ACTOR,
  });

  assert.equal(consentWrites(updates).length, 0,
    'no consent existed, so no revocation row should be written');
});

test('an edit that does not touch the phone leaves consent alone', async () => {
  const updates = scriptUpdateParty({
    existingPhone: '+15551112222',
    consentAt: '2026-08-01T10:00:00.000Z',
  });

  await guestService.updateParty(EVENT, PARTY, { notes: 'seat near the band', actorUserId: ACTOR });

  assert.equal(consentWrites(updates).length, 0);
});

test('changing the number AND re-attesting works in one edit', async () => {
  const updates = scriptUpdateParty({
    existingPhone: '+15551112222',
    consentAt: '2026-08-01T10:00:00.000Z',
  });

  await guestService.updateParty(EVENT, PARTY, {
    phone: '+15559998888', smsConsentAttested: true, actorUserId: ACTOR,
  });

  const writes = consentWrites(updates);
  const revokeIdx = writes.findIndex((u) => u.payload.sms_consent === false);
  const attestIdx = writes.findIndex((u) => u.payload.sms_consent === true);

  assert.ok(revokeIdx >= 0, 'the old number\'s consent is still revoked');
  assert.ok(attestIdx >= 0, 'and the organizer can immediately vouch for the new number');
  assert.ok(revokeIdx < attestIdx,
    'order matters: the attestation is guarded by sms_consent_at IS NULL, so the revocation must land first or the re-attestation silently matches no rows');
  assert.equal(writes[attestIdx].payload.sms_consent_method, 'host_attested');
});
