package com.fancyrsvp.checkin.device

import android.content.Context
import android.os.BatteryManager
import android.os.StatFs
import com.fancyrsvp.checkin.BuildConfig
import com.fancyrsvp.checkin.data.local.CheckinDatabase
import com.fancyrsvp.checkin.data.remote.DeviceHealth
import kotlinx.coroutines.runBlocking

/**
 * Device health, reported with ordinary sync traffic (spec §21.6, §21.7).
 *
 * A tablet dying with unsynced check-ins is permanent data loss, so a supervisor
 * needs to spot a failing device BEFORE it dies rather than after. This is not
 * telemetry vanity: battery, free storage, bundle version and queue depth are the
 * four figures that predict the failure.
 *
 * Everything here is best-effort and must never throw into a network call — a
 * failure to read the battery level must not cost a device its ability to sync.
 * Contains no guest identifiers and no names (§20.7).
 */
class DeviceHealthProvider(
    private val context: Context,
    private val database: CheckinDatabase,
) {

    /**
     * Throwable, NOT Exception, on both guards.
     *
     * This is the first code in the app to touch the database, and it runs on an
     * OkHttp dispatcher thread inside an interceptor. A database that cannot open
     * fails with an Error, not an Exception — UnsatisfiedLinkError if the native
     * library is missing, ExceptionInInitializerError if its static setup throws.
     * `catch (Exception)` does not catch those.
     *
     * That distinction is not academic here. OkHttp's AsyncCall reports an
     * IOException to the caller and then RETHROWS the original on its own thread,
     * where no caller-side catch can reach it — so an Error escaping this method
     * kills the process, and it looked like a pairing failure because pairing is
     * the first request the app ever makes.
     *
     * Health reporting is diagnostics. It must degrade to null and let the sync
     * proceed; it must never be able to stop a device working (§21.6).
     */
    fun snapshot(): DeviceHealth? = try {
        // One blocking block rather than several: this runs on an OkHttp
        // dispatcher thread inside an interceptor, and two indexed aggregates are
        // cheaper together than two separate hops onto the DB thread.
        val (depth, bundleVersion) = try {
            runBlocking {
                database.syncQueueDao().totalDepth() to database.eventDao().maxPreparedBundleVersion()
            }
        } catch (_: Throwable) {
            null to null
        }

        DeviceHealth(
            batteryPercent = batteryPercent(),
            storageFreeMb = storageFreeMb(),
            queueDepth = depth,
            bundleVersion = bundleVersion,
            appVersion = BuildConfig.VERSION_NAME,
        )
    } catch (_: Throwable) {
        null
    }

    private fun batteryPercent(): Int? = try {
        val manager = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        manager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)?.takeIf { it in 0..100 }
    } catch (_: Exception) {
        null
    }

    private fun storageFreeMb(): Long? = try {
        // Internal storage specifically: guest data and the queue live there, and
        // external storage is never used for either (§20.3).
        val stat = StatFs(context.filesDir.absolutePath)
        (stat.availableBlocksLong * stat.blockSizeLong) / (1024L * 1024L)
    } catch (_: Exception) {
        null
    }

}
