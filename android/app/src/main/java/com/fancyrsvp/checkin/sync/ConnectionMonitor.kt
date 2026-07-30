package com.fancyrsvp.checkin.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Connection state for the sync engine and the status strip (spec §17.6, §17.7).
 *
 * ── Why NET_CAPABILITY_VALIDATED matters here more than usual ──
 *
 * Venue Wi-Fi is overwhelmingly captive-portal Wi-Fi. A tablet associates, gets an
 * IP, and reports a network — while every request is silently redirected to a login
 * page. Treating association as connectivity would make the app claim "Synced"
 * while nothing syncs, which is the one lie §17.7 must not tell: staff would stop
 * watching the pending counter.
 *
 * VALIDATED means Android has actually confirmed internet reachability, so a
 * captive portal reports as unvalidated and this class reports DEGRADED or OFFLINE
 * rather than CONNECTED.
 *
 * ── CONNECTED vs DEGRADED ──
 *
 * `CONNECTED` in the spec means the realtime channel is established. Realtime is
 * not shipped (finding R-2 — the channel has no authorisation model), so this class
 * currently reports at most `DEGRADED`: network present, channel not, polling
 * active. §17.6 explicitly calls DEGRADED "a normal, expected state at venues, not
 * an error", and §17.7 requires it be shown to staff as "Synced" — the distinction
 * is an engineering one and must not reach the door.
 */
@Singleton
class ConnectionMonitor @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _state = MutableStateFlow(currentState())
    val state: StateFlow<ConnectionState> = _state.asStateFlow()

    /**
     * Emits on every transition, de-duplicated.
     *
     * Collect this to drive the poller: a change from OFFLINE to anything else must
     * trigger a single immediate delta fetch (§17.5), and de-duplicating prevents a
     * flapping network from firing a fetch per callback.
     */
    fun observe(): Flow<ConnectionState> = callbackFlow {
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                trySend(currentState())
            }

            override fun onLost(network: Network) {
                trySend(currentState())
            }

            override fun onCapabilitiesChanged(
                network: Network,
                capabilities: NetworkCapabilities,
            ) {
                // The transition that matters on a captive portal: association fires
                // onAvailable, and VALIDATED arrives later — or never.
                trySend(currentState())
            }
        }

        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        connectivityManager.registerNetworkCallback(request, callback)
        trySend(currentState())

        awaitClose { connectivityManager.unregisterNetworkCallback(callback) }
    }.distinctUntilChanged()

    /** Recomputes from the active network. Safe to call from any thread. */
    fun currentState(): ConnectionState {
        val network = connectivityManager.activeNetwork ?: return ConnectionState.OFFLINE
        val caps = connectivityManager.getNetworkCapabilities(network)
            ?: return ConnectionState.OFFLINE

        val hasInternet = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        val validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)

        return when {
            !hasInternet -> ConnectionState.OFFLINE
            // Associated but not yet validated: a captive portal, or a network still
            // being probed. CONNECTING, so the poller tries but the UI does not
            // claim success.
            !validated -> ConnectionState.CONNECTING
            // Network confirmed. DEGRADED rather than CONNECTED because the realtime
            // channel is not established — see the class comment.
            else -> ConnectionState.DEGRADED
        }
    }

    fun refresh() {
        _state.value = currentState()
    }

    /** True when data can plausibly move. Used to decide whether to attempt a drain. */
    val isUsable: Boolean
        get() = currentState() != ConnectionState.OFFLINE
}
