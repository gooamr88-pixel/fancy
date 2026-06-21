# Postgres Concurrency Integration Tests

These tests prove — against a **real PostgreSQL database** — that the platform's
money and seating primitives are safe under true concurrency. They open many
independent connections (via a `pg` Pool) and fire simultaneous calls at the
production RPCs, so the actual `FOR UPDATE` locks, `pg_advisory_xact_lock`
seating locks, and transactional idempotency guards are exercised under
contention — not mocked.

| File | Proves |
|---|---|
| `smsConcurrency.test.js` | `deduct_sms_credit_atomic` never overspends (`FOR UPDATE`); the `idempotency_key` unique index backstops racy retries; `record_sms_purchase` credits a payment_intent exactly once under a webhook storm; a single wallet row survives the ensure race. |
| `seatingConcurrency.test.js` | `assign_seat` never overbooks a table (advisory lock + capacity assertion); party-size SUM math holds; a guest can't be double-seated (`UNIQUE(event_id,rsvp_id)`); `force` deliberately allows overbooking. |

> If `INTEGRATION_DB_URL` is not set (or `pg` is missing), every test here **skips**
> rather than fails — so the hermetic unit suite (`npm test`) and CI stay green.

---

## 1. Start a local database with the schema applied

The intended target is the **local Supabase stack**, because the migrations in
`supabase/migrations/` reference the `auth` schema.

```bash
# from the repo root — installs nothing globally if you use npx
npx supabase start
```

`supabase start` boots Postgres and **applies every migration in order**, so all
the RPCs under test (`deduct_sms_credit_atomic`, `record_sms_purchase`,
`assign_seat`, …) exist. It prints a connection string; the DB is reachable at:

```
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

> Already have a plain Postgres with the migrations applied? Point at that
> instead — the only hard requirement is that `auth.users` exists (the seed
> helper inserts an owner there) and the migrations have run.

## 2. Install the test dependency (once)

```bash
cd backend
npm install        # picks up the `pg` devDependency from package.json
```

## 3. Run the concurrency suite

```bash
cd backend
export INTEGRATION_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
npm run test:integration
```

Run **everything** (hermetic unit + integration) in one shot:

```bash
INTEGRATION_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npm run test:all
```

On Windows PowerShell:

```powershell
$env:INTEGRATION_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
npm run test:integration
```

## 4. Tear down

```bash
npx supabase stop
```

---

## Notes
- Each test seeds its own isolated `auth.users → organizations → events` chain
  with random ids and cleans up by deleting the user (FK `ON DELETE CASCADE`
  removes the whole tree), so tests don't interfere and leave no residue.
- Concurrency is real: every `pool.query(...)` checks out a separate backend
  connection. Pool size is 30; raise it (and Postgres `max_connections`) to push
  the contention harder.
- The assertions check **two layers**: the per-call RPC return values *and* the
  ground-truth wallet/ledger/occupancy rows — so a regression that "reports"
  success while corrupting state would still be caught.
