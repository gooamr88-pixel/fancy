/**
 * checkin_guest_delta + the change-log triggers — REAL Postgres.
 *
 * The unit suite proves the service passes the RPC's answer through correctly.
 * It cannot prove the triggers fire on the right columns, that the sequence is
 * monotonic per event, that party-scoped changes fan out to the right guests,
 * or that a guest deleted after checking in is retained. All of that is SQL.
 *
 * Skips (does not fail) when INTEGRATION_DB_URL is unset — see README.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  ENABLED, SKIP_REASON, uid, makePool, seedEvent, seedParty, seedTable, cleanup,
} = require('./helpers/db');

const opts = ENABLED ? {} : { skip: SKIP_REASON };

async function delta(pool, eventId, since, limit = 500) {
  const { rows } = await pool.query(
    'SELECT public.checkin_guest_delta($1::uuid, $2::bigint, $3::int) AS out',
    [eventId, since, limit],
  );
  return rows[0].out;
}

async function version(pool, eventId) {
  const { rows } = await pool.query(
    'SELECT coalesce(max(seq), 0)::bigint AS v FROM event_guest_changes WHERE event_id = $1',
    [eventId],
  );
  return Number(rows[0].v);
}

async function guestsOf(pool, partyId) {
  const { rows } = await pool.query('SELECT id FROM guests WHERE party_id = $1 ORDER BY id', [partyId]);
  return rows.map((r) => r.id);
}

// ══════════════════════════════════════════════════════════════════
// The log fires on the right things — and NOT on the wrong ones
// ══════════════════════════════════════════════════════════════════

test('inserting guests advances the event version', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    const before = await version(pool, seeded.eventId);
    await seedParty(pool, seeded.eventId, { partySize: 3 });
    const after = await version(pool, seeded.eventId);
    assert.ok(after > before, 'three guest inserts must advance the version');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('an irrelevant guest UPDATE does NOT churn the log', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);
    const before = await version(pool, seeded.eventId);

    // phone is not rendered by the app; touching it must not force a delta.
    await pool.query('UPDATE guests SET phone = $1 WHERE id = $2', ['+15550000', guest]);
    assert.equal(await version(pool, seeded.eventId), before);

    // full_name IS rendered.
    await pool.query('UPDATE guests SET full_name = $1 WHERE id = $2', ['Renamed', guest]);
    assert.ok(await version(pool, seeded.eventId) > before);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('a category change to vip is picked up — it drives the welcome treatment', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);
    const base = await version(pool, seeded.eventId);

    await pool.query('UPDATE guests SET category = $1 WHERE id = $2', ['vip', guest]);
    const out = await delta(pool, seeded.eventId, base);
    assert.equal(out.requires_full_resync, false);
    assert.equal(out.upserts.length, 1);
    assert.equal(out.upserts[0].category, 'vip');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('a seating change fans out to every guest in the party', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 4 });
    const tableId = await seedTable(pool, seeded.eventId, 10);
    const base = await version(pool, seeded.eventId);

    await pool.query(
      'INSERT INTO seating_assignments (event_id, party_id, table_id) VALUES ($1, $2, $3)',
      [seeded.eventId, partyId, tableId],
    );

    const out = await delta(pool, seeded.eventId, base);
    assert.equal(out.upserts.length, 4, 'all four party members must be refreshed');
    assert.ok(out.upserts.every((g) => g.tableName), 'every member gets the table name');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('a party label change fans out to its guests', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 2 });
    const base = await version(pool, seeded.eventId);

    await pool.query('UPDATE rsvp_parties SET label = $1 WHERE id = $2', ['The Haddads', partyId]);
    const out = await delta(pool, seeded.eventId, base);
    assert.equal(out.upserts.length, 2);
    assert.equal(out.upserts[0].partyLabel, 'The Haddads');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('an event detail change refreshes every guest', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    await seedParty(pool, seeded.eventId, { partySize: 3 });
    const base = await version(pool, seeded.eventId);

    await pool.query('UPDATE events SET location_name = $1 WHERE id = $2', ['New Ballroom', seeded.eventId]);
    const out = await delta(pool, seeded.eventId, base);
    assert.equal(out.upserts.length, 3);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('an unrelated event UPDATE does not churn the log', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    await seedParty(pool, seeded.eventId, { partySize: 1 });
    const before = await version(pool, seeded.eventId);
    await pool.query('UPDATE events SET dress_code = $1 WHERE id = $2', ['Black tie', seeded.eventId]);
    assert.equal(await version(pool, seeded.eventId), before);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

// ══════════════════════════════════════════════════════════════════
// Removal semantics (§19.5)
// ══════════════════════════════════════════════════════════════════

test('a guest deleted while NOT checked in appears in removed_guest_ids', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 2 });
    const guests = await guestsOf(pool, partyId);
    const base = await version(pool, seeded.eventId);

    await pool.query('DELETE FROM guests WHERE id = $1', [guests[0]]);
    const out = await delta(pool, seeded.eventId, base);
    assert.deepEqual(out.removed_guest_ids, [guests[0]]);
    assert.equal(out.upserts.length, 0);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('a guest deleted AFTER checking in is reported as still checked in, not erased', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 2 });
    const guests = await guestsOf(pool, partyId);

    await pool.query(
      'SELECT public.checkin_batch_upsert($1::uuid, $2::jsonb)',
      [seeded.eventId, JSON.stringify([{ client_checkin_id: uid(), guest_id: guests[0] }])],
    );

    const base = await version(pool, seeded.eventId);
    // The organizer removes them from the web platform while they are inside.
    // ON DELETE CASCADE takes the check_in too, so what the delta can report is
    // the removal — the anomaly the report must surface (§19.5).
    await pool.query('DELETE FROM guests WHERE id = $1', [guests[0]]);

    const out = await delta(pool, seeded.eventId, base);
    assert.deepEqual(out.removed_guest_ids, [guests[0]]);

    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM check_ins WHERE guest_id = $1', [guests[0]],
    );
    // Documents the ACTUAL behaviour: the FK cascade wins. §19.5 wants the
    // check-in retained, which would need the FK relaxed to ON DELETE SET NULL
    // or a soft delete on guests — a web-platform change, out of scope here.
    // Asserted so the day that changes, this test fails loudly instead of the
    // report silently starting to disagree with the room.
    assert.equal(rows[0].n, 0, 'cascade currently removes the check-in — see §19.5 gap');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('a still-checked-in guest carries checkedIn:true through the delta', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);
    const tableId = await seedTable(pool, seeded.eventId, 10);

    await pool.query(
      'SELECT public.checkin_batch_upsert($1::uuid, $2::jsonb)',
      [seeded.eventId, JSON.stringify([{ client_checkin_id: uid(), guest_id: guest }])],
    );

    const base = await version(pool, seeded.eventId);
    // §19.3 classes a table change for an already-arrived guest as CRITICAL:
    // they were verbally sent to the wrong table.
    await pool.query(
      'INSERT INTO seating_assignments (event_id, party_id, table_id) VALUES ($1, $2, $3)',
      [seeded.eventId, partyId, tableId],
    );

    const out = await delta(pool, seeded.eventId, base);
    assert.equal(out.upserts.length, 1);
    assert.equal(out.upserts[0].checkedIn, true, 'the supervisor flag depends on this');
    assert.ok(out.upserts[0].tableName);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

// ══════════════════════════════════════════════════════════════════
// requires_full_resync (§19.4)
// ══════════════════════════════════════════════════════════════════

test('since_version 0 means "no baseline" and demands a full download', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    await seedParty(pool, seeded.eventId, { partySize: 1 });
    const out = await delta(pool, seeded.eventId, 0);
    assert.equal(out.requires_full_resync, true);
    assert.equal(out.reason, 'NO_BASELINE');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('an up-to-date device gets a cheap empty payload, never a guest list', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    await seedParty(pool, seeded.eventId, { partySize: 5 });
    const current = await version(pool, seeded.eventId);

    const out = await delta(pool, seeded.eventId, current);
    assert.equal(out.requires_full_resync, false);
    assert.deepEqual(out.upserts, []);
    assert.deepEqual(out.removed_guest_ids, []);
    assert.equal(Number(out.to_version), current);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('a change volume beyond the limit demands a full download instead', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 10 });
    const base = await version(pool, seeded.eventId);
    await pool.query('UPDATE guests SET full_name = full_name || $1 WHERE party_id = $2', ['!', partyId]);

    // limit=3 with 10 changed guests: re-downloading is cheaper than a delta.
    const out = await delta(pool, seeded.eventId, base, 3);
    assert.equal(out.requires_full_resync, true);
    assert.equal(out.reason, 'CHANGE_VOLUME');
    assert.equal(Number(out.changed_count), 10);
    assert.deepEqual(out.upserts, [], 'must not also ship a partial delta');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('a version older than the retained log demands a full download', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 2 });
    await pool.query('UPDATE rsvp_parties SET label = $1 WHERE id = $2', ['Edited', partyId]);

    // Simulate the prune having aged out everything before the latest entry.
    const keep = await version(pool, seeded.eventId);
    await pool.query('DELETE FROM event_guest_changes WHERE event_id = $1 AND seq < $2', [seeded.eventId, keep]);

    const out = await delta(pool, seeded.eventId, 1);
    assert.equal(out.requires_full_resync, true);
    assert.equal(out.reason, 'VERSION_TOO_OLD');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('an unknown event is reported, not silently answered', opts, async () => {
  const pool = makePool(5);
  try {
    const out = await delta(pool, uid(), 1);
    assert.equal(out.ok, false);
    assert.equal(out.error, 'EVENT_NOT_FOUND');
  } finally {
    await pool.end();
  }
});

// ══════════════════════════════════════════════════════════════════
// Isolation and concurrency
// ══════════════════════════════════════════════════════════════════

test('one event never sees another event\'s changes', opts, async () => {
  const pool = makePool(10);
  let userA; let userB;
  try {
    const a = await seedEvent(pool); userA = a.userId;
    const b = await seedEvent(pool); userB = b.userId;
    await seedParty(pool, a.eventId, { partySize: 2 });
    const baseA = await version(pool, a.eventId);

    // Churn event B only.
    for (let i = 0; i < 5; i++) await seedParty(pool, b.eventId, { partySize: 2 });

    const out = await delta(pool, a.eventId, baseA);
    assert.deepEqual(out.upserts, [], "event A must be unaffected by event B's edits");
    assert.equal(Number(out.to_version), baseA);
  } finally {
    await cleanup(pool, userA);
    await cleanup(pool, userB);
    await pool.end();
  }
});

test('concurrent guest inserts do not serialise on a shared counter row', opts, async () => {
  const pool = makePool(20);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;

    // The whole reason the change log is append-only rather than a counter on
    // `events`: ten simultaneous RSVPs for one event must all get through.
    await Promise.all(
      Array.from({ length: 10 }, () => seedParty(pool, seeded.eventId, { partySize: 2 })),
    );

    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM guests WHERE event_id = $1', [seeded.eventId],
    );
    assert.equal(rows[0].n, 20);

    const { rows: logRows } = await pool.query(
      'SELECT count(*)::int AS n FROM event_guest_changes WHERE event_id = $1 AND op = $2',
      [seeded.eventId, 'guest_upsert'],
    );
    assert.equal(logRows[0].n, 20, 'every insert must be logged exactly once');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('the event version is monotonic across many sequential edits', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);

    let last = await version(pool, seeded.eventId);
    for (let i = 0; i < 10; i++) {
      await pool.query('UPDATE guests SET full_name = $1 WHERE id = $2', [`Name ${i}`, guest]);
      const next = await version(pool, seeded.eventId);
      assert.ok(next > last, `version must strictly increase (step ${i})`);
      last = next;
    }
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('repeated edits to one guest collapse to a single upsert', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);
    const base = await version(pool, seeded.eventId);

    for (let i = 0; i < 8; i++) {
      await pool.query('UPDATE guests SET full_name = $1 WHERE id = $2', [`Name ${i}`, guest]);
    }

    const out = await delta(pool, seeded.eventId, base);
    assert.equal(out.upserts.length, 1, 'current-state delta collapses eight edits to one row');
    assert.equal(out.upserts[0].fullName, 'Name 7', 'and it is the latest state');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

// ══════════════════════════════════════════════════════════════════
// Emergency controls (§21.5)
// ══════════════════════════════════════════════════════════════════

test('controls persist per event and default to off', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;

    await pool.query(
      `INSERT INTO event_checkin_cursors (event_id, sync_disabled, polling_only, controls_set_at)
       VALUES ($1, true, true, now())
       ON CONFLICT (event_id) DO UPDATE SET sync_disabled = true, polling_only = true`,
      [seeded.eventId],
    );

    const { rows } = await pool.query(
      'SELECT sync_disabled, realtime_disabled, polling_only FROM event_checkin_cursors WHERE event_id = $1',
      [seeded.eventId],
    );
    assert.equal(rows[0].sync_disabled, true);
    assert.equal(rows[0].polling_only, true);
    assert.equal(rows[0].realtime_disabled, false, 'unset controls stay off');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('arming the kill switch does not prevent a drain from being accepted', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 1 });
    const [guest] = await guestsOf(pool, partyId);

    await pool.query(
      `INSERT INTO event_checkin_cursors (event_id, sync_disabled) VALUES ($1, true)
       ON CONFLICT (event_id) DO UPDATE SET sync_disabled = true`,
      [seeded.eventId],
    );

    // A device that has not yet seen the flag still gets its data accepted —
    // rejecting would strand check-ins that exist nowhere else.
    const { rows } = await pool.query(
      'SELECT public.checkin_batch_upsert($1::uuid, $2::jsonb) AS out',
      [seeded.eventId, JSON.stringify([{ client_checkin_id: uid(), guest_id: guest }])],
    );
    assert.equal(rows[0].out.summary.accepted, 1);
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

// ══════════════════════════════════════════════════════════════════
// Retention pruning
// ══════════════════════════════════════════════════════════════════

test('pruning keeps recent entries even when they are older than the cutoff', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    const partyId = await seedParty(pool, seeded.eventId, { partySize: 3 });
    await pool.query('UPDATE rsvp_parties SET label = $1 WHERE id = $2', ['Edited', partyId]);

    // Age everything well past the cutoff.
    await pool.query(
      "UPDATE event_guest_changes SET created_at = now() - interval '90 days' WHERE event_id = $1",
      [seeded.eventId],
    );

    const before = await version(pool, seeded.eventId);
    // keep_per_event = 2 floor, so the two newest survive regardless of age.
    await pool.query('SELECT public.prune_event_guest_changes($1::interval, $2::int)', ['30 days', 2]);

    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM event_guest_changes WHERE event_id = $1', [seeded.eventId],
    );
    assert.equal(rows[0].n, 2, 'the per-event floor protects a recently-synced device');
    assert.equal(await version(pool, seeded.eventId), before, 'pruning must not move the version');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});

test('pruning leaves entries newer than the cutoff alone', opts, async () => {
  const pool = makePool(5);
  let userId;
  try {
    const seeded = await seedEvent(pool); userId = seeded.userId;
    await seedParty(pool, seeded.eventId, { partySize: 4 });

    const { rows: before } = await pool.query(
      'SELECT count(*)::int AS n FROM event_guest_changes WHERE event_id = $1', [seeded.eventId],
    );
    await pool.query('SELECT public.prune_event_guest_changes($1::interval, $2::int)', ['30 days', 1]);
    const { rows: after } = await pool.query(
      'SELECT count(*)::int AS n FROM event_guest_changes WHERE event_id = $1', [seeded.eventId],
    );
    assert.equal(after[0].n, before[0].n, 'fresh entries must survive any prune');
  } finally {
    await cleanup(pool, userId);
    await pool.end();
  }
});
