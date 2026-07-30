package com.fancyrsvp.checkin.device

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.StatFs
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Battery and storage, as observable state (spec §21.9).
 *
 * Separate from [DeviceHealthProvider], which takes a synchronous snapshot for the
 * outbound headers. This one drives warnings on screen, so it needs to react the
 * moment a level changes rather than when a request happens to go out.
 *
 * ── Why battery warnings here are about DATA, not power ──
 *
 * §21.9 is explicit that the warning must communicate STAKES, not just a level. A
 * tablet dying with unsynced check-ins is permanent data loss (§21.7) — those
 * arrivals exist nowhere else. So the 10% modal states the pending count, and the
 * copy differs depending on whether anything is actually outstanding: telling a
 * supervisor "you will lose 14 check-ins" when the queue is empty trains them to
 * dismiss the warning that matters.
 */
@Singleton
class DeviceStatusMonitor @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    data class Status(
        val batteryPercent: Int?,
        val isCharging: Boolean,
        val storageFreeMb: Long?,
    ) {
        val isBatteryLow: Boolean get() = batteryPercent != null && batteryPercent <= LOW_THRESHOLD
        val isBatteryCritical: Boolean get() = batteryPercent != null && batteryPercent <= CRITICAL_THRESHOLD
    }

    /**
     * Emits on every battery change.
     *
     * ACTION_BATTERY_CHANGED is a sticky broadcast, so registering returns the
     * current level immediately — no need to seed it separately, and no window where
     * the UI shows an unknown level.
     */
    fun observe(): Flow<Status> = callbackFlow {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context?, intent: Intent?) {
                trySend(readStatus(intent))
            }
        }
        context.registerReceiver(receiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        awaitClose { runCatching { context.unregisterReceiver(receiver) } }
    }.distinctUntilChanged()

    fun current(): Status = readStatus(null)

    private fun readStatus(intent: Intent?): Status {
        val percent = intent?.let {
            val level = it.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = it.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            if (level >= 0 && scale > 0) (level * 100) / scale else null
        } ?: batteryFromManager()

        val charging = intent?.let {
            val status = it.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
            status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL
        } ?: false

        return Status(percent, charging, storageFreeMb())
    }

    private fun batteryFromManager(): Int? = try {
        val manager = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        manager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)?.takeIf { it in 0..100 }
    } catch (_: Exception) {
        null
    }

    /**
     * Free space on INTERNAL storage specifically.
     *
     * Guest data and the queue live there and nowhere else (§20.3), so free space on
     * a removable card is irrelevant to whether this device can keep recording
     * arrivals.
     */
    fun storageFreeMb(): Long? = try {
        val stat = StatFs(context.filesDir.absolutePath)
        (stat.availableBlocksLong * stat.blockSizeLong) / (1024L * 1024L)
    } catch (_: Exception) {
        null
    }

    /**
     * Whether there is room to prepare an event of this size (§21.9).
     *
     * Checked BEFORE travelling. "Failing loudly at 14:00 in an office is
     * recoverable; failing at 20:00 at a venue is not."
     */
    fun hasRoomForBundle(guestCount: Int): Boolean {
        val free = storageFreeMb() ?: return true // unknown: do not block on a bad read
        val needed = (guestCount * BYTES_PER_GUEST_ESTIMATE) / (1024 * 1024) + HEADROOM_MB
        return free >= needed
    }

    companion object {
        const val LOW_THRESHOLD = 20
        const val CRITICAL_THRESHOLD = 10

        /**
         * Generous per-guest estimate covering the guest row, party row, indexes and
         * SQLCipher page overhead. Deliberately over-estimated: the cost of a false
         * "not enough room" in an office is a shrug, and the cost of a false "plenty
         * of room" is a failed download at a venue.
         */
        private const val BYTES_PER_GUEST_ESTIMATE = 4_096L

        /** Room for the WAL, the queue growing through the event, and logs. */
        private const val HEADROOM_MB = 250L
    }
}
