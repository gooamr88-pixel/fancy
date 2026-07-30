package com.fancyrsvp.checkin.ui.entrance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fancyrsvp.checkin.data.local.CheckinDatabase
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
 * State for the entrance display (spec §8.8).
 *
 * Deliberately the narrowest surface in the app: an event name, a count, a total, and
 * a brand colour. Nothing else is exposed, because anything exposed here is exposed
 * to everyone walking through the lobby.
 *
 * In particular there are NO guest names and no per-guest data. A wall-mounted screen
 * listing who has arrived at a private event is a disclosure to every passer-by, and
 * the spec's showcase intent is served entirely by the counter.
 */
@HiltViewModel
class EntranceDisplayViewModel @Inject constructor(
    private val db: CheckinDatabase,
    private val checkInRepository: CheckInRepository,
) : ViewModel() {

    data class DisplayState(
        val eventName: String,
        val arrived: Int,
        val totalInvited: Int,
        val brandingColorHex: String?,
    )

    private val _eventId = MutableStateFlow<String?>(null)

    @OptIn(ExperimentalCoroutinesApi::class)
    val state: StateFlow<DisplayState?> = _eventId
        .flatMapLatest { eventId ->
            if (eventId == null) {
                flowOf(null)
            } else {
                combine(
                    db.eventDao().observe(eventId),
                    checkInRepository.observeArrivedCount(eventId),
                ) { event, arrived ->
                    event?.let {
                        DisplayState(
                            eventName = it.name,
                            arrived = arrived,
                            totalInvited = it.totalInvited,
                            brandingColorHex = it.brandingPrimaryColor,
                        )
                    }
                }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun start(eventId: String) {
        _eventId.value = eventId
    }
}
