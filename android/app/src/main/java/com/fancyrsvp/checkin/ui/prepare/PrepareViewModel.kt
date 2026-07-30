package com.fancyrsvp.checkin.ui.prepare

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fancyrsvp.checkin.data.local.EventEntity
import com.fancyrsvp.checkin.data.repo.BundleRepository
import com.fancyrsvp.checkin.device.DeviceStatusMonitor
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Event selection and preparation (spec §8.2).
 *
 * The screen must state explicitly that internet is required NOW and will not be
 * required at the venue, and it must show real progress with counts rather than an
 * indeterminate spinner — an operator needs to know whether a 2000-guest download
 * is moving or stalled before they leave for the venue.
 */
@HiltViewModel
class PrepareViewModel @Inject constructor(
    private val bundleRepository: BundleRepository,
    private val deviceStatusMonitor: DeviceStatusMonitor,
) : ViewModel() {

    /** Readiness, as §8.2 requires it to be presented. */
    enum class Readiness { READY_OFFLINE, NEEDS_SYNC, NOT_PREPARED }

    data class EventRow(
        val id: String,
        val name: String,
        val venue: String?,
        val startsAt: Long,
        val totalInvited: Int,
        val readiness: Readiness,
        val lastSyncedAt: Long?,
    )

    val events: StateFlow<List<EventRow>> = bundleRepository.observeEvents()
        .map { list -> list.map { it.toRow() } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _progress = MutableStateFlow<BundleRepository.Progress?>(null)
    val progress: StateFlow<BundleRepository.Progress?> = _progress.asStateFlow()

    private val _preparingEventId = MutableStateFlow<String?>(null)
    val preparingEventId: StateFlow<String?> = _preparingEventId.asStateFlow()

    fun prepare(eventId: String, forceRestart: Boolean = false) {
        if (_preparingEventId.value != null) return // one at a time

        val expectedGuests = events.value.firstOrNull { it.id == eventId }?.totalInvited ?: 0

        // Storage is checked BEFORE the download, not during it (§21.9). "Failing
        // loudly at 14:00 in an office is recoverable; failing at 20:00 at a venue is
        // not." A part-written bundle that ran out of space is exactly the silent
        // failure §21.1 exists to prevent.
        if (expectedGuests > 0 && !deviceStatusMonitor.hasRoomForBundle(expectedGuests)) {
            _progress.value = BundleRepository.Progress.Failed(
                BundleRepository.Failure.NoStorage(expectedGuests),
            )
            return
        }

        _preparingEventId.value = eventId
        _progress.value = BundleRepository.Progress.FetchingManifest

        viewModelScope.launch {
            try {
                bundleRepository.prepareEvent(eventId, forceRestart) { p -> _progress.value = p }
            } finally {
                _preparingEventId.value = null
            }
        }
    }

    fun dismissProgress() {
        // Only clears a terminal state. Dismissing mid-download would leave the
        // operator with no indication that a transfer is still running.
        val current = _progress.value
        if (current is BundleRepository.Progress.Done || current is BundleRepository.Progress.Failed) {
            _progress.value = null
        }
    }

    private fun EventEntity.toRow(): EventRow {
        val staleAfterMs = 2 * 60 * 60 * 1000L
        val readiness = when {
            !isReadyOffline -> Readiness.NOT_PREPARED
            lastFullSyncAt == null -> Readiness.NEEDS_SYNC
            System.currentTimeMillis() - lastFullSyncAt > staleAfterMs -> Readiness.NEEDS_SYNC
            else -> Readiness.READY_OFFLINE
        }
        return EventRow(
            id = id,
            name = name,
            venue = venue,
            startsAt = startsAt,
            totalInvited = totalInvited,
            readiness = readiness,
            lastSyncedAt = lastFullSyncAt,
        )
    }
}
