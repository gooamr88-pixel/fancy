/**
 * Integration-test harness for the REAL Postgres concurrency primitives.
 *
 * Unlike the unit suite (which mocks Supabase), these tests open many independent
 * Postgres connections through a `pg` Pool and fire genuinely simultaneous calls
 * at the production RPCs — so the `FOR UPDATE` row locks, the
 * `pg_advisory_xact_lock` seating/party locks, and the transactional idempotency
 * guards are exercised under true contention, not simulated.
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
 *
 * Schema note (post 20260705000000_guest_experience_rebuild.sql): the old flat
 * `rsvps` / `rsvp_guests` tables are gone. The response unit is now
 * `rsvp_parties` (one row per invited party) with `guests` (one row per
 * individual person, FK'd via `party_id`) — `seedRsvp`/`rsvp_id` are replaced
 * below by `seedParty`/`party_id` throughout.
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
async function seedEvent(pool, {
  paid = true, status = 'active', slug = null, rsvpDeadline = null,
  tierMaxGuests = null, allowGuestEdits = false,
} = {}) {
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
    `INSERT INTO events (id, org_id, slug, template_type, title, event_date, rsvp_deadline, status, is_paid, tier_max_guests, allow_guest_edits)
     VALUES ($1, $2, $3, 'wedding', 'Integration Event', now() + interval '30 days', $4, $5, $6, $7, $8)`,
    [eventId, orgId, useSlug, rsvpDeadline, status, paid, tierMaxGuests, allowGuestEdits],
  );

  return { userId, orgId, eventId, slug: useSlug };
}

/**
 * Adds a custom_form_fields row (renamed from rsvp_form_fields by the guest
 * experience rebuild). Use key='meal_selection' (the default) for the meal
 * field — submit_rsvp_v2 (as of 20260714000000_guest_side_tagging.sql) no
 * longer matches meal fields by field_key, it looks for is_meal_field = true,
 * which this helper sets automatically for that key unless overridden.
 */
async function seedFormField(pool, eventId, {
  key = 'meal_selection', label = 'Meal', type = 'select', options = [],
  required = false, scope = 'party', isMealField = null,
} = {}) {
  const id = uid();
  const mealFlag = isMealField === null ? key === 'meal_selection' : isMealField;
  await pool.query(
    `INSERT INTO custom_form_fields (id, event_id, field_key, field_label, field_type, options, is_required, scope, is_meal_field)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
    [id, eventId, key, label, type, JSON.stringify(options), required, scope, mealFlag],
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

/**
 * Seeds an rsvp_parties row plus `partySize` guests (the first is the primary
 * contact carrying email/phone; the rest are unnamed companions) — the
 * party/guest equivalent of the old flat `seedRsvp`. Returns the party id.
 */
async function seedParty(pool, eventId, { partySize = 1, response = 'yes', name, email = null, phone = null } = {}) {
  const partyId = uid();
  const label = name || `Guest ${partyId.slice(0, 4)}`;
  const size = Math.max(partySize, 1);

  await pool.query(
    `INSERT INTO rsvp_parties (id, event_id, label, response, max_party_size)
     VALUES ($1, $2, $3, $4, $5)`,
    [partyId, eventId, label, response, Math.min(size, 20)],
  );

  const values = [];
  const params = [];
  let p = 0;
  for (let i = 0; i < size; i++) {
    const isPrimary = i === 0;
    values.push(`($${++p}, $${++p}, $${++p}, $${++p}, $${++p}, $${++p}, $${++p})`);
    params.push(uid(), partyId, eventId, isPrimary ? label : `${label} Guest ${i + 1}`,
      isPrimary ? email : null, isPrimary ? phone : null, isPrimary);
  }
  await pool.query(
    `INSERT INTO guests (id, party_id, event_id, full_name, email, phone, is_primary_contact) VALUES ${values.join(',')}`,
    params,
  );

  return partyId;
}

/** Deletes the seed user; FK ON DELETE CASCADE removes org -> event -> everything. */
async function cleanup(pool, userId) {
  if (userId) await pool.query('DELETE FROM auth.users WHERE id = $1', [userId]);
}

module.exports = {
  ENABLED, SKIP_REASON, uid,
  makePool, seedEvent, seedFormField, seedWallet, seedTable, seedParty, cleanup,
};
