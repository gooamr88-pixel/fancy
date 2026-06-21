const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { ENABLED, SKIP_REASON, makePool, seedEvent, seedTable, seedRsvp, cleanup } = require('./helpers/db');

const itest = (name, fn) => (ENABLED ? test(name, fn) : test(name, { skip: SKIP_REASON }, () => {}));

let pool;
before(() => { if (ENABLED) pool = makePool(30); });
after(async () => { if (pool) await pool.end(); });

/** Sum of party sizes currently seated at a table — the real occupancy. */
async function occupancy(tableId) {
  const r = await pool.query(
    `SELECT COALESCE(SUM(r.party_size), 0)::int AS n
       FROM seating_assignments sa JOIN rsvps r ON r.id = sa.rsvp_id
      WHERE sa.table_id = $1`,
    [tableId],
  );
  return r.rows[0].n;
}

// ─────────────────────────────────────────────────────────────────────────────
// assign_seat — pg_advisory_xact_lock(hashtext(table_id)) serialises assignments
// to the SAME table, so its capacity assertion can never be raced past.
// ─────────────────────────────────────────────────────────────────────────────

itest('ZERO overbooking: capacity 8, 25 guests rush one table simultaneously => exactly 8 seated', async () => {
  const CAP = 8;
  const GUESTS = 25;
  const { userId, eventId } = await seedEvent(pool);
  try {
    const tableId = await seedTable(pool, eventId, CAP);
    const rsvpIds = [];
    for (let i = 0; i < GUESTS; i++) rsvpIds.push(await seedRsvp(pool, eventId, { partySize: 1 }));

    const results = await Promise.all(
      rsvpIds.map((rid) =>
        pool
          .query('SELECT assign_seat($1::uuid, $2::uuid, $3::uuid, $4::uuid, false) AS r', [eventId, rid, tableId, userId])
          .then((res) => res.rows[0].r),
      ),
    );

    const seated = results.filter((r) => r.success === true).length;
    const rejected = results.filter((r) => r.success === false && r.error === 'CAPACITY_EXCEEDED').length;

    assert.equal(seated, CAP, 'exactly capacity guests are seated');
    assert.equal(rejected, GUESTS - CAP, 'the rest are cleanly told the table is full');

    // Ground truth: physical occupancy never exceeds capacity.
    const occ = await occupancy(tableId);
    assert.ok(occ <= CAP, `occupancy ${occ} must not exceed capacity ${CAP}`);
    assert.equal(occ, CAP);
  } finally {
    await cleanup(pool, userId);
  }
});

itest('party-size math holds under contention: capacity 4, parties of 2, 5 rush => exactly 2 parties (4 seats)', async () => {
  const CAP = 4;
  const PARTY = 2;
  const PARTIES = 5;
  const { userId, eventId } = await seedEvent(pool);
  try {
    const tableId = await seedTable(pool, eventId, CAP);
    const rsvpIds = [];
    for (let i = 0; i < PARTIES; i++) rsvpIds.push(await seedRsvp(pool, eventId, { partySize: PARTY }));

    const results = await Promise.all(
      rsvpIds.map((rid) =>
        pool
          .query('SELECT assign_seat($1::uuid, $2::uuid, $3::uuid, $4::uuid, false) AS r', [eventId, rid, tableId, userId])
          .then((res) => res.rows[0].r),
      ),
    );

    const seated = results.filter((r) => r.success === true).length;
    assert.equal(seated, CAP / PARTY, 'only whole parties that fit are seated (no partial seating)');
    assert.equal(await occupancy(tableId), CAP, 'the table fills to exactly capacity, never over');
  } finally {
    await cleanup(pool, userId);
  }
});

itest('a guest can never be double-assigned even if their requests race (UNIQUE event_id,rsvp_id)', async () => {
  const { userId, eventId } = await seedEvent(pool);
  try {
    const tableId = await seedTable(pool, eventId, 10);
    const rsvpId = await seedRsvp(pool, eventId, { partySize: 1 });

    // Fire the SAME guest at the SAME table 10x concurrently.
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        pool
          .query('SELECT assign_seat($1::uuid, $2::uuid, $3::uuid, $4::uuid, false) AS r', [eventId, rsvpId, tableId, userId])
          .then((res) => ({ ok: true, r: res.rows[0].r }))
          .catch((e) => ({ ok: false, e: e.message })),
      ),
    );

    const successes = results.filter((x) => x.ok && x.r.success === true).length;
    assert.equal(successes, 1, 'exactly one assignment wins; the rest see ALREADY_ASSIGNED');

    const rows = (await pool.query('SELECT count(*)::int AS n FROM seating_assignments WHERE event_id = $1 AND rsvp_id = $2', [eventId, rsvpId])).rows[0];
    assert.equal(rows.n, 1, 'the UNIQUE(event_id,rsvp_id) constraint allows a single seat');
  } finally {
    await cleanup(pool, userId);
  }
});

itest('force-override deliberately allows overbooking (capacity 1, 3 forced => all 3 seated)', async () => {
  const { userId, eventId } = await seedEvent(pool);
  try {
    const tableId = await seedTable(pool, eventId, 1);
    const rsvpIds = [];
    for (let i = 0; i < 3; i++) rsvpIds.push(await seedRsvp(pool, eventId, { partySize: 1 }));

    const results = await Promise.all(
      rsvpIds.map((rid) =>
        pool
          .query('SELECT assign_seat($1::uuid, $2::uuid, $3::uuid, $4::uuid, true) AS r', [eventId, rid, tableId, userId])
          .then((res) => res.rows[0].r),
      ),
    );

    assert.equal(results.filter((r) => r.success === true).length, 3, 'force bypasses the capacity assertion for all');
    assert.equal(await occupancy(tableId), 3, 'deliberate overbooking is recorded faithfully');
  } finally {
    await cleanup(pool, userId);
  }
});
