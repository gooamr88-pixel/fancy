package com.fancyrsvp.checkin.sync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/**
 * Sync policy (spec §17.5, §17.6, §21.3).
 *
 * The most consequential tests in the app. §21.3's requirement is absolute:
 * nothing leaves the queue without explicit server confirmation, because a queued
 * check-in exists ONLY on that device. A wrong branch in [SyncPolicy.actionFor]
 * destroys a guest's arrival record with no error and no trace.
 */
class SyncPolicyTest {

    // ══════════════════════════════════════════════════════════════
    // Queue outcomes — the branch that can lose data
    // ══════════════════════════════════════════════════════════════

    @Test
    fun `accepted and duplicate both release the queue entry`() {
        // duplicate means the server ALREADY HOLDS this exact client_checkin_id.
        // Treating it as anything but success would make an idempotent replay
        // retry forever.
        assertEquals(SyncPolicy.QueueAction.CONFIRM_AND_REMOVE, SyncPolicy.actionFor("accepted"))
        assertEquals(SyncPolicy.QueueAction.CONFIRM_AND_REMOVE, SyncPolicy.actionFor("duplicate"))
    }

    @Test
    fun `conflict is marked and removed, never silently dropped`() {
        // Re-sending would reproduce the same conflict forever, so the entry goes —
        // but the local row is marked so it reaches the supervisor view (§5.3 L4).
        assertEquals(
            SyncPolicy.QueueAction.MARK_CONFLICT_AND_REMOVE,
            SyncPolicy.actionFor("conflict"),
        )
    }

    @Test
    fun `rejected is stalled and KEPT, because retrying cannot fix it but losing it is worse`() {
        assertEquals(
            SyncPolicy.QueueAction.MARK_STALLED_AND_KEEP,
            SyncPolicy.actionFor("rejected"),
        )
    }

    @Test
    fun `an unknown status from a newer server is retried, never assumed successful`() {
        // Assuming success on a verdict we do not understand is the single mistake
        // that permanently loses a check-in.
        for (status in listOf("", "queued", "throttled", "ACCEPTED", "accepted_v2", "unknown")) {
            assertEquals(
                "status=$status must not be treated as confirmed",
                SyncPolicy.QueueAction.RETRY,
                SyncPolicy.actionFor(status),
            )
        }
    }

    @Test
    fun `no status maps to a plain delete without confirmation`() {
        val statuses = listOf("accepted", "duplicate", "conflict", "rejected", "weird")
        for (s in statuses) {
            val action = SyncPolicy.actionFor(s)
            if (action == SyncPolicy.QueueAction.CONFIRM_AND_REMOVE) {
                assertTrue("only accepted/duplicate may confirm", s == "accepted" || s == "duplicate")
            }
        }
    }

    // ══════════════════════════════════════════════════════════════
    // Outbound retry ladder (§21.3): 5s, 15s, 60s, 300s, then 15min
    // ══════════════════════════════════════════════════════════════

    @Test
    fun `the retry ladder matches the spec exactly`() {
        assertEquals(5_000L, SyncPolicy.baseRetryDelayMs(1))
        assertEquals(15_000L, SyncPolicy.baseRetryDelayMs(2))
        assertEquals(60_000L, SyncPolicy.baseRetryDelayMs(3))
        assertEquals(300_000L, SyncPolicy.baseRetryDelayMs(4))
    }

    @Test
    fun `beyond the ladder it settles at fifteen minutes, forever`() {
        for (attempt in 5..500) {
            assertEquals(
                "attempt $attempt",
                15 * 60 * 1000L,
                SyncPolicy.baseRetryDelayMs(attempt),
            )
        }
    }

    @Test
    fun `a zero or negative attempt falls back to the first rung rather than misbehaving`() {
        assertEquals(5_000L, SyncPolicy.baseRetryDelayMs(0))
        assertEquals(5_000L, SyncPolicy.baseRetryDelayMs(-3))
    }

    @Test
    fun `retry delay is never negative and never zero at any attempt`() {
        // A non-positive delay means "retry immediately, forever" — a battery and
        // bandwidth sink that would also hammer the server.
        val random = Random(1234)
        for (attempt in -5..300) {
            val delay = SyncPolicy.retryDelayMs(attempt, random)
            assertTrue("attempt $attempt gave $delay", delay > 0)
        }
    }

    @Test
    fun `jitter stays within plus or minus twenty percent of the base`() {
        val random = Random(99)
        for (attempt in 1..6) {
            val base = SyncPolicy.baseRetryDelayMs(attempt)
            val lo = (base * 0.8).toLong()
            val hi = (base * 1.2).toLong()
            repeat(200) {
                val delay = SyncPolicy.retryDelayMs(attempt, random)
                assertTrue("$delay outside [$lo,$hi] for attempt $attempt", delay in lo..hi)
            }
        }
    }

    @Test
    fun `jitter actually varies, so devices do not reconnect in lockstep`() {
        // The whole point (§17.6): ten tablets that lost venue Wi-Fi together must
        // not all retry on the same millisecond when it returns.
        val random = Random(7)
        val seen = (1..50).map { SyncPolicy.retryDelayMs(3, random) }.toSet()
        assertTrue("jitter produced only ${seen.size} distinct values", seen.size > 10)
    }

    // ══════════════════════════════════════════════════════════════
    // Realtime reconnect backoff (§17.6): 1s doubling to a 30s ceiling
    // ══════════════════════════════════════════════════════════════

    @Test
    fun `reconnect backoff doubles from one second`() {
        val fixed = Random(0)
        // Compare bases via the jitter bounds rather than exact equality.
        assertTrue(SyncPolicy.reconnectDelayMs(1, fixed) in 800L..1_200L)
        assertTrue(SyncPolicy.reconnectDelayMs(2, fixed) in 1_600L..2_400L)
        assertTrue(SyncPolicy.reconnectDelayMs(3, fixed) in 3_200L..4_800L)
        assertTrue(SyncPolicy.reconnectDelayMs(4, fixed) in 6_400L..9_600L)
    }

    @Test
    fun `reconnect backoff is capped at thirty seconds and never overflows`() {
        // The regression this guards: computing 2^attempt before clamping saturates
        // Long at a high attempt count, overflows the multiply, and yields a
        // NEGATIVE delay that a ceiling clamp would pass straight through.
        val random = Random(5)
        for (attempt in intArrayOf(6, 10, 32, 63, 64, 1000, Int.MAX_VALUE)) {
            val delay = SyncPolicy.reconnectDelayMs(attempt, random)
            assertTrue("attempt $attempt gave $delay", delay > 0)
            assertTrue("attempt $attempt gave $delay", delay <= 36_000L)
        }
    }

    // ══════════════════════════════════════════════════════════════
    // Polling schedule (§17.5)
    // ══════════════════════════════════════════════════════════════

    @Test
    fun `offline suspends polling entirely`() {
        // Polling with no network burns battery for nothing. A single immediate
        // fetch fires on regain instead.
        assertNull(SyncPolicy.pollIntervalMs(ConnectionState.OFFLINE, eventInProgress = true))
        assertNull(SyncPolicy.pollIntervalMs(ConnectionState.OFFLINE, eventInProgress = false))
    }

    @Test
    fun `a healthy realtime connection STILL polls, as a silent-death safety net`() {
        // §17.5: 120s. Captive portals and CGNAT silently kill channels, and a
        // device that believes it is subscribed but is not would never catch up.
        assertEquals(120_000L, SyncPolicy.pollIntervalMs(ConnectionState.CONNECTED, true))
        assertEquals(120_000L, SyncPolicy.pollIntervalMs(ConnectionState.CONNECTED, false))
    }

    @Test
    fun `degraded polls every ten seconds during a live event`() {
        // Amendment A-15 tightened this from §17.5's 20 s. Affordable because batch
        // responses now carry the delta inline, so during a rush this timer barely
        // fires — it matters at a QUIET gate, where nothing is being uploaded and
        // the timer is the only channel.
        assertEquals(10_000L, SyncPolicy.pollIntervalMs(ConnectionState.DEGRADED, true))
        assertEquals(60_000L, SyncPolicy.pollIntervalMs(ConnectionState.DEGRADED, false))
    }

    @Test
    fun `degraded polls at least as often as connected - it is the only channel`() {
        val degraded = SyncPolicy.pollIntervalMs(ConnectionState.DEGRADED, true)!!
        val connected = SyncPolicy.pollIntervalMs(ConnectionState.CONNECTED, true)!!
        assertTrue(degraded < connected)
    }

    // ══════════════════════════════════════════════════════════════
    // Constants the rest of the engine depends on
    // ══════════════════════════════════════════════════════════════

    @Test
    fun `the stall threshold matches the spec`() {
        assertEquals(10, SyncPolicy.STALL_THRESHOLD)
    }

    @Test
    fun `the batch size keeps an end-of-event drain to a handful of requests`() {
        // 500 queued check-ins must not become 500 requests — §21.9 requires a
        // legitimate drain never be throttled.
        assertEquals(100, SyncPolicy.BATCH_SIZE)
        assertTrue(500 / SyncPolicy.BATCH_SIZE <= 5)
    }

    @Test
    fun `the heartbeat timeout matches the spec`() {
        assertEquals(90_000L, SyncPolicy.HEARTBEAT_TIMEOUT_MS)
    }

    @Test
    fun `connection states cover exactly the spec's four`() {
        assertEquals(4, ConnectionState.entries.size)
        assertNotEquals(ConnectionState.DEGRADED, ConnectionState.OFFLINE)
    }
}
