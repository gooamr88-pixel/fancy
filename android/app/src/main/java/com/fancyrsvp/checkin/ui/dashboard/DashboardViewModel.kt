package com.fancyrsvp.checkin.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fancyrsvp.checkin.data.local.ArrivalBucket
import com.fancyrsvp.checkin.data.local.CategoryCount
import com.fancyrsvp.checkin.data.local.CheckinDatabase
import com.fancyrsvp.checkin.data.local.StaffActivity
import com.fancyrsvp.checkin.data.repo.CheckInRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

/**
 * Live attendance dashboard (spec §8.6).
 *
 * Everything is read from the LOCAL database, so it works with no connectivity —
 * the numbers reflect what this device knows, which during an event is what the
 * supervisor standing next to it needs.
 *
 * Supervisor-only sections (§18.2): pending sync count, conflicts, per-staff
 * activity. Hiding them from an usher is a UX decision, not a security control —
 * the server validates every privileged action independently.
 */
@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val db: CheckinDatabase,
    private val checkInRepository: CheckInRepository,
) : ViewModel() {

    data class Summary(
        val arrived: Int,
        val totalInvited: Int,
        val pendingSync: Int,
        val stalled: Int,
        val conflicts: Int,
        val categories: List<CategoryCount>,
        val arrivals: List<ArrivalBucket>,
        val staff: List<StaffActivity>,
        val lastSyncedAt: Long?,
    ) {
        /** Percent of invited guests who have arrived, 0–100. */
        val progressPercent: Int
            get() = if (totalInvited <= 0) 0 else (arrived * 100) / totalInvited

        /** The busiest bucket, for the peak marker. */
        val peakBucket: ArrivalBucket? get() = arrivals.maxByOrNull { it.count }
    }

    private val _eventId = MutableStateFlow<String?>(null)

    /** 15-minute buckets — the granularity a venue actually staffs against. */
    private val bucketMs = 15 * 60 * 1000L

    @OptIn(ExperimentalCoroutinesApi::class)
    val summary: StateFlow<Summary?> = _eventId
        .flatMapLatest { eventId ->
            if (eventId == null) {
                flowOf(null)
            } else {
                // Two nested combines: Flow.combine tops out at five sources and
                // this needs eight. The intermediate is a typed data class rather
                // than an Array<Any> — an array here would need unchecked casts,
                // and a reordered source would then fail at runtime on a supervisor's
                // screen instead of at compile time.
                val counts = combine(
                    checkInRepository.observeArrivedCount(eventId),
                    checkInRepository.observePendingCount(),
                    db.syncQueueDao().observeStalledCount(),
                    db.conflictDao().observeUnacknowledged(eventId),
                    db.eventDao().observe(eventId),
                ) { arrived, pending, stalled, conflicts, event ->
                    Counts(arrived, pending, stalled, conflicts.size, event?.totalInvited ?: 0, event?.lastFullSyncAt)
                }

                combine(
                    counts,
                    db.guestDao().observeCategoryBreakdown(eventId),
                    db.checkInDao().observeArrivalBuckets(eventId, bucketMs),
                    db.checkInDao().observeStaffActivity(eventId),
                ) { base, categories, arrivals, staff ->
                    Summary(
                        arrived = base.arrived,
                        totalInvited = base.totalInvited,
                        pendingSync = base.pending,
                        stalled = base.stalled,
                        conflicts = base.conflicts,
                        categories = categories,
                        arrivals = arrivals,
                        staff = staff,
                        lastSyncedAt = base.lastSyncedAt,
                    )
                }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun start(eventId: String) {
        _eventId.value = eventId
    }

    /** Intermediate for the nested combine. Not exposed. */
    private data class Counts(
        val arrived: Int,
        val pending: Int,
        val stalled: Int,
        val conflicts: Int,
        val totalInvited: Int,
        val lastSyncedAt: Long?,
    )
}
