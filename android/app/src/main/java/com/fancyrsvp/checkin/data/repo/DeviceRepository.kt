package com.fancyrsvp.checkin.data.repo

import android.content.Context
import android.os.Build
import com.fancyrsvp.checkin.BuildConfig
import com.fancyrsvp.checkin.data.local.CheckinDatabase
import com.fancyrsvp.checkin.data.remote.CheckinApi
import com.fancyrsvp.checkin.data.remote.DeviceFingerprint
import com.fancyrsvp.checkin.data.remote.PairRequest
import com.fancyrsvp.checkin.data.security.SecureStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Device pairing and lifecycle (spec §18.3, §18.4, §20.5).
 *
 * Devices are provisioned FROM the web dashboard, never self-enrolled here. The
 * app's only role is to redeem an 8-character code and store what comes back in
 * the Keystore.
 */
@Singleton
class DeviceRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: CheckinApi,
    private val db: CheckinDatabase,
    private val secureStore: SecureStore,
    private val io: CoroutineDispatcher,
) {

    sealed interface PairResult {
        data class Success(val eventId: String, val deviceLabel: String) : PairResult
        data object InvalidCode : PairResult
        data object CodeExpired : PairResult
        data object DeviceLimitReached : PairResult
        data object Offline : PairResult
        data class Failed(val code: Int, val message: String?) : PairResult
    }

    val isPaired: Boolean get() = secureStore.isPaired
    val pairedEventId: String? get() = secureStore.pairedEventId
    val deviceLabel: String? get() = secureStore.deviceLabel

    suspend fun pair(rawCode: String): PairResult = withContext(io) {
        // Normalised the same way the server does, so a code typed with spaces or
        // in lowercase off a dashboard screen still works.
        val code = rawCode.uppercase().filter { it.isLetterOrDigit() }
        if (code.length != PAIRING_CODE_LENGTH) return@withContext PairResult.InvalidCode

        try {
            val response = api.pairDevice(
                PairRequest(
                    code = code,
                    fingerprint = fingerprint(),
                    appVersion = BuildConfig.VERSION_NAME,
                ),
            )

            if (!response.isSuccessful) {
                val body = response.errorBody()?.string()
                return@withContext when {
                    response.code() == 410 -> PairResult.CodeExpired
                    response.code() == 409 -> PairResult.DeviceLimitReached
                    response.code() == 400 -> PairResult.InvalidCode
                    else -> PairResult.Failed(response.code(), body?.take(200))
                }
            }

            val data = response.body()?.data
                ?: return@withContext PairResult.Failed(response.code(), "empty body")

            // Both tokens go straight into the Keystore-wrapped store. They are
            // never written to SharedPreferences in plaintext, a file, or a log
            // (§20.2).
            secureStore.accessToken = data.accessToken
            secureStore.refreshToken = data.refreshToken
            secureStore.deviceId = data.deviceId
            secureStore.deviceLabel = data.deviceLabel
            secureStore.pairedEventId = data.eventId

            PairResult.Success(data.eventId, data.deviceLabel)
        } catch (_: java.io.IOException) {
            // Pairing requires internet by design — it is done during
            // preparation, never at the venue (§18.3).
            PairResult.Offline
        } catch (e: Exception) {
            PairResult.Failed(-1, e.message)
        }
    }

    /**
     * A stable per-installation id for support triage.
     *
     * Deliberately NOT a hardware identifier: ANDROID_ID and the like are
     * privacy-sensitive and need no permission-free justification here. A random
     * UUID generated once per install identifies the installation for a support
     * conversation and nothing more, and it dies with an uninstall — which is the
     * correct lifetime.
     */
    private fun installId(): String {
        secureStore.deviceId?.let { return it }
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.getString(KEY_INSTALL_ID, null)?.let { return it }
        val generated = UUID.randomUUID().toString()
        prefs.edit().putString(KEY_INSTALL_ID, generated).apply()
        return generated
    }

    private fun fingerprint() = DeviceFingerprint(
        model = Build.MODEL ?: "unknown",
        manufacturer = Build.MANUFACTURER ?: "unknown",
        osVersion = "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})",
        installId = installId(),
    )

    /**
     * Purges local event data after a confirmed wipe or an event close (§20.5).
     *
     * BLOCKED while the sync queue is non-empty, and that is not a soft
     * preference: those check-ins exist nowhere else, and destroying them is the
     * single worst outcome in the system. Returns false so the caller can warn
     * explicitly rather than silently doing nothing.
     */
    suspend fun purgeEventData(eventId: String): Boolean = withContext(io) {
        val pending = db.syncQueueDao().depthForEvent(eventId)
        if (pending > 0) return@withContext false

        db.bundleDao().purgeGuestData(eventId)
        db.checkInDao().deleteForEvent(eventId)
        db.eventDao().markNotReady(eventId)
        true
    }

    /**
     * Handles a server instruction to wipe (§20.5).
     *
     * Credentials are cleared only when the device was REVOKED. A plain wipe
     * request leaves the tablet paired so it stays provisioned for future events.
     */
    suspend fun handleWipeInstruction(eventId: String, revoked: Boolean): Boolean = withContext(io) {
        val purged = purgeEventData(eventId)
        if (purged) {
            runCatching { api.confirmWipe() }
            if (revoked) secureStore.clearDeviceCredentials()
        }
        purged
    }

    private companion object {
        const val PAIRING_CODE_LENGTH = 8
        const val PREFS = "fancy_checkin_install"
        const val KEY_INSTALL_ID = "install_id"
    }
}
