package com.fancyrsvp.checkin.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.fancyrsvp.checkin.data.repo.SyncRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit

/**
 * Drains the outbound queue (spec §21.3).
 *
 * WorkManager rather than a coroutine in a ViewModel, for one reason that matters:
 * it survives process death. A tablet killed by the system mid-drain must resume
 * where it left off — §9.3 makes that an acceptance criterion, because the
 * alternative is losing check-ins that exist nowhere else.
 *
 * ── What this worker must never do ──
 *
 * It must never affect scanning. §5.1 is absolute: the UI never waits on the
 * network, and a user action must never block on connectivity. This worker touches
 * the queue and the network only; a failure here is invisible at the door beyond
 * the pending counter ticking up.
 */
@HiltWorker
class SyncQueueWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val syncRepository: SyncRepository,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val eventId = inputData.getString(KEY_EVENT_ID) ?: return Result.failure()

        // Bounded per invocation. An unbounded loop would hold a WorkManager slot
        // for the whole end-of-event drain and risk the system killing it mid-batch;
        // returning retry() hands control back and resumes promptly.
        var batches = 0
        while (batches < MAX_BATCHES_PER_RUN) {
            batches++

            when (val result = syncRepository.drainOnce(eventId)) {
                is SyncRepository.DrainResult.Complete -> {
                    // Opportunistically pull in other devices' check-ins while
                    // connectivity is evidently available.
                    runCatching { syncRepository.pollDelta(eventId) }
                    runCatching { syncRepository.refreshControls(eventId) }
                    return Result.success(
                        workDataOf(
                            KEY_ACCEPTED to result.accepted,
                            KEY_DUPLICATE to result.duplicate,
                            KEY_CONFLICT to result.conflict,
                        ),
                    )
                }

                is SyncRepository.DrainResult.Partial -> {
                    // More to send. Loop without backing off — the connection is
                    // working and an end-of-event drain should finish quickly.
                    continue
                }

                SyncRepository.DrainResult.SyncDisabled -> {
                    // The kill switch is on (§21.5). Not a failure: local operation
                    // continues untouched and the queue waits. Returning success
                    // stops WorkManager retrying against a deliberate instruction.
                    return Result.success(workDataOf(KEY_SYNC_DISABLED to true))
                }

                is SyncRepository.DrainResult.Failed -> {
                    // Nothing was lost — every entry is still in the database.
                    // retry() lets WorkManager apply the backoff configured below.
                    return if (result.retryable) Result.retry() else Result.failure()
                }
            }
        }

        // Hit the per-run cap with work outstanding. Retry immediately rather than
        // declaring success, so a large drain continues.
        return Result.retry()
    }

    companion object {
        const val KEY_EVENT_ID = "event_id"
        const val KEY_ACCEPTED = "accepted"
        const val KEY_DUPLICATE = "duplicate"
        const val KEY_CONFLICT = "conflict"
        const val KEY_SYNC_DISABLED = "sync_disabled"

        /** ~1000 records per invocation at the configured batch size. */
        private const val MAX_BATCHES_PER_RUN = 10

        private fun workName(eventId: String) = "checkin-sync-$eventId"

        /**
         * Schedules a drain.
         *
         * KEEP rather than REPLACE: several scans in quick succession each ask for a
         * drain, and replacing would cancel a run that is already mid-batch. The
         * existing run will pick up anything enqueued behind it anyway, because it
         * re-reads the queue each batch.
         */
        fun enqueue(context: Context, eventId: String) {
            val request = OneTimeWorkRequestBuilder<SyncQueueWorker>()
                .setInputData(workDataOf(KEY_EVENT_ID to eventId))
                .setConstraints(
                    Constraints.Builder()
                        // CONNECTED, not UNMETERED: a venue's only link is often a
                        // metered hotspot, and refusing to sync over it would strand
                        // the queue for the whole event.
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build(),
                )
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    // WorkManager's own floor is 10s; the finer early rungs of
                    // §21.3's ladder are applied inside the repository, and this is
                    // the coarse outer bound.
                    SyncPolicy.baseRetryDelayMs(1).coerceAtLeast(10_000L),
                    TimeUnit.MILLISECONDS,
                )
                .addTag(TAG)
                .build()

            WorkManager.getInstance(context)
                .enqueueUniqueWork(workName(eventId), ExistingWorkPolicy.KEEP, request)
        }

        /**
         * Cancels scheduled sync for an event.
         *
         * Note what this does NOT do: it does not clear the queue. Cancelling
         * network work and destroying queued check-ins are entirely different acts,
         * and only the first is ever safe to do automatically.
         */
        fun cancel(context: Context, eventId: String) {
            WorkManager.getInstance(context).cancelUniqueWork(workName(eventId))
        }

        const val TAG = "checkin-sync"
    }
}
