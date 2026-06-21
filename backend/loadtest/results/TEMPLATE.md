# Load Test Results — Fancy RSVP

**Run date:** ____  **Target:** `____` (env: staging / prod-like)
**Hardware:** API ___ vCPU / ___ GB · DB plan ___ · k6 generator ___ vCPU
**Build/commit:** `____`  ·  **Rate limiter:** disabled / raised? ____

> Read avg/p95/p99 from the **steady-state** window (the 3-minute hold), not the ramp.
> Each level is `k6 run -e LEVEL=<N> ...`; system CSV from `monitor/sampler.js`; DB from `monitor/db_monitor.sql`.

## 1. Headline matrix (mixed / guest journey)

| Level (VUs) | RPS | Reqs OK | Error % | RSVP p95 | RSVP p99 | Browse p95 | Overall p95 | Overall p99 | Verdict |
|------------:|----:|--------:|--------:|---------:|---------:|-----------:|------------:|------------:|---------|
| 100         |     |         |         |          |          |            |             |             | ✅ / ⚠️ / ❌ |
| 500         |     |         |         |          |          |            |             |             |          |
| 1000        |     |         |         |          |          |            |             |             |          |
| 5000        |     |         |         |          |          |            |             |             |          |

*Verdict key:* ✅ within SLO · ⚠️ degraded (p95/p99 breached, errors <1%) · ❌ breaking point (errors ≥1% or timeouts/restarts).

## 2. Resource consumption (from `monitor/sampler.js` + `pm2 monit`)

| Level | API CPU % (avg / peak) | API mem MB (avg / peak) | pm2 restarts? | Node event-loop lag* |
|------:|------------------------|-------------------------|---------------|----------------------|
| 100   |                        |                         |               |                      |
| 500   |                        |                         |               |                      |
| 1000  |                        |                         |               |                      |
| 5000  |                        |                         |               |                      |

\* event-loop lag from `clinic doctor` or `process` telemetry if instrumented.
**Watch:** `max_memory_restart: 500M` in `ecosystem.config.js` — a restart mid-run shows up here as a spike + a burst of 502s.

## 3. Database (from `db_monitor.sql`)

| Level | Total conns | Active | Idle-in-txn | Waiting on locks | Pool max | Cache hit ratio | Slowest stmt (mean ms) |
|------:|------------:|-------:|------------:|-----------------:|---------:|----------------:|------------------------|
| 100   |             |        |             |                  |          |                 |                        |
| 500   |             |        |             |                  |          |                 |                        |
| 1000  |             |        |             |                  |          |                 |                        |
| 5000  |             |        |             |                  |          |                 |                        |

## 4. Top DB statements by total time (paste from probe #2)

| Query (truncated) | calls | mean ms | total ms |
|-------------------|------:|--------:|---------:|
|                   |       |         |          |

---

## How to interpret

- **Breaking point** = the lowest level where any is true: error rate ≥ 1%, p99 crosses your SLO ceiling, throughput (RPS) **stops rising while VUs rise** (saturation), or the API process restarts (OOM).
- **Latency shape:** if **p99 ≫ p95 ≫ avg**, a subset of requests is queuing — usually connection-pool saturation or event-loop blocking, not raw compute.
- **RPS plateau:** when RPS flattens as VUs climb, you've hit a ceiling (DB pool, CPU, or downstream API). The number where it plateaus is your real capacity.
- **CPU vs latency:** high latency with **low** CPU ⇒ waiting (DB/pooler/network). High latency with **pegged** CPU ⇒ compute (PBKDF2 logins, JSON serialization, exceljs exports).
- **idle-in-transaction climbing** ⇒ transactions held open (or pooler in session mode) — a top cause of pool exhaustion.
- **Cache hit ratio < 0.99** ⇒ missing indexes or undersized DB RAM.
