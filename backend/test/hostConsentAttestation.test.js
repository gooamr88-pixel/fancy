require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase, eqVal } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');

/**
 * Host-attested SMS consent (TCPA/CTIA + Terms §5).
 *
 * An organizer who already holds a guest's permission to text them can say so
 * when adding or importing that guest, which makes the number messageable. The
 * dangerous failure mode is obvious — a host attestation quietly overriding a
 * guest who declined — so the precedence rule is pinned here:
 *
 *   a guest's own decision ALWAYS outranks a host's claim about it.
 *
 * Enforced by the `.is('sms_consent_at', null)` filter on the attestation
 * update: it can only ever touch a party that has never recorded a decision.
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

const guestService = require('../services/guestService');

const EVENT = '11111111-1111-4111-8111-111111111111';
const PARTY = '22222222-2222-4222-8222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333';

/** Script add_guest_to_party to succeed; capture any rsvp_parties update. */
function scriptAddGuest({ attestationMatchedRows = [{ id: PARTY }] } = {}) {
  const updates = [];
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'add_guest_to_party') {
      return { data: { success: true, party_id: PARTY, guest_id: 'g1' } };
    }
    if (s.table === 'rsvp_parties' && s.op === 'update') {
      updates.push({ payload: s.payload, filters: s.filters });
      return { data: attestationMatchedRows };
    }
    return {};
  });
  return updates;
}

t.beforeEach(() => mock.reset());

/* ── The attestation is opt-in, per guest ──────────────────────────────── */

test('no attestation → the number is stored but consent is never set', async () => {
  const updates = scriptAddGuest();

  await guestService.addGuest({
    eventId: EVENT, actorUserId: ACTOR, fullName: 'Alice', phone: '+15551234567',
    smsConsentAttested: false,
  });

  assert.equal(updates.some(u => u.payload && 'sms_consent' in u.payload), false,
    'an unattested add must not write sms_consent at all');
});

test('attestation without a phone number writes nothing', async () => {
  const updates = scriptAddGuest();

  await guestService.addGuest({
    eventId: EVENT, actorUserId: ACTOR, fullName: 'Alice', phone: null,
    smsConsentAttested: true,
  });

  assert.equal(updates.some(u => u.payload && 'sms_consent' in u.payload), false,
    'there is nothing to attest about without a number');
});

test('attestation + phone → consent recorded as host_attested, with attester and time', async () => {
  const updates = scriptAddGuest();

  await guestService.addGuest({
    eventId: EVENT, actorUserId: ACTOR, fullName: 'Alice', phone: '+15551234567',
    smsConsentAttested: true, consentSource: 'host_manual_add',
  });

  const consentUpdate = updates.find(u => u.payload && 'sms_consent' in u.payload);
  assert.ok(consentUpdate, 'the attestation must be persisted');
  assert.equal(consentUpdate.payload.sms_consent, true);
  assert.equal(consentUpdate.payload.sms_consent_method, 'host_attested',
    'must be distinguishable from a guest opt-in at audit time');
  assert.equal(consentUpdate.payload.sms_consent_attested_by, ACTOR);
  assert.ok(consentUpdate.payload.sms_consent_attested_at, 'the attestation must be dated');
  assert.equal(consentUpdate.payload.sms_consent_source, 'host_manual_add');
});

/* ── Precedence: the guest always wins ─────────────────────────────────── */

test('the attestation update is guarded so it can never overwrite a guest decision', async () => {
  const updates = scriptAddGuest();

  await guestService.addGuest({
    eventId: EVENT, actorUserId: ACTOR, fullName: 'Alice', phone: '+15551234567',
    smsConsentAttested: true,
  });

  const consentUpdate = updates.find(u => u.payload && 'sms_consent' in u.payload);
  const isFilter = consentUpdate.filters.is || [];
  assert.ok(
    isFilter.some(([col, val]) => col === 'sms_consent_at' && val === null),
    'must filter on sms_consent_at IS NULL — without it a host could overwrite a guest who declined',
  );
  assert.equal(eqVal(consentUpdate.filters, 'id'), PARTY, 'and must be scoped to this party only');
});

test('a guest who already decided is left untouched (update matches no rows)', async () => {
  // The guarded update returning zero rows IS the refusal path: the guest had a
  // stamped sms_consent_at, so the host attestation silently does not apply.
  scriptAddGuest({ attestationMatchedRows: [] });

  const result = await guestService.addGuest({
    eventId: EVENT, actorUserId: ACTOR, fullName: 'Alice', phone: '+15551234567',
    smsConsentAttested: true,
  });

  assert.equal(result.success, true, 'the add itself still succeeds');
  assert.equal(mock.calls.some(c => c.table === 'sms_consent_log'), false,
    'and nothing is logged as consent, because none was granted');
});

test('adding a COMPANION to an existing party never attests consent', async () => {
  // SMS targets the party's primary contact, so a companion's number is not the
  // number that would be messaged — attesting here would attach this person's
  // consent to somebody else's phone.
  const updates = scriptAddGuest();

  await guestService.addGuest({
    eventId: EVENT, actorUserId: ACTOR, fullName: 'Bob', phone: '+15559998888',
    partyId: PARTY, smsConsentAttested: true,
  });

  assert.equal(updates.some(u => u.payload && 'sms_consent' in u.payload), false,
    'a companion add must never write consent onto the party');
});

/* ── Failure isolation ─────────────────────────────────────────────────── */

test('a failed attestation write never fails the add (number stays unmessageable)', async () => {
  mock.setResolver((s) => {
    if (s.op === 'rpc' && s.fn === 'add_guest_to_party') {
      return { data: { success: true, party_id: PARTY, guest_id: 'g1' } };
    }
    if (s.table === 'rsvp_parties' && s.op === 'update') {
      return { error: { message: 'column does not exist' } };
    }
    return {};
  });

  const result = await guestService.addGuest({
    eventId: EVENT, actorUserId: ACTOR, fullName: 'Alice', phone: '+15551234567',
    smsConsentAttested: true,
  });

  assert.equal(result.success, true, 'the guest must still be added');
});

/* ── The edit surface (fixing a guest attested after the fact) ─────────── */

test('updateParty attests using the party\'s current primary phone', async () => {
  const updates = [];
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties' && s.op === 'update') {
      updates.push({ payload: s.payload, filters: s.filters });
      return { data: [{ id: PARTY }] };
    }
    if (s.table === 'rsvp_parties') return { data: { id: PARTY }, terminal: s.terminal };
    if (s.table === 'guests' && s.op === 'select') {
      return { data: [{ phone: '+15551234567' }] };
    }
    return {};
  });

  await guestService.updateParty(EVENT, PARTY, {
    notes: 'x', smsConsentAttested: true, actorUserId: ACTOR,
  });

  const consentUpdate = updates.find(u => u.payload && 'sms_consent' in u.payload);
  assert.ok(consentUpdate, 'the edit surface must be able to record an attestation');
  assert.equal(consentUpdate.payload.sms_consent_method, 'host_attested');
  assert.equal(consentUpdate.payload.sms_consent_attested_by, ACTOR);
  assert.ok(
    (consentUpdate.filters.is || []).some(([c, v]) => c === 'sms_consent_at' && v === null),
    'the same IS NULL guard must protect the edit path',
  );
});

test('updateParty without the attestation never touches consent', async () => {
  const updates = [];
  mock.setResolver((s) => {
    if (s.table === 'rsvp_parties' && s.op === 'update') {
      updates.push({ payload: s.payload });
      return { data: [{ id: PARTY }] };
    }
    return {};
  });

  await guestService.updateParty(EVENT, PARTY, { notes: 'x', actorUserId: ACTOR });

  assert.equal(updates.some(u => u.payload && 'sms_consent' in u.payload), false);
});

/* ── Bulk import threads the same attestation ──────────────────────────── */

test('importGuests applies the attestation per row, tagged as a CSV import', async () => {
  const updates = scriptAddGuest();

  await guestService.importGuests(
    EVENT, ACTOR,
    [{ guest_name: 'Alice', phone: '+15551234567' }],
    { smsConsentAttested: true },
  );

  const consentUpdate = updates.find(u => u.payload && 'sms_consent' in u.payload);
  assert.ok(consentUpdate, 'an attested import must record consent');
  assert.equal(consentUpdate.payload.sms_consent_source, 'host_csv_import',
    'provenance must distinguish an import from a manual add');
});

test('importGuests without the attestation records no consent', async () => {
  const updates = scriptAddGuest();

  await guestService.importGuests(
    EVENT, ACTOR,
    [{ guest_name: 'Alice', phone: '+15551234567' }],
    { smsConsentAttested: false },
  );

  assert.equal(updates.some(u => u.payload && 'sms_consent' in u.payload), false);
});
