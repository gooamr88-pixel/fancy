/**
 * Integration-test harness for the REAL Postgres concurrency primitives.
 *
 * Unlike the unit suite (which mocks Supabase), these tests open many independent
 * Postgres connections through a `pg` Pool and fire genuinely simultaneous calls
 * at the production RPCs — so the `FOR UPDATE` row locks, the
 * `pg_advisory_xact_lock` seating locks, and the transactional idempotency guards
 * are exercised under true contention, not simulated.
 *
 * Point this at a database that has the migrations in `supabase/migrations/`
 * applied (the local Supabase stack is the intended target — see README):
 *
 *   supabase start
 *   export INTEGRATION_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
 *   npm run test:integration
 *
 * When INTEGRATION_DB_URL is unset (or `pg` is unavailable), every integration
 * test SKIPS rather than fails — so the hermetic unit suite / CI stays green.
 */
const crypto = require('crypto');

let Pool = null;
try { ({ Pool } = require('pg')); } catch { /* pg not installed — tests will skip */ }

const DB_URL = process.env.INTEGRATION_DB_URL || process.env.DATABASE_URL || '';
const ENABLED = !!(DB_URL && Pool);
const SKIP_REASON = !Pool
  ? 'pg is not installed (npm i -D pg)'
  : (!DB_URL ? 'INTEGRATION_DB_URL is not set' : 'disabled');

const uid = () => crypto.randomUUID();

/** Creates a connection pool sized for aggressive concurrency. */
function makePool(max = 30) {
  return new Pool({ connectionString: DB_URL, max, idleTimeoutMillis: 1000 });
}

/**
 * Seeds the minimal ownership chain an RPC needs: auth.users -> organizations ->
 * events. Returns the ids. Cleanup via cleanup(pool, userId) cascades it all away.
 */
async function seedEvent(pool, { paid = true, status = 'active', slug = null, rsvpDeadline = null } = {}) {
  const userId = uid();
  const orgId = uid();
  const eventId = uid();
  const tag = uid().slice(0, 8);
  const useSlug = slug || `it-event-${tag}`;

  await pool.query(
    `INSERT INTO auth.users (instance_id, id, aud, role, email, created_at, updated_at)
     VALUES ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [userId, `it-user-${tag}@example.com`],
  );
  await pool.query(
    `INSERT INTO organizations (id, owner_user_id, name, email, email_verified)
     VALUES ($1, $2, 'IT Org', $3, true)`,
    [orgId, userId, `it-org-${tag}@example.com`],
  );
  await pool.query(
    `INSERT INTO events (id, org_id, slug, template_type, title, event_date, rsvp_deadline, status, is_paid)
     VALUES ($1, $2, $3, 'wedding', 'Integration Event', now() + interval '30 days', $4, $5, $6)`,
    [eventId, orgId, useSlug, rsvpDeadline, status, paid],
  );

  return { userId, orgId, eventId, slug: useSlug };
}

/** Adds an rsvp_form_fields row; returns its id. Use key='meal_selection' for the meal field. */
async function seedFormField(pool, eventId, { key = 'meal_selection', label = 'Meal', type = 'select', options = [], required = false } = {}) {
  const id = uid();
  await pool.query(
    `INSERT INTO rsvp_form_fields (id, event_id, field_key, field_label, field_type, options, is_required)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [id, eventId, key, label, type, JSON.stringify(options), required],
  );
  return id;
}

async function seedWallet(pool, eventId, creditsPurchased, creditsUsed = 0) {
  await pool.query(
    `INSERT INTO sms_credit_wallets (event_id, credits_purchased, credits_used) VALUES ($1, $2, $3)`,
    [eventId, creditsPurchased, creditsUsed],
  );
}

async function seedTable(pool, eventId, maxCapacity) {
  const id = uid();
  await pool.query(
    `INSERT INTO tables (id, event_id, table_name, max_capacity, element_type)
     VALUES ($1, $2, $3, $4, 'table')`,
    [id, eventId, `Table-${id.slice(0, 4)}`, maxCapacity],
  );
  return id;
}

async function seedRsvp(pool, eventId, { partySize = 1, response = 'yes', name } = {}) {
  const id = uid();
  await pool.query(
    `INSERT INTO rsvps (id, event_id, guest_name, response, party_size)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, eventId, name || `Guest ${id.slice(0, 4)}`, response, partySize],
  );
  return id;
}

/** Deletes the seed user; FK ON DELETE CASCADE removes org -> event -> everything. */
async function cleanup(pool, userId) {
  if (userId) await pool.query('DELETE FROM auth.users WHERE id = $1', [userId]);
}

module.exports = {
  ENABLED, SKIP_REASON, uid,
  makePool, seedEvent, seedFormField, seedWallet, seedTable, seedRsvp, cleanup,
};
