require('./helpers/env');
const { test } = require('node:test');
const t = require('node:test');
const assert = require('node:assert/strict');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { injectModule } = require('./helpers/inject');

/**
 * A TEXTED INVITATION HAS TO LEAVE A LEDGER ROW.
 *
 * Every other channel wrote one to `invitations`; the SMS path never did, and
 * nothing broke — which is why it survived. A missing row does not throw, it
 * just makes a question un-answerable:
 *
 *   • the dashboard derives `invitation_sent_sms` from
 *     `invitations.channel === 'sms'` (frontend page.js), so that flag was FALSE
 *     for every guest on the platform, forever;
 *   • the Guest list's "Invitations Sent" tile counts those rows, so an
 *     organizer who invited their whole list by text saw zero.
 *
 * `'sms'` has been a legal `invitation_channel_type` since the guest-experience
 * rebuild, so this was always a missing write rather than a missing column.
 *
 * The second half of the contract matters as much as the first: the SAME
 * function also sends the "all their details" confirmation, and recording THAT
 * as an invitation would mark guests as invited who were never sent one.
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });

let smsOutcome = { sent: true, sid: 'SM123', credits: 2 };
injectModule('../../services/smsDispatch', {
  sendTransactionalSms: async () => smsOutcome,
});
injectModule('../../controllers/campaignController', {
  resolveSendLimit: async () => ({ maxPerSend: 0 }),
});

const invitationService = require('../services/invitationService');

const EVENT = '11111111-1111-4111-8111-111111111111';
const PARTY = '22222222-2222-4222-8222-222222222222';

/** Scripts a live, texting-enabled event with one accepted party on it. */
function scriptEvent() {
  const inserts = [];
  mock.setResolver((s) => {
    if (s.table === 'events' && s.op === 'select') {
      return {
        data: {
          id: EVENT, title: 'Wedding', slug: 'wedding',
          event_date: '2026-12-01T18:00:00Z',
          location_name: 'The Hall', location_address: null,
          sms_addon_purchased_at: '2026-01-01T00:00:00Z',
          sms_settings: {},
        },
      };
    }
    if (s.table === 'rsvp_parties' && s.op === 'select') {
      return {
        data: [{
          id: PARTY, label: 'Sara', preferred_lang: 'en', response: 'yes',
          companion_meal_counts: {},
          guests: [{ full_name: 'Sara', is_primary_contact: true, meal_selection: null }],
          seating_assignments: [],
        }],
      };
    }
    if (s.table === 'invitations' && s.op === 'insert') {
      inserts.push(s.payload);
      return { data: { id: 'inv-1' } };
    }
    return {};
  });
  return inserts;
}

t.beforeEach(() => {
  mock.reset();
  smsOutcome = { sent: true, sid: 'SM123', credits: 2 };
});

test('a sent invitation text writes an invitations row on the sms channel', async () => {
  const inserts = scriptEvent();

  const result = await invitationService.sendInvitationSmsBulk(EVENT, [PARTY], { type: 'invitation' });

  assert.equal(result.sent, 1);
  assert.equal(inserts.length, 1, 'exactly one ledger row per texted invitation');
  assert.deepEqual(
    { party_id: inserts[0].party_id, event_id: inserts[0].event_id, channel: inserts[0].channel, status: inserts[0].status },
    { party_id: PARTY, event_id: EVENT, channel: 'sms', status: 'sent' },
  );
  assert.ok(inserts[0].sent_at, 'a sent row is timestamped, same as the email channel');
});

test('the carrier id and what it cost ride along on the row', async () => {
  const inserts = scriptEvent();

  await invitationService.sendInvitationSmsBulk(EVENT, [PARTY], { type: 'invitation' });

  assert.equal(inserts[0].metadata.sid, 'SM123');
  assert.equal(inserts[0].metadata.credits, 2);
});

test('a text that did NOT send writes nothing', async () => {
  // The ledger records deliveries, not attempts to deliver. A row for a message
  // the carrier refused would show the guest as invited when they were not — the
  // exact inverse of the bug this write fixes.
  smsOutcome = { sent: false, reason: 'NO_CONSENT' };
  const inserts = scriptEvent();

  const result = await invitationService.sendInvitationSmsBulk(EVENT, [PARTY], { type: 'invitation' });

  assert.equal(result.sent, 0);
  assert.equal(inserts.length, 0);
});

test('the "all their details" text is NOT recorded as an invitation', async () => {
  // Same function, different message. That one confirms an answer the guest has
  // already given; logging it here would mark them invited on a channel that
  // never carried an invitation to them.
  const inserts = scriptEvent();

  await invitationService.sendInvitationSmsBulk(EVENT, [PARTY], { type: 'rsvp_confirmation' });

  assert.equal(inserts.length, 0);
});
