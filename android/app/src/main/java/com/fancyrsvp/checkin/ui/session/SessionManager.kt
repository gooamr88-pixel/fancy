package com.fancyrsvp.checkin.ui.session

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Staff session lifetime (spec §18.5, §20.4).
 *
 * Two independent expiry rules, both required:
 *
 *  • 30 minutes of inactivity.
 *  • Resume after more than 5 minutes backgrounded.
 *
 * The reason is physical, not abstract: "Tablets at doors are physically
 * unattended." Anyone can pick one up between arrivals, and the guest list of a
 * private event is on it.
 *
 * ── What locking must NOT do ──
 *
 * Locking gates the UI only. It must never stop the sync engine: the queue drain
 * runs in WorkManager against a Keystore key that deliberately does not require
 * user authentication (see SecureStore), precisely so a locked screen still syncs.
 * Check-ins that exist only on this device must keep leaving it while nobody is
 * holding it.
 *
 * Activity is recorded by the UI on interaction. Scanning counts — a device being
 * actively used at a door must not lock in someone's hands mid-rush.
 */
@Singleton
class SessionManager @Inject constructor() {

    data class Session(
        val staffId: String?,
        val displayName: String?,
        val role: String,
    ) {
        val isSupervisor: Boolean get() = role == "supervisor"
    }

    private val _session = MutableStateFlow<Session?>(null)
    val session: StateFlow<Session?> = _session.asStateFlow()

    private val _locked = MutableStateFlow(false)
    val locked: StateFlow<Boolean> = _locked.asStateFlow()

    private var lastActivityAt: Long = System.currentTimeMillis()
    private var backgroundedAt: Long? = null

    fun onLoggedIn(staffId: String?, displayName: String?, role: String) {
        _session.value = Session(staffId, displayName, role)
        _locked.value = false
        lastActivityAt = System.currentTimeMillis()
        backgroundedAt = null
    }

    /** Called from the UI on any interaction, including a completed scan. */
    fun recordActivity() {
        lastActivityAt = System.currentTimeMillis()
    }

    fun onBackgrounded() {
        backgroundedAt = System.currentTimeMillis()
    }

    /**
     * Evaluates both expiry rules on resume.
     *
     * @return true if the session is now locked.
     */
    fun onForegrounded(now: Long = System.currentTimeMillis()): Boolean {
        if (_session.value == null) return false

        val awayMs = backgroundedAt?.let { now - it } ?: 0L
        backgroundedAt = null

        if (awayMs > BACKGROUND_LOCK_MS || now - lastActivityAt > INACTIVITY_LOCK_MS) {
            _locked.value = true
        } else {
            // A brief switch away — checking a message, answering a call — must not
            // cost a PIN entry with a queue forming.
            lastActivityAt = now
        }
        return _locked.value
    }

    /** Checks the inactivity rule without a lifecycle transition. */
    fun evaluateInactivity(now: Long = System.currentTimeMillis()): Boolean {
        if (_session.value == null) return false
        if (now - lastActivityAt > INACTIVITY_LOCK_MS) _locked.value = true
        return _locked.value
    }

    /** Unlocks after a successful PIN re-entry for the SAME staff member. */
    fun unlock() {
        _locked.value = false
        lastActivityAt = System.currentTimeMillis()
    }

    /**
     * Ends the session entirely — shift handover (§18.5).
     *
     * One tap to the staff picker, because handover happens mid-rush.
     */
    fun signOut() {
        _session.value = null
        _locked.value = false
    }

    companion object {
        val INACTIVITY_LOCK_MS = 30 * 60 * 1000L
        val BACKGROUND_LOCK_MS = 5 * 60 * 1000L
    }
}
