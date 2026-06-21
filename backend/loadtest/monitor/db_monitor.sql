-- ════════════════════════════════════════════════════════════════════════
-- Database performance probes — run against the Supabase/Postgres instance
-- WHILE a k6 level is executing. The most revealing way to watch live is psql's
-- \watch:
--
--   psql "$INTEGRATION_DB_URL" -f monitor/db_monitor.sql            # one shot
--   psql "$INTEGRATION_DB_URL" -c "<paste a query>" ; \watch 2     # every 2s
--
-- Enable pg_stat_statements once (Supabase has it available):
--   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- and reset its counters right before a run:
--   SELECT pg_stat_statements_reset();
-- ════════════════════════════════════════════════════════════════════════

-- 1) CONNECTION POOL SATURATION ───────────────────────────────────────────
-- How close are we to max_connections? With Supabase you usually hit the
-- *pooler* (Supavisor) limit long before raw Postgres max_connections.
SELECT
  (SELECT count(*) FROM pg_stat_activity)                          AS total_conns,
  (SELECT count(*) FROM pg_stat_activity WHERE state = 'active')   AS active,
  (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle')     AS idle,
  (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction') AS idle_in_txn,
  (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock')      AS waiting_on_locks,
  current_setting('max_connections')::int                          AS max_connections;

-- 2) SLOWEST STATEMENTS BY TOTAL TIME ──────────────────────────────────────
-- The endpoints that cost the most cumulative DB time across the run.
SELECT
  substring(regexp_replace(query, '\s+', ' ', 'g') FROM 1 FOR 90) AS query,
  calls,
  round(mean_exec_time::numeric, 2)  AS mean_ms,
  round(p95_ms::numeric, 2)          AS p95_ms_est,
  round(total_exec_time::numeric, 2) AS total_ms,
  rows
FROM (
  SELECT *, mean_exec_time + 1.645 * stddev_exec_time AS p95_ms FROM pg_stat_statements
) s
ORDER BY total_exec_time DESC
LIMIT 20;

-- 3) LOCK CONTENTION (seating advisory locks / row locks under load) ────────
SELECT bl.pid AS blocked_pid,
       substring(ba.query FROM 1 FOR 60) AS blocked_query,
       kl.pid AS blocking_pid,
       substring(ka.query FROM 1 FOR 60) AS blocking_query
FROM pg_locks bl
JOIN pg_stat_activity ba ON ba.pid = bl.pid
JOIN pg_locks kl ON kl.locktype = bl.locktype AND kl.pid <> bl.pid
                AND kl.transactionid IS NOT DISTINCT FROM bl.transactionid
JOIN pg_stat_activity ka ON ka.pid = kl.pid
WHERE NOT bl.granted;

-- 4) CACHE HIT RATIO (should stay > 0.99; lower => add indexes / RAM) ───────
SELECT round(sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 4) AS heap_cache_hit_ratio
FROM pg_statio_user_tables;

-- 5) LIVE LONG-RUNNING QUERIES (anything stuck > 2s during the run) ─────────
SELECT pid, now() - query_start AS running_for, state,
       substring(regexp_replace(query, '\s+', ' ', 'g') FROM 1 FOR 80) AS query
FROM pg_stat_activity
WHERE state <> 'idle' AND now() - query_start > interval '2 seconds'
ORDER BY running_for DESC;

-- 6) PER-TABLE WRITE PRESSURE (rsvps / sms ledger / seating during the run) ─
SELECT relname, n_tup_ins AS inserts, n_tup_upd AS updates, n_tup_del AS deletes,
       n_live_tup AS live_rows, n_dead_tup AS dead_rows
FROM pg_stat_user_tables
ORDER BY (n_tup_ins + n_tup_upd + n_tup_del) DESC
LIMIT 15;
