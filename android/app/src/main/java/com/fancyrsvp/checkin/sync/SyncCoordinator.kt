package com.fancyrsvp.checkin.sync

import android.content.Context
import com.fancyrsvp.checkin.data.local.CheckinDatabase
import com.fancyrsvp.checkin.data.repo.BundleRepository
import com.fancyrsvp.checkin.data.repo.SyncRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Drives the polling fallback and reacts to connectivity (spec §17.5, §19.6).
 *
 * ── Polling first, deliberately ──
 *
 * §17.1: "Implement and test the polling fallback FIRST, then add realtime on
 * top." This class is that fallback, and it is sufficient for every acceptance
 * criterion in §9.2 — realtime only narrows the propagation window from a poll
 * interval to seconds. Realtime is additionally blocked by discovery finding R-2:
 * the Supabase channel has no authorisation model, and subscribing with the anon
 * key would let any holder of it read any event's guest data.
 *
 * ── What must never happen here ──
 *
 * Nothing in this class may block, slow, or gate a scan. It runs on its own scope,
 * every network call is wrapped, and a total failure of this coordinator leaves the
 * app fully functional offline — which is what the whole architecture assumes.
 */
@Singleton
class SyncCoordinator @Inject constructor(
    @ApplicationContext private val context: Context,
    private val connectionMonitor: ConnectionMonitor,
    private val syncRepository: SyncRepository,
    private val bundleRepository: BundleRepository,
    private val db: CheckinDatabase,
) {

    private val _connection = MutableStateFlow(ConnectionState.OFFLINE)
    val connection: StateFlow<ConnectionState> = _connection.asStateFlow()

    private var pollJob: Job? = null
    private var watchJob: Job? = null
    private var guestDeltaJob: Job? = null
    private var activeEventId: String? = null

    /**
     * Starts syncing for an event.
     *
     * @param scope an application-lifetime scope. Deliberately not a ViewModel
     *   scope: the drain must survive the scanner screen being recreated, and a
     *   rotation must not abandon a half-finished poll.
     */
    fun start(scope: CoroutineScope, eventId: String) {
        if (activeEventId == eventId && pollJob?.isActive == true) return
        stop()
        activeEventId = eventId

        watchJob = scope.launch {
            connectionMonitor.observe().collect { state ->
                val previous = _connection.value
                _connection.value = state

                // §17.5: on network regain, a single immediate delta fetch fires
                // rather than waiting out the poll interval. This is what closes the
                // multi-entrance gap quickly after venue Wi-Fi returns.
                if (previous == ConnectionState.OFFLINE && state != ConnectionState.OFFLINE) {
                    runCatching { syncRepository.pollDelta(eventId) }
                    SyncQueueWorker.enqueue(context, eventId)
                }
            }
        }

        pollJob = scope.launch {
            while (isActive) {
                val state = _connection.value
                val interval = SyncPolicy.pollIntervalMs(state, eventInProgress = true)

                if (interval == null) {
                    // Offline: suspended. Re-checked on a short tick rather than
                    // relying solely on the callback, because a missed callback would
                    // otherwise strand polling for the whole event.
                    delay(OFFLINE_RECHECK_MS)
                    continue
                }

                runCatching {
                    // Loop while the server reports truncation — "more remains" must
                    // not wait a full interval, or a busy event never catches up.
                    var more = syncRepository.pollDelta(eventId)
                    var guard = 0
                    while (more && guard < MAX_TRUNCATED_FOLLOWUPS && isActive) {
                        guard++
                        more = syncRepository.pollDelta(eventId)
                    }
                }

                runCatching { syncRepository.refreshControls(eventId) }

                // Anything queued while offline goes out as soon as there is a link.
                if (db.syncQueueDao().depthForEvent(eventId) > 0) {
                    SyncQueueWorker.enqueue(context, eventId)
                }

                delay(interval)
            }
        }

        guestDeltaJob = scope.launch {
            // §19.6: a guest-data delta check every 10 minutes while online during a
            // live event. Separate from the check-in poll because it is far heavier
            // and answers a different question — has the ORGANIZER changed anything.
            while (isActive) {
                delay(SyncPolicy.GUEST_DELTA_INTERVAL_MS)
                if (_connection.value == ConnectionState.OFFLINE) continue

                val applied = runCatching { bundleRepository.applyGuestDelta(eventId) }
                    .getOrDefault(false)
                if (!applied) {
                    // The server could not serve a delta (version too old, or the
                    // change volume makes a re-download cheaper). A full refresh is
                    // NOT started automatically: §19.6 makes that a supervisor
                    // action, because re-downloading mid-event on a weak venue link
                    // could take minutes and must be a deliberate choice.
                    db.eventDao().byId(eventId)
                }
            }
        }
    }

    /**
     * Stops polling.
     *
     * Does not cancel the queue worker: outbound check-ins must keep draining even
     * after the scanner screen is closed, because they exist nowhere else.
     */
    fun stop() {
        pollJob?.cancel()
        watchJob?.cancel()
        guestDeltaJob?.cancel()
        pollJob = null
        watchJob = null
        guestDeltaJob = null
        activeEventId = null
    }

    /** Called after a local check-in so the queue drains promptly when online. */
    fun requestDrain(eventId: String) {
        SyncQueueWorker.enqueue(context, eventId)
    }

    private companion object {
        const val OFFLINE_RECHECK_MS = 15_000L

        /**
         * Shared with the drain path rather than redeclared. Both loops chase the
         * same truncated delta against the same server page size, so two copies
         * could be tuned apart and produce a fleet that catches up at one rate
         * while uploading and another while idle.
         */
        const val MAX_TRUNCATED_FOLLOWUPS =
            com.fancyrsvp.checkin.data.repo.SyncRepository.MAX_TRUNCATED_FOLLOWUPS
    }
}
