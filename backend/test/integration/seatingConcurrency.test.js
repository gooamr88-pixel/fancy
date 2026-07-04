const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { ENABLED, SKIP_REASON, makePool, seedEvent, seedTable, seedParty, cleanup } = require('./helpers/db');

const itest = (name, fn) => (ENABLED ? test(name, fn) : test(name, { skip: SKIP_REASON }, () => {}));

let pool;
before(() => { if (ENABLED) pool = makePool(30); });
after(async () => { if (pool) await pool.end(); });

/**
 * Sum of guest counts currently seated at a table — the real occupancy.
 * Mirrors assign_seat/reassign_seat's own occupancy computation (guests
 * joined via seating_assignments.party_id, since party_size no longer lives
 * as a column — it's a live COUNT(guests) post the guest-experience rebuild).
 */
async function occupancy(tableId) {
  const r = await pool.query(
    `SELECT COALESCE(SUM(gc.cnt), 0)::int AS n
       FROM seating_assignments sa
       JOIN LATERAL (SELECT COUNT(*) AS cnt FROM guests g WHERE g.party_id = sa.party_id) gc ON true
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
    const partyIds = [];
    for (let i = 0; i < GUESTS; i++) partyIds.push(await seedParty(pool, eventId, { partySize: 1 }));

    const results = await Promise.all(
      partyIds.map((pid) =>
        pool
          .query('SELECT assign_seat($1::uuid, $2::uuid, $3::uuid, $4::uuid, false) AS r', [eventId, pid, tableId, userId])
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
    const partyIds = [];
    for (let i = 0; i < PARTIES; i++) partyIds.push(await seedParty(pool, eventId, { partySize: PARTY }));

    const results = await Promise.all(
      partyIds.map((pid) =>
        pool
          .query('SELECT assign_seat($1::uuid, $2::uuid, $3::uuid, $4::uuid, false) AS r', [eventId, pid, tableId, userId])
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

itest('a party can never be double-assigned even if their requests race (UNIQUE event_id,party_id)', async () => {
  const { userId, eventId } = await seedEvent(pool);
  try {
    const tableId = await seedTable(pool, eventId, 10);
    const partyId = await seedParty(pool, eventId, { partySize: 1 });

    // Fire the SAME party at the SAME table 10x concurrently.
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        pool
          .query('SELECT assign_seat($1::uuid, $2::uuid, $3::uuid, $4::uuid, false) AS r', [eventId, partyId, tableId, userId])
          .then((res) => ({ ok: true, r: res.rows[0].r }))
          .catch((e) => ({ ok: false, e: e.message })),
      ),
    );

    const successes = results.filter((x) => x.ok && x.r.success === true).length;
    assert.equal(successes, 1, 'exactly one assignment wins; the rest see ALREADY_ASSIGNED');
    assert.ok(results.every((x) => x.ok), 'no raw DB error ever reaches the caller — every race resolves to a clean JSONB result');

    const rows = (await pool.query('SELECT count(*)::int AS n FROM seating_assignments WHERE event_id = $1 AND party_id = $2', [eventId, partyId])).rows[0];
    assert.equal(rows.n, 1, 'the UNIQUE(event_id,party_id) constraint allows a single seat');
  } finally {
    await cleanup(pool, userId);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// THE PROOF (new): 20260720000000_seating_party_lock_fix.sql — assign_seat's
// advisory lock used to be keyed ONLY on p_table_id, so two concurrent calls
// assigning the SAME party to two DIFFERENT tables acquired locks on
// different hash keys and never serialized against each other. Both passed
// the "already assigned" pre-check, both attempted the INSERT, and the
// loser's raw 23505 unique_violation used to propagate as an unhandled DB
// error instead of a clean ALREADY_ASSIGNED. The fix adds a
// pg_advisory_xact_lock(hashtext(p_party_id::text)) taken BEFORE the table
// lock, so this race now always serializes and resolves cleanly.
// ─────────────────────────────────────────────────────────────────────────────

itest('same party, two different tables, concurrently: exactly one success + one clean ALREADY_ASSIGNED (no raw DB error)', async () => {
  const { userId, eventId } = await seedEvent(pool);
  try {
    const tableA = await seedTable(pool, eventId, 10);
    const tableB = await seedTable(pool, eventId, 10);
    const partyId = await seedParty(pool, eventId, { partySize: 1 });

    // Fire the SAME party at TWO DIFFERENT tables simultaneously — this is
    // exactly the race 20260720000000 fixes (table-keyed locks alone don't
    // serialize this, since the two calls target different hash keys).
    const results = await Promise.all([
      pool.query('SELECT assign_seat($1::uuid, $2::uuid, $3::uuid, $4::uuid, false) AS r', [eventId, partyId, tableA, userId])
        .then((res) => ({ ok: true, r: res.rows[0].r }))
        .catch((e) => ({ ok: false, e: e.message, code: e.code })),
      pool.query('SELECT assign_seat($1::uuid, $2::uuid, $3::uuid, $4::uuid, false) AS r', [eventId, partyId, tableB, userId])
        .then((res) => ({ ok: true, r: res.rows[0].r }))
        .catch((e) => ({ ok: false, e: e.message, code: e.code })),
    ]);

    // Neither call may surface a raw Postgres error (e.g. 23505 unique_violation) —
    // both must come back as normal query results with a JSONB {success,...} body.
    assert.ok(results.every((x) => x.ok), `no raw DB error should propagate to the client; got: ${JSON.stringify(results)}`);

    const succeeded = results.filter((x) => x.r.success === true);
    const failed = results.filter((x) => x.r.success === false);
    assert.equal(succeeded.length, 1, 'exactly one of the two concurrent assignments wins');
    assert.equal(failed.length, 1, 'the other is cleanly rejected');
    assert.equal(failed[0].r.error, 'ALREADY_ASSIGNED', 'the loser gets the same clean conflict code as the same-table race, not a generic DB error');

    // Ground truth: exactly one seating_assignments row for this party, at
    // whichever table won.
    const rows = (await pool.query('SELECT table_id FROM seating_assignments WHERE event_id = $1 AND party_id = $2', [eventId, partyId])).rows;
    assert.equal(rows.length, 1, 'the party ends up seated at exactly one table');
    assert.ok([tableA, tableB].includes(rows[0].table_id));
  } finally {
    await cleanup(pool, userId);
  }
});

itest('same party, two different tables via reassign_seat racing assign_seat: still resolves to one seat, no raw DB error', async () => {
  // A second angle on the same invariant: one caller tries a fresh assign_seat
  // to table B while another concurrently reassigns the party from its
  // current table A to table C. reassign_seat also takes the party lock
  // first (per the same migration), so this must resolve as cleanly as the
  // assign/assign race above.
  const { userId, eventId } = await seedEvent(pool);
  try {
    const tableA = await seedTable(pool, eventId, 10);
    const tableC = await seedTable(pool, eventId, 10);
    const partyId = await seedParty(pool, eventId, { partySize: 1 });

    const initial = (await pool.query('SELECT assign_seat($1::uuid, $2::uuid, $3::uuid, $4::uuid, false) AS r', [eventId, partyId, tableA, userId])).rows[0].r;
    assert.equal(initial.success, true);

    const tableB = await seedTable(pool, eventId, 10);

    const results = await Promise.all([
      pool.query('SELECT assign_seat($1::uuid, $2::uuid, $3::uuid, $4::uuid, false) AS r', [eventId, partyId, tableB, userId])
        .then((res) => ({ ok: true, r: res.rows[0].r }))
        .catch((e) => ({ ok: false, e: e.message })),
      pool.query('SELECT reassign_seat($1::uuid, $2::uuid, $3::uuid, $4::uuid, false) AS r', [eventId, partyId, tableC, userId])
        .then((res) => ({ ok: true, r: res.rows[0].r }))
        .catch((e) => ({ ok: false, e: e.message })),
    ]);

    assert.ok(results.every((x) => x.ok), 'no raw DB error propagates from either call');
    const rows = (await pool.query('SELECT count(*)::int AS n FROM seating_assignments WHERE event_id = $1 AND party_id = $2', [eventId, partyId])).rows[0];
    assert.equal(rows.n, 1, 'the party ends up with exactly one seating_assignments row');
  } finally {
    await cleanup(pool, userId);
  }
});

itest('force-override deliberately allows overbooking (capacity 1, 3 forced => all 3 seated)', async () => {
  const { userId, eventId } = await seedEvent(pool);
  try {
    const tableId = await seedTable(pool, eventId, 1);
    const partyIds = [];
    for (let i = 0; i < 3; i++) partyIds.push(await seedParty(pool, eventId, { partySize: 1 }));

    const results = await Promise.all(
      partyIds.map((pid) =>
        pool
          .query('SELECT assign_seat($1::uuid, $2::uuid, $3::uuid, $4::uuid, true) AS r', [eventId, pid, tableId, userId])
          .then((res) => res.rows[0].r),
      ),
    );

    assert.equal(results.filter((r) => r.success === true).length, 3, 'force bypasses the capacity assertion for all');
    assert.equal(await occupancy(tableId), 3, 'deliberate overbooking is recorded faithfully');
  } finally {
    await cleanup(pool, userId);
  }
});
