package com.fancyrsvp.checkin.util

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * Coroutine failure containment (§21.3, §21.6).
 *
 * ── Why this exists ──
 *
 * A bare `viewModelScope.launch { }` sends anything that escapes it to the
 * thread's default uncaught-exception handler, which on Android TERMINATES THE
 * PROCESS. There is no dialog and no log the operator can reach. On a tablet at
 * a door this means the app vanishes mid-rush, and any check-in still sitting in
 * the outbound queue is unreachable until someone reopens it.
 *
 * That is never an acceptable response to a failed query or a dropped
 * connection. The app is the only place some arrivals exist (§21.3), so staying
 * alive and degraded always beats dying cleanly.
 *
 * ── Why a helper rather than try/catch at each site ──
 *
 * There were fourteen unguarded launches in this app and every one of them was a
 * process kill. Guarding them individually is a rule nobody can keep: the
 * fifteenth gets written without it, and nothing fails until a venue. Routing
 * every launch through one function makes the safe form the easy form.
 *
 * ── Throwable, not Exception ──
 *
 * `Error` is not an `Exception`. UnsatisfiedLinkError from a native library that
 * will not load, ExceptionInInitializerError from a failed static setup,
 * NoClassDefFoundError from over-aggressive shrinking — none are caught by
 * `catch (e: Exception)`, and all three killed this app during bring-up.
 *
 * CancellationException is deliberately re-thrown: it is how coroutines
 * implement normal cancellation, and swallowing it breaks scope teardown and
 * leaks work that should have stopped.
 */
fun ViewModel.safeLaunch(
    onError: (Throwable) -> Unit = {},
    block: suspend CoroutineScope.() -> Unit,
): Job = viewModelScope.launch {
    try {
        block()
    } catch (c: CancellationException) {
        throw c
    } catch (t: Throwable) {
        onError(t)
    }
}

/**
 * The same containment for a scope that is not a ViewModel's — the application
 * scope that drives background sync.
 *
 * `SupervisorJob` alone is NOT enough and it is a common misreading. It stops a
 * failed child from cancelling its siblings; it does nothing about where the
 * exception goes afterwards. Without a handler in the context it still reaches
 * the default uncaught handler and kills the process — so the sync engine could
 * take the whole app down from a background thread while an usher was scanning.
 */
val SyncExceptionHandler = CoroutineExceptionHandler { _, _ ->
    // Deliberately silent. Sync is retried on a schedule and every failure path
    // already surfaces through the connection state the UI shows (§17.7); the
    // one thing that must not happen is the process dying. Anything that kills
    // the app despite this is captured by CrashLog.
}

/** Formats a throwable for display where there is no logcat: `Type: message`. */
fun Throwable.readable(): String = "${javaClass.simpleName}: ${message ?: "no message"}"
