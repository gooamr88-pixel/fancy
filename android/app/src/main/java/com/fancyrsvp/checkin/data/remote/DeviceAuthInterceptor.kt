package com.fancyrsvp.checkin.data.remote

import com.fancyrsvp.checkin.data.security.SecureStore
import okhttp3.Interceptor
import okhttp3.Response
import java.io.IOException

/**
 * Attaches the device credential and refreshes it silently on a 401 (spec §18.4).
 *
 * ── The rule that matters most ──
 *
 * Token state governs SYNC, never LOCAL OPERATION. A tablet six hours offline at
 * a venue has an expired access token; if expiry could stop scanning, the product
 * fails at exactly the moment it matters. This interceptor therefore only ever
 * affects network calls — it cannot and must not reach into the scan path.
 *
 * ── Why the `Device` scheme rather than `Bearer` ──
 *
 * The backend's requireAuth also reads Authorization. If both used `Bearer`, a
 * device token would fall through to the organizer JWT verifier and produce a
 * confusing 401 instead of a clear one.
 *
 * ── Refresh, once ──
 *
 * On a 401 the interceptor refreshes and retries the original request exactly
 * once. A second 401 is returned to the caller: retrying further would spin, and
 * the repository needs to see the failure to decide whether this is a transient
 * problem or a revoked device.
 *
 * Refresh is serialised on a lock. Several requests can 401 together at the start
 * of an event when a whole batch of queued work resumes; without the lock they
 * would each burn a refresh token, and since refresh tokens ROTATE on every use
 * (§18.4) all but one would then be invalid — revoking the device's own
 * credential through nothing but concurrency.
 */
class DeviceAuthInterceptor(
    private val secureStore: SecureStore,
    /**
     * Refreshes and returns the new access token, or null if refresh failed.
     * Supplied as a lambda to avoid a dependency cycle: the API interface needs
     * an OkHttpClient, which needs this interceptor.
     */
    private val refresh: (refreshToken: String) -> String?,
) : Interceptor {

    private val refreshLock = Any()

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()

        // The pairing and refresh endpoints must NOT carry a device credential:
        // pairing has none yet, and refresh authenticates with its own body.
        if (isUnauthenticatedPath(original.url.encodedPath)) {
            return chain.proceed(original)
        }

        val token = secureStore.accessToken
        val first = chain.proceed(withDeviceAuth(original, token))

        if (first.code != 401 || token == null) return first

        // Consume the 401 body before retrying — leaking it would exhaust the
        // connection pool over a long event.
        first.close()

        val newToken: String? = synchronized(refreshLock) {
            // Another thread may have refreshed while this one waited. If the
            // stored token has already changed, use it rather than burning
            // another rotation — refresh tokens are single-use.
            val current = secureStore.accessToken
            if (current != null && current != token) {
                current
            } else {
                val refreshToken = secureStore.refreshToken
                if (refreshToken == null) null else refresh(refreshToken)
            }
        }

        // Refresh failed (no refresh token, or the server rejected it). Replay
        // once with the OLD token so the caller sees the server's real verdict —
        // 401 TOKEN_EXPIRED and 403 DEVICE_REVOKED demand opposite responses, and
        // a synthesised local error would hide which one this is.
        val tokenToUse = newToken ?: token
        return chain.proceed(withDeviceAuth(original, tokenToUse))
    }

    private fun withDeviceAuth(request: okhttp3.Request, token: String?) =
        if (token == null) {
            request
        } else {
            request.newBuilder()
                .header("Authorization", "Device $token")
                .build()
        }

    private fun isUnauthenticatedPath(path: String): Boolean =
        path.endsWith("/checkin/devices/pair") || path.endsWith("/checkin/devices/refresh")

    companion object {
        /**
         * Header names the backend reads opportunistically for device health
         * (§21.6). Sent on ordinary calls rather than as a dedicated heartbeat,
         * so telemetry never gets its own always-on connection.
         */
        const val HEADER_BATTERY = "X-Device-Battery"
        const val HEADER_STORAGE = "X-Device-Storage-Free-Mb"
        const val HEADER_QUEUE_DEPTH = "X-Device-Queue-Depth"
        const val HEADER_BUNDLE_VERSION = "X-Device-Bundle-Version"
        const val HEADER_APP_VERSION = "X-App-Version"
    }
}

/**
 * Adds device-health headers to every request (§21.6, §21.7).
 *
 * Separate from the auth interceptor so health reporting can never interfere with
 * authentication: a failure to read the battery level must not cost a device its
 * ability to sync.
 */
class DeviceHealthInterceptor(
    private val health: () -> DeviceHealth?,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val snapshot = try {
            health()
        } catch (_: Exception) {
            null
        } ?: return chain.proceed(chain.request())

        val builder = chain.request().newBuilder()
        snapshot.batteryPercent?.let { builder.header(DeviceAuthInterceptor.HEADER_BATTERY, it.toString()) }
        snapshot.storageFreeMb?.let { builder.header(DeviceAuthInterceptor.HEADER_STORAGE, it.toString()) }
        snapshot.queueDepth?.let { builder.header(DeviceAuthInterceptor.HEADER_QUEUE_DEPTH, it.toString()) }
        snapshot.bundleVersion?.let { builder.header(DeviceAuthInterceptor.HEADER_BUNDLE_VERSION, it.toString()) }
        builder.header(DeviceAuthInterceptor.HEADER_APP_VERSION, snapshot.appVersion)
        return chain.proceed(builder.build())
    }
}

data class DeviceHealth(
    val batteryPercent: Int?,
    val storageFreeMb: Long?,
    val queueDepth: Int?,
    val bundleVersion: Long?,
    val appVersion: String,
)

/** Thrown only for genuinely unrecoverable transport problems. */
class CheckinNetworkException(message: String, cause: Throwable? = null) : IOException(message, cause)
