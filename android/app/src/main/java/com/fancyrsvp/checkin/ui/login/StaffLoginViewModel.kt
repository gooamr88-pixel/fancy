package com.fancyrsvp.checkin.ui.login

import androidx.lifecycle.ViewModel
import com.fancyrsvp.checkin.data.local.CheckinDatabase
import com.fancyrsvp.checkin.data.local.StaffEntity
import com.fancyrsvp.checkin.data.security.PinVerifier
import com.fancyrsvp.checkin.util.safeLaunch
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Staff login (spec §8.1, §18.5).
 *
 * Fully offline: staff pick their name from the cached roster and enter a 4-digit
 * PIN, verified against a hash that arrived in the bundle. No email, no password,
 * no network — door staff may be temporary hires who cannot be expected to hold
 * platform credentials, and the venue may have no connectivity at all.
 *
 * ── Lockout, and why it is per-device ──
 *
 * Five consecutive failures lock that staff member for five minutes on THIS
 * device only (§18.5). A 4-digit PIN is a 10,000-value keyspace, so rate limiting
 * is not optional. But the lockout must never propagate: locking a supervisor out
 * of every door because one tablet was mishandled would stop an entire event, and
 * §21.8 requires the opposite — a supervisor can reset a PIN locally and offline.
 */
@HiltViewModel
class StaffLoginViewModel @Inject constructor(
    private val db: CheckinDatabase,
    private val io: CoroutineDispatcher,
) : ViewModel() {

    data class StaffOption(
        val staffId: String,
        val displayName: String,
        val role: String,
        val lockedUntil: Long?,
    ) {
        fun isLocked(now: Long = System.currentTimeMillis()): Boolean =
            lockedUntil != null && lockedUntil > now
    }

    sealed interface State {
        data object Idle : State
        data object Verifying : State
        data class Success(val staffId: String, val displayName: String, val role: String) : State
        data class WrongPin(val attemptsRemaining: Int) : State
        data class LockedOut(val untilMillis: Long) : State
        data object RosterEmpty : State
    }

    private val _state = MutableStateFlow<State>(State.Idle)
    val state: StateFlow<State> = _state.asStateFlow()

    private val _roster = MutableStateFlow<List<StaffOption>>(emptyList())
    val roster: StateFlow<List<StaffOption>> = _roster.asStateFlow()

    /**
     * The event's photograph, shown as a portrait beside the wordmark (§9.8).
     *
     * Separate from the roster flow rather than combined with it: the roster is
     * the screen's PURPOSE and the picture is decoration on it, and a database
     * hiccup reading one must not be able to blank the other. Failure here is a
     * null, which the screen draws by simply omitting the portrait.
     */
    private val _coverImagePath = MutableStateFlow<String?>(null)
    val coverImagePath: StateFlow<String?> = _coverImagePath.asStateFlow()

    fun loadRoster(eventId: String) {
        safeLaunch { _coverImagePath.value = db.eventDao().byId(eventId)?.coverImagePath }

        safeLaunch(
            // A database that will not open must present as an empty roster, not
            // as the app disappearing. RosterEmpty is a state the screen already
            // renders and explains.
            onError = { _state.value = State.RosterEmpty },
        ) {
            // Collected as a Flow, not read once, so a supervisor's local PIN
            // reset (§21.8) or a bundle refresh is reflected without a reload.
            db.staffDao().observeForEvent(eventId)
                .flowOn(io)
                .collect { rows ->
                    _roster.value = rows.map { it.toOption() }
                    if (rows.isEmpty()) _state.value = State.RosterEmpty
                }
        }
    }

    /**
     * Verifies a PIN.
     *
     * The PBKDF2 derivation is 600k iterations and is deliberately slow (§18.5),
     * so it runs off the main thread and the UI shows [State.Verifying] while it
     * works. On a low-end tablet this can take over a second — the fix for that is
     * this progress state, never a lower iteration count.
     */
    fun submitPin(staffId: String, pin: String) {
        if (_state.value is State.Verifying) return

        // A crash here strands staff at the door mid-handover with no way in.
        // WrongPin is the safe degradation: it keeps them on the keypad and lets
        // them retry, rather than locking anyone out or admitting them.
        safeLaunch(
            onError = { _state.value = State.WrongPin(MAX_ATTEMPTS) },
        ) {
            _state.value = State.Verifying

            // Explicit type parameter: the block returns several State subtypes
            // plus an early return, and inference across those is fragile.
            val result = withContext<State>(io) {
                val staff = db.staffDao().byId(staffId) ?: return@withContext State.RosterEmpty

                val now = System.currentTimeMillis()
                if (staff.lockedUntil != null && staff.lockedUntil > now) {
                    return@withContext State.LockedOut(staff.lockedUntil)
                }

                if (PinVerifier.verify(pin, staff.pinHash)) {
                    db.staffDao().setLockState(staffId, attempts = 0, lockedUntil = null)
                    State.Success(staff.staffId, staff.displayName, staff.role)
                } else {
                    val attempts = staff.failedAttempts + 1
                    if (attempts >= MAX_ATTEMPTS) {
                        val until = now + LOCKOUT_MS
                        db.staffDao().setLockState(staffId, attempts = 0, lockedUntil = until)
                        State.LockedOut(until)
                    } else {
                        db.staffDao().setLockState(staffId, attempts = attempts, lockedUntil = null)
                        State.WrongPin(MAX_ATTEMPTS - attempts)
                    }
                }
            }

            _state.value = result
        }
    }

    /**
     * Supervisor PIN reset, performed locally and offline (§21.8).
     *
     * An usher who forgets their PIN or triggers the lockout during peak arrivals
     * stops the door, and there is no internet to reset anything from the web
     * platform. The reset is recorded and syncs later.
     *
     * The new hash is derived on-device with the same parameters the server uses,
     * so it stays verifiable after the next bundle refresh overwrites it.
     */
    fun supervisorResetPin(staffId: String, newPin: String) {
        safeLaunch(onError = { _state.value = State.Idle }) {
            withContext(io) {
                val saltHex = java.util.UUID.randomUUID().toString().replace("-", "")
                val derived = PinVerifier.derive(newPin, saltHex)
                db.staffDao().setPinHash(staffId, "$saltHex:${PinVerifier.toHex(derived)}")
            }
            _state.value = State.Idle
        }
    }

    fun clearError() {
        if (_state.value !is State.Success) _state.value = State.Idle
    }

    private fun StaffEntity.toOption() = StaffOption(
        staffId = staffId,
        displayName = displayName,
        role = role,
        lockedUntil = lockedUntil,
    )

    private companion object {
        const val MAX_ATTEMPTS = 5
        const val LOCKOUT_MS = 5 * 60 * 1000L
    }
}
