const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { ENABLED, SKIP_REASON, uid, makePool, seedEvent, seedFormField, seedTable, cleanup } = require('./helpers/db');

const itest = (name, fn) => (ENABLED ? test(name, fn) : test(name, { skip: SKIP_REASON }, () => {}));

let pool;
before(() => { if (ENABLED) pool = makePool(30); });
after(async () => { if (pool) await pool.end(); });

// Calls submit_rsvp with sensible defaults; override per test.
function callSubmit(params = {}) {
  const p = {
    slug: null, rsvpId: null, guestName: 'Guest', email: null, phone: null,
    response: 'yes', partySize: 1, notes: null, primaryMeal: null,
    additionalGuests: [], customAnswers: [], declineReason: null, maybeConfirmBy: null,
    ...params,
  };
  return pool
    .query(
      `SELECT submit_rsvp($1::text,$2::uuid,$3::text,$4::text,$5::text,$6::text,$7::int,$8::text,$9::text,$10::jsonb,$11::jsonb,$12::text,$13::text) AS r`,
      [p.slug, p.rsvpId, p.guestName, p.email, p.phone, p.response, p.partySize, p.notes, p.primaryMeal,
        JSON.stringify(p.additionalGuests), JSON.stringify(p.customAnswers), p.declineReason, p.maybeConfirmBy],
    )
    .then((res) => res.rows[0].r);
}

const countRsvps = async (eventId) =>
  Number((await pool.query('SELECT count(*)::int AS n FROM rsvps WHERE event_id = $1', [eventId])).rows[0].n);

// ─────────────────────────────────────────────────────────────────────────────
// Happy path + atomic child rows
// ─────────────────────────────────────────────────────────────────────────────

itest('a valid attending RSVP writes the rsvp + all guest rows atomically and returns event/org context', async () => {
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

    const guests = (await pool.query('SELECT count(*)::int AS n, sum((is_primary)::int) AS p FROM rsvp_guests WHERE rsvp_id = $1', [r.rsvp_id])).rows[0];
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
    assert.equal(await countRsvps(unpaid.eventId), 0);
    assert.equal(await countRsvps(review.eventId), 0);
    assert.equal(await countRsvps(expired.eventId), 0);
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

    // Ground truth: a single row exists for that email.
    const rows = (await pool.query(
      `SELECT count(*)::int AS n FROM rsvps WHERE event_id = $1 AND lower(email) = lower($2)`, [eventId, email],
    )).rows[0];
    assert.equal(Number(rows.n), 1);
  } finally {
    await cleanup(pool, userId);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Meal validation (now atomic, inside the transaction)
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
    const before = await countRsvps(eventId);
    const r = await callSubmit({
      slug, email: 'm4@x.com', response: 'yes', partySize: 2, primaryMeal: 'Beef',
      additionalGuests: [{ fullName: 'Plus One' }], // no meal
    });
    assert.equal(r.code, 'MEAL_REQUIRED');
    assert.equal(await countRsvps(eventId), before, 'a meal rejection is fully rolled back');
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

    const wrong = await callSubmit({ slug, rsvpId: created.rsvp_id, email: 'intruder@x.com', response: 'no' });
    assert.equal(wrong.code, 'RSVP_OWNERSHIP_FAILED');

    const updated = await callSubmit({ slug, rsvpId: created.rsvp_id, email: 'dana@x.com', response: 'yes', partySize: 4 });
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
    const assign = (await pool.query('SELECT assign_seat($1::uuid,$2::uuid,$3::uuid,$4::uuid,false) AS r', [eventId, created.rsvp_id, tableId, userId])).rows[0].r;
    assert.equal(assign.success, true);

    const seatedBefore = (await pool.query('SELECT count(*)::int AS n FROM seating_assignments WHERE rsvp_id = $1', [created.rsvp_id])).rows[0].n;
    assert.equal(Number(seatedBefore), 1);

    const declined = await callSubmit({ slug, rsvpId: created.rsvp_id, email: 'eli@x.com', response: 'no' });
    assert.equal(declined.success, true);

    const seatedAfter = (await pool.query('SELECT count(*)::int AS n FROM seating_assignments WHERE rsvp_id = $1', [created.rsvp_id])).rows[0].n;
    assert.equal(Number(seatedAfter), 0, 'declining frees the seat in the same transaction');
  } finally {
    await cleanup(pool, userId);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Custom answers: valid ones persist, malformed field ids are skipped (no abort)
// ─────────────────────────────────────────────────────────────────────────────

itest('custom answers persist for valid field ids and skip malformed ones without failing', async () => {
  const { userId, eventId, slug } = await seedEvent(pool);
  try {
    const fieldId = await seedFormField(pool, eventId, { key: 'song_request', label: 'Song', type: 'text' });
    const r = await callSubmit({
      slug, email: 'ca@x.com', response: 'yes',
      customAnswers: [{ fieldId, value: 'Sweet Caroline' }, { fieldId: 'not-a-uuid', value: 'ignored' }],
    });
    assert.equal(r.success, true);

    const answers = (await pool.query('SELECT field_id, answer_value FROM custom_answers WHERE rsvp_id = $1', [r.rsvp_id])).rows;
    assert.equal(answers.length, 1, 'only the valid field id is stored');
    assert.equal(answers[0].field_id, fieldId);
    assert.equal(answers[0].answer_value, 'Sweet Caroline');
  } finally {
    await cleanup(pool, userId);
  }
});
