/**
 * checkin_batch_upsert / checkin_undo — REAL Postgres.
 *
 * This file is the Phase 1 definition of done: "the batch endpoint provably
 * handles replay, duplicate, and conflict cases under automated test."
 *
 * It cannot be done in the unit suite. The replay/duplicate/conflict decisions
 * live in plpgsql, and the guarantees being tested are the partial unique
 * index, the advisory lock, and transactional sequence allocation — all of
 * which a mocked Supabase client would happily pretend to honour while proving
 * nothing.
 *
 * Skips (does not fail) when INTEGRATION_DB_URL is unset — see README.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  ENABLED, SKIP_REASON, uid, makePool, seedEvent, seedParty, seedTable, cleanup,
} = require('./helpers/db');

const opts = ENABLED ? {} : { skip: SKIP_REASON };

/** Calls the batch RPC and returns the parsed jsonb result. */
async function batch(pool, eventId, records) {
  const { rows } = await pool.query(
    'SELECT public.checkin_batch_upsert($1::uuid, $2::jsonb) AS out',
    [eventId, JSON.stringify(records)],
  );
  return rows[0].out;
}

async function undo(pool, eventId, clientCheckinId, reason = 'test undo', actor = null) {
  const { rows } = await pool.query(
    'SELECT public.checkin_undo($1::uuid, $2::uuid, $3::uuid, $4::text) AS out',
    [eventId, clientCheckinId, actor, reason],
  );
  return rows[0].out;
}

/** Guest ids of a party, ordered stably. */
async function guestsOf(pool, partyId) {
  const { rows } = await pool.query('SELECT id FROM guests WHERE party_id = $1 ORDER BY id', [partyId]);
  return rows.map((r) => r.id);
}

const byStatus = (res, status) => res.results.filter((r) => r.status === status);

// ══════════════════════════════════════════════════════════════════
// 1. Idempotent replay (§5.4) — the queue must be safe to replay from
//    the beginning at any time
// ══════════════════════════════════════════════════════════════════

test('replaying an identical batch produces exactly one check-in row', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 3 });
    const guests = await guestsOf(pool, partyId);

    const records = guests.map((g) => ({
      client_checkin_id: uid(), guest_id: g, method: 'group',
      staff_display_name: 'Amina', device_label: 'Main entrance',
    }));

    const first = await batch(pool, seeded.eventId, records);
    assert.equal(first.summary.accepted, 3);

    // Replay the exact same payload four more times, as a flaky venue
    // connection and a WorkManager retry storm would.
    for (let i = 0; i < 4; i++) {
      const again = await batch(pool, seeded.eventId, records);
      assert.equal(again.summary.accepted, 0);
      assert.equal(again.summary.duplicate, 3);
      assert.equal(again.summary.conflict, 0);
    }

    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM check_ins WHERE event_id = $1', [seeded.eventId],
    );
    assert.equal(rows[0].n, 3, 'five drains of the same three check-ins must leave three rows');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('a duplicate result reports the ORIGINAL server id and sequence', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);
    const cid = uid();

    const first = await batch(pool, seeded.eventId, [{ client_checkin_id: cid, guest_id: guest }]);
    const accepted = byStatus(first, 'accepted')[0];

    const second = await batch(pool, seeded.eventId, [{ client_checkin_id: cid, guest_id: guest }]);
    const dup = byStatus(second, 'duplicate')[0];

    assert.equal(dup.server_id, accepted.server_id);
    assert.equal(dup.server_seq, accepted.server_seq);
    assert.equal(dup.guest_id, guest);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

// ══════════════════════════════════════════════════════════════════
// 2. Conflict (§5.3 Layer 4) — two offline devices, same guest
// ══════════════════════════════════════════════════════════════════

test('a second device admitting the same guest is recorded as a conflict, not inserted', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);

    const deviceA = uid();
    const deviceB = uid();

    await batch(pool, seeded.eventId, [{
      client_checkin_id: uid(), guest_id: guest, method: 'qr_scan',
      device_id: deviceA, device_label: 'Main entrance', staff_display_name: 'Amina',
      checked_in_at: '2026-08-01T19:05:00Z',
    }]);

    const losingCid = uid();
    const second = await batch(pool, seeded.eventId, [{
      client_checkin_id: losingCid, guest_id: guest, method: 'qr_scan',
      device_id: deviceB, device_label: 'Garden gate', staff_display_name: 'Karim',
      checked_in_at: '2026-08-01T19:06:30Z',
    }]);

    const conflict = byStatus(second, 'conflict')[0];
    assert.ok(conflict, 'the later arrival must be reported as a conflict');
    assert.equal(conflict.winning.staff_name, 'Amina');
    assert.equal(conflict.winning.device_label, 'Main entrance');

    // Exactly one LIVE check-in survives.
    const { rows: live } = await pool.query(
      'SELECT count(*)::int AS n FROM check_ins WHERE event_id = $1 AND guest_id = $2 AND deleted_at IS NULL',
      [seeded.eventId, guest],
    );
    assert.equal(live[0].n, 1);

    // Both operators and both timestamps are preserved for the supervisor.
    const { rows: conflicts } = await pool.query(
      `SELECT rejected_staff_display_name, rejected_device_label, winning_staff_display_name,
              rejected_checked_in_at, winning_checked_in_at
         FROM event_check_in_conflicts WHERE event_id = $1`,
      [seeded.eventId],
    );
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].rejected_staff_display_name, 'Karim');
    assert.equal(conflicts[0].rejected_device_label, 'Garden gate');
    assert.equal(conflicts[0].winning_staff_display_name, 'Amina');
    assert.ok(conflicts[0].rejected_checked_in_at > conflicts[0].winning_checked_in_at);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('replaying a conflicted batch does not multiply the conflict record', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);

    await batch(pool, seeded.eventId, [{ client_checkin_id: uid(), guest_id: guest }]);

    const losing = [{ client_checkin_id: uid(), guest_id: guest, device_label: 'Garden gate' }];
    for (let i = 0; i < 5; i++) await batch(pool, seeded.eventId, losing);

    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM event_check_in_conflicts WHERE event_id = $1', [seeded.eventId],
    );
    assert.equal(rows[0].n, 1, 'one conflict, however many times the batch is retried');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('two devices draining CONCURRENTLY yield exactly one admission and one conflict', opts, async () => {
  const pool = makePool(20);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);

    // Six genuinely simultaneous drains, each on its own connection, all
    // claiming the same guest with a different client id. Without the advisory
    // lock these all read "no live check-in" before any of them commits.
    const settled = await Promise.all(
      Array.from({ length: 6 }, (_, i) => batch(pool, seeded.eventId, [{
        client_checkin_id: uid(), guest_id: guest,
        device_label: `Door ${i}`, staff_display_name: `Staff ${i}`,
      }])),
    );

    const accepted = settled.reduce((n, r) => n + (r.summary?.accepted || 0), 0);
    const conflicts = settled.reduce((n, r) => n + (r.summary?.conflict || 0), 0);

    assert.equal(accepted, 1, 'exactly one concurrent drain may win');
    assert.equal(conflicts, 5);

    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM check_ins WHERE event_id = $1 AND deleted_at IS NULL', [seeded.eventId],
    );
    assert.equal(rows[0].n, 1);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

// ══════════════════════════════════════════════════════════════════
// 3. Partial arrivals (§9.1) — the acceptance criterion the spec states
// ══════════════════════════════════════════════════════════════════

test('a party of four arriving as two-then-two produces four rows and never blocks the second pair', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 4 });
    const guests = await guestsOf(pool, partyId);

    const firstPair = await batch(pool, seeded.eventId, guests.slice(0, 2).map((g) => ({
      client_checkin_id: uid(), guest_id: g, method: 'group',
    })));
    assert.equal(firstPair.summary.accepted, 2);

    const secondPair = await batch(pool, seeded.eventId, guests.slice(2).map((g) => ({
      client_checkin_id: uid(), guest_id: g, method: 'group',
    })));
    assert.equal(secondPair.summary.accepted, 2, 'the second pair must not be blocked');
    assert.equal(secondPair.summary.conflict, 0);

    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM check_ins WHERE party_id = $1 AND deleted_at IS NULL', [partyId],
    );
    assert.equal(rows[0].n, 4);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

// ══════════════════════════════════════════════════════════════════
// 4. Sequencing (§17.4) — gap detection depends on this being sound
// ══════════════════════════════════════════════════════════════════

test('server_seq is contiguous and strictly increasing across separate batches', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 5 });
    const guests = await guestsOf(pool, partyId);

    await batch(pool, seeded.eventId, guests.slice(0, 2).map((g) => ({ client_checkin_id: uid(), guest_id: g })));
    await batch(pool, seeded.eventId, guests.slice(2).map((g) => ({ client_checkin_id: uid(), guest_id: g })));

    const { rows } = await pool.query(
      'SELECT server_seq FROM check_ins WHERE event_id = $1 ORDER BY server_seq', [seeded.eventId],
    );
    const seqs = rows.map((r) => Number(r.server_seq));
    assert.deepEqual(seqs, [1, 2, 3, 4, 5], 'no gaps, no reuse');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('an undo takes a NEW sequence position and leaves the original untouched', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 2 });
    const guests = await guestsOf(pool, partyId);

    const cidA = uid();
    await batch(pool, seeded.eventId, [
      { client_checkin_id: cidA, guest_id: guests[0] },
      { client_checkin_id: uid(), guest_id: guests[1] },
    ]);

    const res = await undo(pool, seeded.eventId, cidA, 'scanned the wrong guest');
    assert.equal(res.ok, true);
    assert.equal(Number(res.server_seq), 3, 'the undo gets the next number, 3');

    const { rows } = await pool.query(
      'SELECT server_seq, undo_seq, deleted_at, undo_reason FROM check_ins WHERE client_checkin_id = $1', [cidA],
    );
    assert.equal(Number(rows[0].server_seq), 1, 'the original position must NOT move');
    assert.equal(Number(rows[0].undo_seq), 3);
    assert.ok(rows[0].deleted_at);
    assert.equal(rows[0].undo_reason, 'scanned the wrong guest');

    // The sequence space stays hole-free: 1 and 2 are check-ins, 3 is the undo.
    const { rows: all } = await pool.query(
      `SELECT server_seq AS s FROM check_ins WHERE event_id = $1
       UNION ALL
       SELECT undo_seq AS s FROM check_ins WHERE event_id = $1 AND undo_seq IS NOT NULL
       ORDER BY s`,
      [seeded.eventId],
    );
    assert.deepEqual(all.map((r) => Number(r.s)), [1, 2, 3]);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

// ══════════════════════════════════════════════════════════════════
// 5. Undo semantics (§7, §9.6) and the partial unique index
// ══════════════════════════════════════════════════════════════════

test('a reasonless undo is refused by the database, not just by the controller', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);
    const cid = uid();
    await batch(pool, seeded.eventId, [{ client_checkin_id: cid, guest_id: guest }]);

    for (const reason of [null, '', '   ']) {
      const res = await undo(pool, seeded.eventId, cid, reason);
      assert.equal(res.ok, false);
      assert.equal(res.error, 'REASON_REQUIRED');
    }
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('an undone guest CAN check in again — the correction must not lock the door', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);

    const cid1 = uid();
    await batch(pool, seeded.eventId, [{ client_checkin_id: cid1, guest_id: guest }]);
    await undo(pool, seeded.eventId, cid1, 'wrong guest');

    // This is the case a plain UNIQUE(event_id, guest_id) would have made
    // impossible: the guest is really here, and must be admittable.
    const again = await batch(pool, seeded.eventId, [{ client_checkin_id: uid(), guest_id: guest }]);
    assert.equal(again.summary.accepted, 1, 'a re-check-in after an undo must succeed');

    const { rows } = await pool.query(
      `SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int AS live,
              count(*)::int AS total
         FROM check_ins WHERE event_id = $1 AND guest_id = $2`,
      [seeded.eventId, guest],
    );
    assert.equal(rows[0].live, 1);
    assert.equal(rows[0].total, 2, 'the undone row is retained as evidence, never deleted');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('replaying an undone check-in reports duplicate and leaves it undone — the supervisor outranks the queue', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);

    const cid = uid();
    const record = [{ client_checkin_id: cid, guest_id: guest }];
    await batch(pool, seeded.eventId, record);
    await undo(pool, seeded.eventId, cid, 'checked in by mistake');

    const replay = await batch(pool, seeded.eventId, record);
    const dup = byStatus(replay, 'duplicate')[0];
    assert.ok(dup);
    assert.equal(dup.undone, true, 'the device is told the check-in was undone');

    const { rows } = await pool.query(
      'SELECT deleted_at FROM check_ins WHERE client_checkin_id = $1', [cid],
    );
    assert.ok(rows[0].deleted_at, 'a stale queue replay must not resurrect an undone check-in');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('undo is idempotent', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);
    const cid = uid();
    await batch(pool, seeded.eventId, [{ client_checkin_id: cid, guest_id: guest }]);

    const first = await undo(pool, seeded.eventId, cid, 'mistake');
    const second = await undo(pool, seeded.eventId, cid, 'mistake');
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.already_undone, true);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('undoing an unknown client_checkin_id is NOT_FOUND', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const res = await undo(pool, seeded.eventId, uid(), 'nothing to undo');
    assert.equal(res.ok, false);
    assert.equal(res.error, 'NOT_FOUND');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

// ══════════════════════════════════════════════════════════════════
// 6. Rejection paths — nothing may be silently dropped (§21.3)
// ══════════════════════════════════════════════════════════════════

test('a guest from another event is rejected with a reason, not swallowed', opts, async () => {
  const pool = makePool(5);
  let userIdA; let userIdB;
  try {
    const a = await seedEvent(pool); userIdA = a.userId;
    const b = await seedEvent(pool); userIdB = b.userId;
    const partyB = await seedParty(pool, b.eventId, { partySize: 1 });
    const [guestB] = await guestsOf(pool, partyB);

    // Event A's device submits a guest belonging to event B.
    const res = await batch(pool, a.eventId, [{ client_checkin_id: uid(), guest_id: guestB }]);
    const rejected = byStatus(res, 'rejected')[0];
    assert.ok(rejected);
    assert.equal(rejected.reason, 'GUEST_NOT_IN_EVENT');
    assert.equal(res.summary.accepted, 0);
  } finally {
    await cleanup(pool, userIdA);
    await cleanup(pool, userIdB);
    await pool.end();
  }
});

test('a malformed record rejects itself without aborting the rest of the batch', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 2 });
    const guests = await guestsOf(pool, partyId);

    const res = await batch(pool, seeded.eventId, [
      { client_checkin_id: 'not-a-uuid', guest_id: guests[0] },
      { guest_id: guests[0] },                                  // no client id
      { client_checkin_id: uid() },                             // no guest id
      { client_checkin_id: uid(), guest_id: guests[1] },         // the good one
    ]);

    assert.equal(res.summary.rejected, 3);
    assert.equal(res.summary.accepted, 1, 'one bad record must not cost the batch its good ones');
    assert.equal(byStatus(res, 'rejected').every((r) => r.reason === 'MALFORMED_RECORD'), true);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('an unknown event is reported rather than silently accepted', opts, async () => {
  const pool = makePool(5);
  try {
    const res = await batch(pool, uid(), [{ client_checkin_id: uid(), guest_id: uid() }]);
    assert.equal(res.ok, false);
    assert.equal(res.error, 'EVENT_NOT_FOUND');
  } finally {
    await pool.end();
  }
});

test('an unrecognised method falls back to qr_scan instead of violating the CHECK', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);

    const res = await batch(pool, seeded.eventId, [{
      client_checkin_id: uid(), guest_id: guest, method: 'telepathy',
    }]);
    assert.equal(res.summary.accepted, 1);

    const { rows } = await pool.query('SELECT method FROM check_ins WHERE guest_id = $1', [guest]);
    assert.equal(rows[0].method, 'qr_scan');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('the widened method CHECK now accepts group and override', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 2 });
    const guests = await guestsOf(pool, partyId);

    const res = await batch(pool, seeded.eventId, [
      { client_checkin_id: uid(), guest_id: guests[0], method: 'group' },
      { client_checkin_id: uid(), guest_id: guests[1], method: 'override' },
    ]);
    assert.equal(res.summary.accepted, 2);

    const { rows } = await pool.query(
      'SELECT method FROM check_ins WHERE event_id = $1 ORDER BY method', [seeded.eventId],
    );
    assert.deepEqual(rows.map((r) => r.method), ['group', 'override']);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

// ══════════════════════════════════════════════════════════════════
// 7. Attribution and clock handling
// ══════════════════════════════════════════════════════════════════

test('attribution is denormalised, and checked_in_by is left alone', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);
    const staffId = uid();
    const deviceId = uid();

    await batch(pool, seeded.eventId, [{
      client_checkin_id: uid(), guest_id: guest,
      staff_id: staffId, staff_display_name: 'Amina',
      device_id: deviceId, device_label: 'Main entrance',
      scan_token_fingerprint: 'a'.repeat(64), token_verified: true,
    }]);

    const { rows } = await pool.query(
      `SELECT staff_id, staff_display_name, device_id, device_label,
              checked_in_by, token_verified, scan_token_fingerprint
         FROM check_ins WHERE guest_id = $1`, [guest],
    );
    assert.equal(rows[0].staff_id, staffId);
    assert.equal(rows[0].staff_display_name, 'Amina');
    assert.equal(rows[0].device_id, deviceId);
    assert.equal(rows[0].device_label, 'Main entrance');
    assert.equal(rows[0].token_verified, true);
    // checked_in_by is the ORGANIZER audit uuid. A device must never land in
    // it — migration 20260728000000 exists because that once crashed every
    // insert in production.
    assert.equal(rows[0].checked_in_by, null);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('both the device clock and the server receipt time are recorded (§10)', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);

    // A tablet whose clock is a year fast. The claim is preserved, not
    // silently overwritten, so the report can show the divergence.
    await batch(pool, seeded.eventId, [{
      client_checkin_id: uid(), guest_id: guest, checked_in_at: '2027-01-01T00:00:00Z',
    }]);

    const { rows } = await pool.query(
      'SELECT checked_in_at, server_received_at FROM check_ins WHERE guest_id = $1', [guest],
    );
    assert.equal(new Date(rows[0].checked_in_at).getUTCFullYear(), 2027);
    assert.ok(rows[0].server_received_at);
    assert.ok(rows[0].checked_in_at > rows[0].server_received_at, 'both times kept, divergence visible');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('a 200-check-in drain stays correct and allocates 200 contiguous sequence numbers', opts, async () => {
  const pool = makePool(10);
  let userId;
  try {
    const seeded = await seedEvent(pool);
    userId = seeded.userId;
    await seedTable(pool, seeded.eventId, 10);

    // 20 parties of 10 = 200 guests, drained in batches of 100.
    const allGuests = [];
    for (let i = 0; i < 20; i++) {
      const partyId = await seedParty(pool, seeded.eventId, { partySize: 10 });
      allGuests.push(...await guestsOf(pool, partyId));
    }
    assert.equal(allGuests.length, 200);

    for (let i = 0; i < 200; i += 100) {
      const res = await batch(pool, seeded.eventId, allGuests.slice(i, i + 100).map((g) => ({
        client_checkin_id: uid(), guest_id: g, method: 'group',
      })));
      assert.equal(res.summary.accepted, 100);
    }

    const { rows } = await pool.query(
      `SELECT count(*)::int AS n, min(server_seq)::int AS lo, max(server_seq)::int AS hi,
              count(DISTINCT server_seq)::int AS distinct_seqs
         FROM check_ins WHERE event_id = $1`, [seeded.eventId],
    );
    assert.equal(rows[0].n, 200);
    assert.equal(rows[0].lo, 1);
    assert.equal(rows[0].hi, 200);
    assert.equal(rows[0].distinct_seqs, 200, 'no sequence number is ever reused');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});
