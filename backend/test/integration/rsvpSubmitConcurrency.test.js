const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { ENABLED, SKIP_REASON, uid, makePool, seedEvent, seedFormField, seedTable, seedParty, cleanup } = require('./helpers/db');

const itest = (name, fn) => (ENABLED ? test(name, fn) : test(name, { skip: SKIP_REASON }, () => {}));

let pool;
before(() => { if (ENABLED) pool = makePool(30); });
after(async () => { if (pool) await pool.end(); });

// Calls submit_rsvp_v2 with sensible defaults; override per test. Schema note:
// the public RSVP RPC writes rsvp_parties + guests (not the dropped flat
// `rsvps` table) as of 20260705000000_guest_experience_rebuild.sql, and its
// final signature (20260718000000_rsvp_sms_consent.sql) adds trailing
// p_side/p_sms_consent params — both default-able, but passed explicitly
// here so the call is unambiguous regardless of which migration order the
// target DB applied them in.
function callSubmit(params = {}) {
  const p = {
    slug: null, partyId: null, guestName: 'Guest', email: null, phone: null,
    response: 'yes', partySize: 1, notes: null, primaryMeal: null,
    additionalGuests: [], customAnswers: [], declineReason: null, maybeConfirmBy: null,
    side: null, smsConsent: false,
    ...params,
  };
  return pool
    .query(
      `SELECT submit_rsvp_v2($1::text,$2::uuid,$3::text,$4::text,$5::text,$6::text,$7::int,$8::text,$9::text,$10::jsonb,$11::jsonb,$12::text,$13::text,$14::text,$15::boolean) AS r`,
      [p.slug, p.partyId, p.guestName, p.email, p.phone, p.response, p.partySize, p.notes, p.primaryMeal,
        JSON.stringify(p.additionalGuests), JSON.stringify(p.customAnswers), p.declineReason, p.maybeConfirmBy,
        p.side, p.smsConsent],
    )
    .then((res) => res.rows[0].r);
}

const countParties = async (eventId) =>
  Number((await pool.query('SELECT count(*)::int AS n FROM rsvp_parties WHERE event_id = $1', [eventId])).rows[0].n);

const countPrimaryEmailMatches = async (eventId, email) =>
  Number((await pool.query(
    `SELECT count(*)::int AS n FROM guests g JOIN rsvp_parties p ON p.id = g.party_id
      WHERE p.event_id = $1 AND g.is_primary_contact AND lower(g.email) = lower($2)`,
    [eventId, email],
  )).rows[0].n);

const countCommittedGuests = async (eventId) =>
  Number((await pool.query(
    `SELECT COALESCE(SUM(gc.cnt), 0)::int AS n
       FROM rsvp_parties p
       JOIN LATERAL (SELECT COUNT(*) AS cnt FROM guests g WHERE g.party_id = p.id) gc ON true
      WHERE p.event_id = $1 AND p.response IN ('yes', 'maybe')`,
    [eventId],
  )).rows[0].n);

// ─────────────────────────────────────────────────────────────────────────────
// Happy path + atomic child rows
// ─────────────────────────────────────────────────────────────────────────────

itest('a valid attending RSVP writes the party + all guest rows atomically and returns event/org context', async () => {
  const { userId, eventId, slug } = await seedEvent(pool);
  try {
    const r = await callSubmit({
      slug, guestName: 'Alice', email: 'alice@x.com', response: 'yes', partySize: 3,
      additionalGuests: [{ fullName: 'Bob' }, { fullName: 'Cara' }],
    });
    assert.equal(r.success, true);
    assert.equal(r.is_update, false);
    assert.equal(r.party_size, 3);
    assert.equal(r.event_id, eventId);
    assert.ok(r.org_email, 'org contact returned for the caller to email without an extra query');

    const guests = (await pool.query(
      'SELECT count(*)::int AS n, sum((is_primary_contact)::int) AS p FROM guests WHERE party_id = $1', [r.party_id],
    )).rows[0];
    assert.equal(Number(guests.n), 3, 'primary + 2 additional guest rows');
    assert.equal(Number(guests.p), 1, 'exactly one primary');
  } finally {
    await cleanup(pool, userId);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Gating
// ─────────────────────────────────────────────────────────────────────────────

itest('gating: unpaid → PAYMENT_REQUIRED, pending_review → EVENT_UNDER_REVIEW, past deadline → DEADLINE_PASSED', async () => {
  const unpaid = await seedEvent(pool, { paid: false });
  const review = await seedEvent(pool, { paid: true, status: 'pending_review' });
  const expired = await seedEvent(pool, { paid: true, status: 'active', rsvpDeadline: new Date(Date.now() - 86400000).toISOString() });
  try {
    assert.equal((await callSubmit({ slug: unpaid.slug, email: 'a@x.com' })).code, 'PAYMENT_REQUIRED');
    assert.equal((await callSubmit({ slug: review.slug, email: 'b@x.com' })).code, 'EVENT_UNDER_REVIEW');
    assert.equal((await callSubmit({ slug: expired.slug, email: 'c@x.com' })).code, 'DEADLINE_PASSED');
    // None of the rejected submissions wrote a row.
    assert.equal(await countParties(unpaid.eventId), 0);
    assert.equal(await countParties(review.eventId), 0);
    assert.equal(await countParties(expired.eventId), 0);
  } finally {
    await cleanup(pool, unpaid.userId);
    await cleanup(pool, review.userId);
    await cleanup(pool, expired.userId);
  }
});

itest('an unknown slug returns EVENT_NOT_FOUND', async () => {
  const r = await callSubmit({ slug: `no-such-${uid()}`, email: 'x@x.com' });
  assert.equal(r.code, 'EVENT_NOT_FOUND');
});

itest("the 'demo' event bypasses the payment/review gate even when unpaid", async () => {
  // Requires no pre-existing 'demo' event (true on a fresh local Supabase).
  const demo = await seedEvent(pool, { paid: false, status: 'pending_review', slug: 'demo' });
  try {
    const r = await callSubmit({ slug: 'demo', email: 'guest@x.com', response: 'yes' });
    assert.equal(r.success, true, 'demo accepts RSVPs regardless of payment/review');
  } finally {
    await cleanup(pool, demo.userId);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// THE PROOF: concurrent duplicate emails can never both land
// ─────────────────────────────────────────────────────────────────────────────

itest('ZERO duplicate RSVPs: 30 concurrent first-time submits with the SAME email => exactly 1 accepted', async () => {
  const { userId, eventId, slug } = await seedEvent(pool);
  const email = `dupe_${uid()}@x.com`;
  try {
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) => callSubmit({ slug, guestName: `Racer ${i}`, email, response: 'yes' })),
    );
    const accepted = results.filter((r) => r.success === true).length;
    const dup = results.filter((r) => r.success === false && r.code === 'DUPLICATE_RSVP').length;

    assert.equal(accepted, 1, 'exactly one submission may win');
    assert.equal(dup, 29, 'every other is cleanly told it is a duplicate');

    // Ground truth: a single primary-contact guest row exists for that email.
    assert.equal(await countPrimaryEmailMatches(eventId, email), 1);
  } finally {
    await cleanup(pool, userId);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// THE PROOF: concurrent submissions against a tight guest cap can never
// collectively overshoot it (the per-event advisory-lock fix in
// 20260709000000_submit_rsvp_concurrency_fix.sql — BIZ-1's check-then-act
// guest-cap enforcement was racy before that migration).
// ─────────────────────────────────────────────────────────────────────────────

itest('ZERO cap overshoot: tier_max_guests=5, 15 concurrent first-time "yes" submits => exactly 5 committed', async () => {
  const CAP = 5;
  const ATTEMPTS = 15;
  const { userId, eventId, slug } = await seedEvent(pool, { tierMaxGuests: CAP });
  try {
    const results = await Promise.all(
      Array.from({ length: ATTEMPTS }, (_, i) =>
        callSubmit({ slug, guestName: `Capper ${i}`, email: `cap_${i}_${uid()}@x.com`, response: 'yes', partySize: 1 })),
    );

    const accepted = results.filter((r) => r.success === true).length;
    const rejected = results.filter((r) => r.success === false && r.code === 'GUEST_LIMIT_REACHED').length;

    assert.equal(accepted, CAP, 'exactly the cap worth of submissions may win');
    assert.equal(rejected, ATTEMPTS - CAP, 'the rest are cleanly told the guest limit was reached');

    // Ground truth: the sum of guests across every committed (yes/maybe)
    // party never exceeds the plan's cap, even though every attempt raced
    // the same check-then-act guest-cap read.
    const committed = await countCommittedGuests(eventId);
    assert.ok(committed <= CAP, `committed guests ${committed} must not exceed cap ${CAP}`);
    assert.equal(committed, CAP);
  } finally {
    await cleanup(pool, userId);
  }
});

itest('a party_size > 1 submission is rejected in full (no partial commit) when it would push the cap over', async () => {
  const CAP = 4;
  const { userId, eventId, slug } = await seedEvent(pool, { tierMaxGuests: CAP });
  try {
    // Fill the cap to 2 first.
    const first = await callSubmit({ slug, guestName: 'Filler', email: `filler_${uid()}@x.com`, response: 'yes', partySize: 2 });
    assert.equal(first.success, true);

    // Two concurrent parties of size 2 each would together add 4 more (total 6 > 4).
    // At most one may win (bringing the total to exactly the cap); the loser must
    // be rejected wholesale — no orphaned guest rows from a half-applied insert.
    const results = await Promise.all([
      callSubmit({ slug, guestName: 'PartyA', email: `a_${uid()}@x.com`, response: 'yes', partySize: 2, additionalGuests: [{ fullName: 'A2' }] }),
      callSubmit({ slug, guestName: 'PartyB', email: `b_${uid()}@x.com`, response: 'yes', partySize: 2, additionalGuests: [{ fullName: 'B2' }] }),
    ]);

    const accepted = results.filter((r) => r.success === true).length;
    const rejected = results.filter((r) => r.success === false && r.code === 'GUEST_LIMIT_REACHED').length;
    assert.equal(accepted, 1, 'only one of the two size-2 parties can fit under the cap');
    assert.equal(rejected, 1);

    const committed = await countCommittedGuests(eventId);
    assert.equal(committed, CAP, 'ground truth: committed guests land exactly at the cap, never over');
  } finally {
    await cleanup(pool, userId);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Meal validation (now atomic, inside the transaction; matched via is_meal_field)
// ─────────────────────────────────────────────────────────────────────────────

itest('meal validation: required-missing → MEAL_REQUIRED, off-menu → MEAL_INVALID, valid → success', async () => {
  const { userId, eventId, slug } = await seedEvent(pool);
  try {
    await seedFormField(pool, eventId, { key: 'meal_selection', options: ['Beef', 'Fish'], required: true });

    assert.equal((await callSubmit({ slug, email: 'm1@x.com', response: 'yes', primaryMeal: null })).code, 'MEAL_REQUIRED');
    assert.equal((await callSubmit({ slug, email: 'm2@x.com', response: 'yes', primaryMeal: 'Pizza' })).code, 'MEAL_INVALID');

    const ok = await callSubmit({ slug, email: 'm3@x.com', response: 'yes', primaryMeal: 'Beef' });
    assert.equal(ok.success, true);

    // Additional guest missing a required meal is rejected and writes nothing.
    const before = await countParties(eventId);
    const r = await callSubmit({
      slug, email: 'm4@x.com', response: 'yes', partySize: 2, primaryMeal: 'Beef',
      additionalGuests: [{ fullName: 'Plus One' }], // no meal
    });
    assert.equal(r.code, 'MEAL_REQUIRED');
    assert.equal(await countParties(eventId), before, 'a meal rejection is fully rolled back');
  } finally {
    await cleanup(pool, userId);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Update path: ownership + seating cleanup on decline
// ─────────────────────────────────────────────────────────────────────────────

itest('update path: matching email updates in place; wrong email is RSVP_OWNERSHIP_FAILED', async () => {
  const { userId, slug } = await seedEvent(pool);
  try {
    const created = await callSubmit({ slug, guestName: 'Dana', email: 'dana@x.com', response: 'yes', partySize: 1 });
    assert.equal(created.success, true);

    const wrong = await callSubmit({ slug, partyId: created.party_id, email: 'intruder@x.com', response: 'no' });
    assert.equal(wrong.code, 'RSVP_OWNERSHIP_FAILED');

    const updated = await callSubmit({ slug, partyId: created.party_id, email: 'dana@x.com', response: 'yes', partySize: 4 });
    assert.equal(updated.success, true);
    assert.equal(updated.is_update, true);
    assert.equal(updated.party_size, 4);
  } finally {
    await cleanup(pool, userId);
  }
});

itest('updating an attending guest to "no" releases their seat assignment', async () => {
  const { userId, eventId, slug } = await seedEvent(pool);
  try {
    const created = await callSubmit({ slug, guestName: 'Eli', email: 'eli@x.com', response: 'yes', partySize: 1 });
    const tableId = await seedTable(pool, eventId, 8);
    const assign = (await pool.query('SELECT assign_seat($1::uuid,$2::uuid,$3::uuid,$4::uuid,false) AS r', [eventId, created.party_id, tableId, userId])).rows[0].r;
    assert.equal(assign.success, true);

    const seatedBefore = (await pool.query('SELECT count(*)::int AS n FROM seating_assignments WHERE party_id = $1', [created.party_id])).rows[0].n;
    assert.equal(Number(seatedBefore), 1);

    const declined = await callSubmit({ slug, partyId: created.party_id, email: 'eli@x.com', response: 'no' });
    assert.equal(declined.success, true);

    const seatedAfter = (await pool.query('SELECT count(*)::int AS n FROM seating_assignments WHERE party_id = $1', [created.party_id])).rows[0].n;
    assert.equal(Number(seatedAfter), 0, 'declining frees the seat in the same transaction');
  } finally {
    await cleanup(pool, userId);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Custom answers: valid ones persist, malformed field ids are skipped (no abort)
// ─────────────────────────────────────────────────────────────────────────────

itest('custom answers persist for valid field ids and reject malformed ones', async () => {
  const { userId, eventId, slug } = await seedEvent(pool);
  try {
    const fieldId = await seedFormField(pool, eventId, { key: 'song_request', label: 'Song', type: 'text' });
    const r = await callSubmit({
      slug, email: 'ca@x.com', response: 'yes',
      customAnswers: [{ fieldId, value: 'Sweet Caroline' }],
    });
    assert.equal(r.success, true);

    const answers = (await pool.query('SELECT field_id, answer_value FROM custom_answers WHERE party_id = $1', [r.party_id])).rows;
    assert.equal(answers.length, 1, 'the valid field id is stored');
    assert.equal(answers[0].field_id, fieldId);
    assert.equal(answers[0].answer_value, 'Sweet Caroline');

    // A malformed / unknown fieldId is now an explicit rejection (CUSTOM_ANSWER_INVALID),
    // not a silent drop — see 20260710000000_submit_rsvp_custom_answer_validation.sql.
    const bad = await callSubmit({
      slug, email: 'ca2@x.com', response: 'yes',
      customAnswers: [{ fieldId: 'not-a-uuid', value: 'ignored' }],
    });
    assert.equal(bad.code, 'CUSTOM_ANSWER_INVALID');
  } finally {
    await cleanup(pool, userId);
  }
});
