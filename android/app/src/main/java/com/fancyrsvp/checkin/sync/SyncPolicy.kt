package com.fancyrsvp.checkin.sync

import kotlin.math.pow
import kotlin.random.Random

/**
 * Retry and polling policy for the sync engine (spec §17.5, §21.3).
 *
 * Deliberately pure and free of Android types so it can be unit-tested on the
 * JVM. Every number here has a failure mode behind it, and getting one wrong is
 * the difference between a device that quietly catches up and a device that
 * flattens a venue's Wi-Fi or drains its own battery.
 */
object SyncPolicy {

    /**
     * Outbound retry schedule (§21.3): 5s, 15s, 60s, 300s, then every 15 minutes.
     *
     * A failing device must not hold the network busy or drain its own battery
     * retrying in a tight loop — but it also must not give up, because a queued
     * check-in exists nowhere else.
     */
    private val RETRY_LADDER_MS = longArrayOf(5_000, 15_000, 60_000, 300_000)
    private const val RETRY_CEILING_MS = 15 * 60 * 1000L

    /**
     * After this many consecutive failures an entry is marked `stalled` and raised
     * to the supervisor view. It is NOT deleted — §21.3 is explicit that nothing
     * leaves the queue without server confirmation.
     */
    const val STALL_THRESHOLD = 10

    /** Records per batch. A drain of 500 becomes 5 requests, not 500. */
    const val BATCH_SIZE = 100

    /**
     * Jitter, ±20% (§17.6).
     *
     * Without it, ten devices that lost venue Wi-Fi together reconnect in
     * lockstep and hammer the server simultaneously the moment it returns —
     * turning one outage into a thundering herd.
     */
    private const val JITTER_FRACTION = 0.20

    /**
     * Backoff for the nth consecutive failure (1-based), with jitter applied.
     *
     * @param random injectable so tests can assert the un-jittered base and the
     *   jitter bounds separately.
     */
    fun retryDelayMs(attempt: Int, random: Random = Random.Default): Long {
        val base = baseRetryDelayMs(attempt)
        val spread = (base * JITTER_FRACTION).toLong()
        if (spread == 0L) return base
        // Uniform in [base - spread, base + spread].
        return base - spread + random.nextLong(2 * spread + 1)
    }

    /** The ladder value with no jitter — the shape the spec specifies. */
    fun baseRetryDelayMs(attempt: Int): Long {
        if (attempt <= 0) return RETRY_LADDER_MS.first()
        return RETRY_LADDER_MS.getOrElse(attempt - 1) { RETRY_CEILING_MS }
    }

    /**
     * Reconnection backoff for the realtime channel (§17.6): starts at 1s, doubles
     * to a 30s ceiling, jittered.
     *
     * Separate from the outbound ladder because they answer different questions —
     * one is "when should I retry sending data I hold", the other is "when should I
     * retry establishing a listener".
     */
    fun reconnectDelayMs(attempt: Int, random: Random = Random.Default): Long {
        // The exponent is clamped BEFORE the power is taken. 2^5 * 1s already
        // exceeds the 30s ceiling, so nothing above that is meaningful — and
        // without the clamp a large attempt count saturates Long, overflows on the
        // multiply, and yields a NEGATIVE delay that the ceiling clamp then happily
        // returns. A negative delay means reconnect immediately, forever.
        val steps = (attempt - 1).coerceIn(0, MAX_RECONNECT_DOUBLINGS)
        val base = (1_000L * 2.0.pow(steps).toLong()).coerceAtMost(RECONNECT_CEILING_MS)
        val spread = (base * JITTER_FRACTION).toLong()
        if (spread == 0L) return base
        return base - spread + random.nextLong(2 * spread + 1)
    }

    private const val MAX_RECONNECT_DOUBLINGS = 5
    private const val RECONNECT_CEILING_MS = 30_000L

    /**
     * Polling interval for the delta fallback (§17.5).
     *
     * `CONNECTED` still polls, at a slow 120s: it is a safety net against SILENT
     * channel death, which is common on captive-portal and carrier-grade-NAT
     * networks — which describes most venue Wi-Fi. A device that believes it is
     * subscribed but is not would otherwise never notice.
     */
    fun pollIntervalMs(state: ConnectionState, eventInProgress: Boolean): Long? = when (state) {
        ConnectionState.CONNECTED -> 120_000L
        // 10 s during a live event (amendment A-15, tightened from §17.5's 20 s).
        // Cheap now that batch responses carry the delta inline: during a rush the
        // timer barely fires, because uploads are already converging the fleet.
        // It matters most at a QUIET gate, where nothing is being uploaded and the
        // timer is the only channel — which is exactly where 20 s was too slow.
        ConnectionState.DEGRADED -> if (eventInProgress) 10_000L else 60_000L
        ConnectionState.CONNECTING -> 20_000L
        // Suspended entirely. A single immediate delta fetch fires on network
        // regain instead — polling with no network just burns battery.
        ConnectionState.OFFLINE -> null
    }

    /**
     * How long a nominally-connected channel may be silent before it is treated as
     * dead (§17.6).
     */
    const val HEARTBEAT_TIMEOUT_MS = 90_000L

    /** Guest-data delta check while online during a live event (§19.6). */
    const val GUEST_DELTA_INTERVAL_MS = 10 * 60 * 1000L

    /**
     * Decides what to do with one element of a batch response.
     *
     * Extracted so the mapping from server verdict to local action is stated once
     * and can be tested exhaustively — §21.3's whole point is that a wrong branch
     * here silently destroys check-ins that exist nowhere else.
     */
    fun actionFor(status: String): QueueAction = when (status) {
        // Newly recorded, or this exact client_checkin_id was already recorded.
        // Both mean the server HOLDS it, which is the only condition under which
        // an entry may leave the queue.
        "accepted", "duplicate" -> QueueAction.CONFIRM_AND_REMOVE

        // A different record already exists for this guest. The local row is marked
        // and surfaced to the supervisor; the queue entry is removed because
        // re-sending it would only produce the same conflict forever.
        "conflict" -> QueueAction.MARK_CONFLICT_AND_REMOVE

        // The server cannot place this record at all (unknown guest, malformed).
        // Retrying will never succeed, but it must NOT vanish silently — it is
        // raised to the supervisor with the reason attached.
        "rejected" -> QueueAction.MARK_STALLED_AND_KEEP

        // An unrecognised status from a newer server. Keep and retry: assuming
        // success on an unknown verdict is the one mistake that loses data.
        else -> QueueAction.RETRY
    }

    enum class QueueAction {
        CONFIRM_AND_REMOVE,
        MARK_CONFLICT_AND_REMOVE,
        MARK_STALLED_AND_KEEP,
        RETRY,
    }
}

/**
 * Connection state as staff-facing behaviour, not as transport detail (§17.6).
 *
 * `DEGRADED` means the network is present but the realtime channel is not — so
 * polling is active. That is a NORMAL, expected state at venues, and §17.7 forbids
 * presenting it to staff as a failure.
 */
enum class ConnectionState {
    OFFLINE,
    CONNECTING,
    CONNECTED,
    DEGRADED,
}
