const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { ENABLED, SKIP_REASON, uid, makePool, seedEvent, seedWallet, cleanup } = require('./helpers/db');

// Skip the whole file (rather than fail) when no integration DB is configured.
const itest = (name, fn) => (ENABLED ? test(name, fn) : test(name, { skip: SKIP_REASON }, () => {}));

let pool;
before(() => { if (ENABLED) pool = makePool(30); });
after(async () => { if (pool) await pool.end(); });

// ─────────────────────────────────────────────────────────────────────────────
// deduct_sms_credit_atomic — the `SELECT ... FOR UPDATE` wallet lock must make
// concurrent consumption serialise, so the wallet can NEVER go negative.
// ─────────────────────────────────────────────────────────────────────────────

itest('ZERO double-spend: 50 credits vs 150 simultaneous deductions => exactly 50 succeed', async () => {
  const CREDITS = 50;
  const ATTEMPTS = 150; // 3x oversubscribed
  const { userId, eventId } = await seedEvent(pool);
  try {
    await seedWallet(pool, eventId, CREDITS, 0);

    // Each query runs on its OWN pooled connection => real lock contention.
    const calls = Array.from({ length: ATTEMPTS }, (_, i) =>
      pool
        .query('SELECT deduct_sms_credit_atomic($1::uuid, $2::text) AS r', [eventId, `+1555${String(i).padStart(7, '0')}`])
        .then((res) => res.rows[0].r),
    );
    const results = await Promise.all(calls);

    const succeeded = results.filter((r) => r.success === true).length;
    const failed = results.filter((r) => r.success === false && r.error === 'INSUFFICIENT_CREDITS').length;

    // Invariant 1: exactly the available credits were granted — not one more.
    assert.equal(succeeded, CREDITS, 'exactly the available credits may be consumed');
    assert.equal(failed, ATTEMPTS - CREDITS, 'every oversubscribed call is cleanly rejected');

    // Invariant 2 (ground truth): the wallet itself never overspent.
    const w = (await pool.query('SELECT credits_used, credits_remaining FROM sms_credit_wallets WHERE event_id = $1', [eventId])).rows[0];
    assert.equal(Number(w.credits_used), CREDITS);
    assert.equal(Number(w.credits_remaining), 0);
    assert.ok(Number(w.credits_remaining) >= 0, 'credits_remaining must never go negative');

    // Invariant 3: the ledger has exactly one consumption row per granted credit.
    const led = (await pool.query(
      `SELECT count(*)::int AS n FROM sms_credit_ledger WHERE event_id = $1 AND transaction_type = 'consumption'`,
      [eventId],
    )).rows[0];
    assert.equal(led.n, CREDITS);
  } finally {
    await cleanup(pool, userId);
  }
});

itest('the idempotency_key UNIQUE index backstops a racy retry: same key never spends twice', async () => {
  const { userId, eventId } = await seedEvent(pool);
  try {
    await seedWallet(pool, eventId, 100, 0);
    const key = `idem_${uid()}`;
    const ATTEMPTS = 25;

    // Fire the SAME idempotency key concurrently. Losers of the unique-index race
    // roll back their decrement, so the wallet rises by at most one.
    const calls = Array.from({ length: ATTEMPTS }, () =>
      pool
        .query('SELECT deduct_sms_credit_atomic($1::uuid, $2::text, $3::text) AS r', [eventId, '+15550000000', key])
        .then((res) => ({ ok: true, r: res.rows[0].r }))
        .catch((e) => ({ ok: false, e: e.message })),
    );
    await Promise.all(calls);

    const w = (await pool.query('SELECT credits_used FROM sms_credit_wallets WHERE event_id = $1', [eventId])).rows[0];
    assert.equal(Number(w.credits_used), 1, 'at most one credit consumed for one idempotency key');

    const rows = (await pool.query('SELECT count(*)::int AS n FROM sms_credit_ledger WHERE idempotency_key = $1', [key])).rows[0];
    assert.equal(rows.n, 1, 'exactly one ledger row carries the key');
  } finally {
    await cleanup(pool, userId);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// record_sms_purchase — wallet-ensure + ledger-insert + increment in ONE
// transaction; duplicate Stripe deliveries (same payment_intent) must credit once.
// ─────────────────────────────────────────────────────────────────────────────

itest('webhook storm: 40 concurrent deliveries of one payment_intent credit EXACTLY once', async () => {
  const CREDITS = 500;
  const ATTEMPTS = 40;
  const { userId, eventId } = await seedEvent(pool);
  const paymentIntent = `pi_${uid()}`;
  try {
    // No wallet pre-seeded — record_sms_purchase must also win the wallet-ensure race.
    const calls = Array.from({ length: ATTEMPTS }, () =>
      pool
        .query('SELECT record_sms_purchase($1::uuid, $2::int, $3::text) AS r', [eventId, CREDITS, paymentIntent])
        .then((res) => res.rows[0].r),
    );
    const results = await Promise.all(calls);

    assert.ok(results.every((r) => r.success === true), 'every delivery returns success');
    const firstDeliveries = results.filter((r) => r.already_processed === false).length;
    assert.equal(firstDeliveries, 1, 'exactly one delivery actually credits; the rest are idempotent no-ops');

    // Ground truth: credited once, not ATTEMPTS times.
    const w = (await pool.query('SELECT credits_purchased FROM sms_credit_wallets WHERE event_id = $1', [eventId])).rows[0];
    assert.equal(Number(w.credits_purchased), CREDITS);

    const purchases = (await pool.query(
      `SELECT count(*)::int AS n FROM sms_credit_ledger WHERE event_id = $1 AND transaction_type = 'purchase'`,
      [eventId],
    )).rows[0];
    assert.equal(purchases.n, 1, 'exactly one purchase ledger row exists');
  } finally {
    await cleanup(pool, userId);
  }
});

itest('exactly one wallet row exists even when the ensure step races (UNIQUE event_id)', async () => {
  const { userId, eventId } = await seedEvent(pool);
  try {
    const calls = Array.from({ length: 20 }, (_, i) =>
      pool.query('SELECT record_sms_purchase($1::uuid, $2::int, $3::text) AS r', [eventId, 10, `pi_${uid()}_${i}`]),
    );
    await Promise.all(calls);
    const wallets = (await pool.query('SELECT count(*)::int AS n FROM sms_credit_wallets WHERE event_id = $1', [eventId])).rows[0];
    assert.equal(wallets.n, 1, 'the UNIQUE(event_id) constraint guarantees a single wallet');
    // 20 DISTINCT payment intents => 20 genuine purchases of 10 credits each.
    const w = (await pool.query('SELECT credits_purchased FROM sms_credit_wallets WHERE event_id = $1', [eventId])).rows[0];
    assert.equal(Number(w.credits_purchased), 200);
  } finally {
    await cleanup(pool, userId);
  }
});
