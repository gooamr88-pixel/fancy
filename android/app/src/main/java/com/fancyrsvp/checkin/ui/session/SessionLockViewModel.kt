package com.fancyrsvp.checkin.ui.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fancyrsvp.checkin.data.local.CheckinDatabase
import com.fancyrsvp.checkin.data.security.PinVerifier
import com.fancyrsvp.checkin.util.safeLaunch
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * PIN re-entry after a session lock (spec §20.4, §18.5).
 *
 * Shares the lockout rules with first login: five failures locks that staff member
 * for five minutes on THIS device only. A 4-digit PIN is a 10,000-value keyspace, so
 * rate limiting is not optional — and the lockout must not propagate, because
 * locking a supervisor out of every door over one mishandled tablet would stop an
 * entire event.
 */
@HiltViewModel
class SessionLockViewModel @Inject constructor(
    private val db: CheckinDatabase,
    private val sessionManager: SessionManager,
    private val io: CoroutineDispatcher,
) : ViewModel() {

    sealed interface State {
        data object Idle : State
        data object Verifying : State
        data object Unlocked : State
        data class WrongPin(val attemptsRemaining: Int) : State
        data class LockedOut(val untilMillis: Long) : State
    }

    private val _state = MutableStateFlow<State>(State.Idle)
    val state: StateFlow<State> = _state.asStateFlow()

    private val _staffName = MutableStateFlow<String?>(null)
    val staffName: StateFlow<String?> = _staffName.asStateFlow()

    init {
        _staffName.value = sessionManager.session.value?.displayName
    }

    fun submit(pin: String) {
        val staffId = sessionManager.session.value?.staffId
        if (staffId == null) {
            // No staff identity to verify against — an organizer-authenticated
            // session with no roster entry. Unlocking is correct: there is no PIN
            // that could ever match, and trapping the operator behind an
            // unsatisfiable prompt would strand the device.
            sessionManager.unlock()
            _state.value = State.Unlocked
            return
        }

        if (_state.value is State.Verifying) return

        // A crash while unlocking would leave the tablet stuck behind the lock
        // overlay with a queue at the door. WrongPin keeps the keypad live.
        safeLaunch(onError = { _state.value = State.WrongPin(MAX_ATTEMPTS) }) {
            _state.value = State.Verifying

            _state.value = withContext<State>(io) {
                val staff = db.staffDao().byId(staffId) ?: return@withContext State.Unlocked

                val now = System.currentTimeMillis()
                if (staff.lockedUntil != null && staff.lockedUntil > now) {
                    return@withContext State.LockedOut(staff.lockedUntil)
                }

                if (PinVerifier.verify(pin, staff.pinHash)) {
                    db.staffDao().setLockState(staffId, attempts = 0, lockedUntil = null)
                    sessionManager.unlock()
                    State.Unlocked
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
        }
    }

    fun signOut() {
        sessionManager.signOut()
    }

    private companion object {
        const val MAX_ATTEMPTS = 5
        const val LOCKOUT_MS = 5 * 60 * 1000L
    }
}
