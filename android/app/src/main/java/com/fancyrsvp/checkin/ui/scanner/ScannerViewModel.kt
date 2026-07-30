package com.fancyrsvp.checkin.ui.scanner

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fancyrsvp.checkin.data.local.CheckinDatabase
import com.fancyrsvp.checkin.data.repo.CheckInRepository
import com.fancyrsvp.checkin.data.repo.DeviceRepository
import com.fancyrsvp.checkin.device.DeviceStatusMonitor
import com.fancyrsvp.checkin.di.ApplicationScope
import com.fancyrsvp.checkin.sync.ConnectionState
import com.fancyrsvp.checkin.sync.SyncCoordinator
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The scanner screen's state (spec §8.3, §8.4).
 *
 * Holds the current scan result, the arrival counter, and the connection strip.
 * Every decision it makes is local — the sync engine is a separate concern, and a
 * scan must never wait on it (§5.1).
 */
@HiltViewModel
class ScannerViewModel @Inject constructor(
    private val checkInRepository: CheckInRepository,
    private val deviceRepository: DeviceRepository,
    private val syncCoordinator: SyncCoordinator,
    private val deviceStatusMonitor: DeviceStatusMonitor,
    @ApplicationScope private val appScope: CoroutineScope,
    private val db: CheckinDatabase,
) : ViewModel() {

    /** Who is operating the tablet right now (§18.1). Set at login. */
    data class Operator(
        val staffId: String?,
        val displayName: String?,
        val role: String,
    ) {
        val isSupervisor: Boolean get() = role == "supervisor"
    }

    /**
     * Connection presentation (§17.7).
     *
     * Operational language only. Staff never see the words socket, channel, or
     * sync error, and an amber "offline" must not read as a fault — the app is
     * designed for that state, and a fault-shaped message makes staff stop working.
     */
    enum class ConnectionLabel { SYNCED, OFFLINE_CLEAN, OFFLINE_PENDING, NEEDS_ATTENTION }

    data class StatusStrip(
        val arrived: Int,
        val totalInvited: Int,
        val pending: Int,
        val connection: ConnectionLabel,
        val operatorName: String?,
        val freshnessMillis: Long?,
    )

    private val _operator = MutableStateFlow(Operator(null, null, "usher"))
    val operator: StateFlow<Operator> = _operator.asStateFlow()

    private val _outcome = MutableStateFlow<CheckInRepository.ScanOutcome?>(null)
    val outcome: StateFlow<CheckInRepository.ScanOutcome?> = _outcome.asStateFlow()

    private val _resolving = MutableStateFlow(false)
    val resolving: StateFlow<Boolean> = _resolving.asStateFlow()

    /** The token from the scan that produced [outcome], for server verification. */
    private var pendingScanToken: String? = null

    private val _eventId = MutableStateFlow<String?>(null)

    @OptIn(ExperimentalCoroutinesApi::class)
    val status: StateFlow<StatusStrip?> = _eventId
        .flatMapLatest { eventId ->
            if (eventId == null) {
                flowOf(null)
            } else {
                combine(
                    checkInRepository.observeArrivedCount(eventId),
                    checkInRepository.observePendingCount(),
                    db.eventDao().observe(eventId),
                    syncCoordinator.connection,
                    _operator,
                ) { arrived, pending, event, connection, op ->
                    StatusStrip(
                        arrived = arrived,
                        totalInvited = event?.totalInvited ?: 0,
                        pending = pending,
                        connection = labelFor(connection, pending),
                        operatorName = op.displayName,
                        freshnessMillis = event?.lastFullSyncAt,
                    )
                }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    /**
     * Maps transport state to what staff are shown (§17.7).
     *
     * Two rules from the spec, both easy to get wrong:
     *
     *  • CONNECTED and DEGRADED both display as "Synced". Polling is invisible to
     *    staff, and DEGRADED is a normal venue condition, not a fault. Surfacing
     *    the difference would have staff chasing an engineering distinction.
     *  • Offline with an empty queue is NEUTRAL, not amber. The app is designed for
     *    that state; a warning colour there teaches staff to ignore warnings.
     *
     * Amber appears only when there is genuinely something outstanding.
     */
    private fun labelFor(connection: ConnectionState, pending: Int): ConnectionLabel = when {
        connection == ConnectionState.OFFLINE && pending > 0 -> ConnectionLabel.OFFLINE_PENDING
        connection == ConnectionState.OFFLINE -> ConnectionLabel.OFFLINE_CLEAN
        // Network present. A backlog while connected means the drain is failing
        // rather than merely waiting, which is worth a supervisor's attention.
        pending > STUCK_QUEUE_THRESHOLD -> ConnectionLabel.NEEDS_ATTENTION
        pending > 0 -> ConnectionLabel.OFFLINE_PENDING
        else -> ConnectionLabel.SYNCED
    }

    /** True when this event forbids children, read from the bundled event row. */
    private val _noKidsAllowed = MutableStateFlow(false)
    val noKidsAllowed: StateFlow<Boolean> = _noKidsAllowed.asStateFlow()

    /** Battery and storage, for the §21.9 warnings. */
    val deviceStatus: StateFlow<DeviceStatusMonitor.Status> = deviceStatusMonitor.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), deviceStatusMonitor.current())

    /**
     * Whether the 10% modal has been acknowledged this session.
     *
     * Once dismissed it stays dismissed: §21.9 wants a deliberate acknowledgement,
     * not a dialog that reappears every percent and ends up being tapped through
     * reflexively with a queue forming at the door.
     */
    private val _batteryAcknowledged = MutableStateFlow(false)
    val batteryAcknowledged: StateFlow<Boolean> = _batteryAcknowledged.asStateFlow()

    fun acknowledgeBattery() {
        _batteryAcknowledged.value = true
    }

    fun start(eventId: String, staffId: String?, staffName: String?, role: String) {
        _eventId.value = eventId
        _operator.value = Operator(staffId, staffName, role)

        viewModelScope.launch {
            // Read from the bundle rather than defaulted. Showing the wrong answer
            // here means an usher either admits a child at an adults-only event or
            // turns a family away from one that welcomes them.
            _noKidsAllowed.value = db.eventDao().byId(eventId)?.noKidsAllowed ?: false
        }

        // The coordinator runs on an application-lifetime scope, NOT viewModelScope:
        // a drain must survive this screen being recreated on rotation, because a
        // queued check-in exists nowhere else.
        syncCoordinator.start(appScope, eventId)
    }

    /**
     * Handles a decoded QR value.
     *
     * Resolution only — nothing is recorded here. The result screen is shown first
     * so an usher confirms, and so a party arriving in halves can be presented for
     * selection rather than admitted wholesale (§9.1).
     */
    fun onDecoded(value: String) {
        val eventId = _eventId.value ?: return
        if (_resolving.value || _outcome.value != null) return

        _resolving.value = true
        viewModelScope.launch {
            pendingScanToken = com.fancyrsvp.checkin.scan.TicketResolver.extractToken(value)
            _outcome.value = checkInRepository.resolveScan(value, eventId)
            _resolving.value = false
        }
    }

    /** Manual search fallback (§8.5, §10) — always one tap away. */
    suspend fun search(query: String): List<CheckInRepository.PartyView> {
        val eventId = _eventId.value ?: return emptyList()
        return checkInRepository.search(eventId, query)
    }

    fun showParty(party: CheckInRepository.PartyView) {
        pendingScanToken = null
        _outcome.value = if (party.unarrived.isEmpty()) {
            CheckInRepository.ScanOutcome.AlreadyCheckedIn(party)
        } else {
            CheckInRepository.ScanOutcome.Welcome(party)
        }
    }

    /**
     * Admits the selected guests.
     *
     * `method` distinguishes how they arrived so the audit trail and the post-event
     * report can tell a scan from a manual lookup from a supervisor override
     * (§9.6).
     */
    fun admit(
        party: CheckInRepository.PartyView,
        guestIds: List<String>,
        isOverride: Boolean = false,
    ) {
        val eventId = _eventId.value ?: return
        val op = _operator.value

        val method = when {
            isOverride -> CheckInRepository.METHOD_OVERRIDE
            pendingScanToken == null -> CheckInRepository.METHOD_MANUAL
            guestIds.size > 1 -> CheckInRepository.METHOD_GROUP
            else -> CheckInRepository.METHOD_SCAN
        }

        viewModelScope.launch {
            checkInRepository.checkIn(
                eventId = eventId,
                partyId = party.partyId,
                guestIds = guestIds,
                method = method,
                staffId = op.staffId,
                staffDisplayName = op.displayName,
                deviceId = null,
                deviceLabel = deviceRepository.deviceLabel,
                scanToken = pendingScanToken,
            )
            // Ask for a drain immediately. If there is no connectivity this is a
            // no-op — WorkManager's network constraint holds the request until there
            // is, which is exactly the offline-first behaviour §5.1 requires.
            syncCoordinator.requestDrain(eventId)
            dismiss()
        }
    }

    /**
     * Supervisor override for an already-arrived guest (§9.5).
     *
     * Refused for an usher. This is a user-experience gate only — the server
     * validates the acting staff identity against the roster, because a
     * client-side role check must never be the sole gate on a privileged action
     * (§18.2).
     */
    fun override(party: CheckInRepository.PartyView, guestIds: List<String>): Boolean {
        if (!_operator.value.isSupervisor) return false
        admit(party, guestIds, isOverride = true)
        return true
    }

    fun dismiss() {
        _outcome.value = null
        pendingScanToken = null
    }

    private companion object {
        /**
         * Backlog size, while connected, at which the strip escalates to
         * "Needs attention" (§17.7, supervisor-only detail).
         *
         * Chosen well above a normal burst: 200 guests can arrive in 20 minutes
         * (§1.5), so a handful of entries mid-drain is routine and must not raise an
         * alarm — staff who are shown warnings during normal operation learn to
         * ignore them. Twenty-five outstanding entries WITH a working network means
         * the drain is failing, not merely busy.
         */
        const val STUCK_QUEUE_THRESHOLD = 25
    }
}
